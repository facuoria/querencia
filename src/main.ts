import { Application, Container } from 'pixi.js';
import { CityState } from './core/cityState';
import { generateMap, startCenter } from './core/mapGen';
import { Zone, type TileCoord } from './core/types';
import { COLORS, MILESTONES, SAVE, SOUND, TIME, TRAFFIC } from './data/config';
import { SERVICES } from './data/services';
import { TEXTS } from './data/texts';
import { CameraControls } from './input/cameraControls';
import { installShortcuts } from './input/shortcuts';
import { Tool, ToolController } from './input/tools';
import { loadAssets } from './render/assets';
import { Camera } from './render/camera';
import { Heatmap } from './render/heatmap';
import { tileToWorld, worldToTile } from './render/iso';
import { MapRenderer } from './render/mapRenderer';
import { Overlay } from './render/overlay';
import { Traffic } from './render/traffic';
import { deleteSave, loadGame, saveGame, saveSummary } from './save/save';
import { GameClock } from './sim/clock';
import { GrowthSim } from './sim/growth';
import { currentMilestone, unlocksOf } from './sim/milestones';
import { Alerts } from './ui/alerts';
import { BottomBar } from './ui/bottomBar';
import { BudgetPanel } from './ui/budgetPanel';
import { CityPanel } from './ui/cityPanel';
import { Hud } from './ui/hud';
import { MapsPanel, ServiceInfo, SupplyPanel } from './ui/servicePanels';
import { createShell } from './ui/shell';
import { Sound } from './ui/sound';
import { showStartScreen } from './ui/startScreen';
import { CursorLabel, Toast } from './ui/toast';
import { TopBar, formatMoney } from './ui/topBar';
import './ui/theme.css';
import './ui/styles.css';

/** Tope de tiempo por cuadro, para que volver a una pestaña inactiva no adelante días de golpe. */
const MAX_FRAME_MS = 250;

const ZONE_NAMES: Record<number, string> = {
  [Zone.Residential]: TEXTS.zones.residential,
  [Zone.Commercial]: TEXTS.zones.commercial,
  [Zone.Industrial]: TEXTS.zones.industrial,
};

/** "¡Nuevo hito! Pueblo. Se desbloquea: Industrial, Planta de gas, ..." */
function milestoneMessage(m: number): string {
  const t = TEXTS.milestones;
  const u = unlocksOf(m);
  const items = [
    ...u.zones.map((z) => ZONE_NAMES[z]!),
    ...u.services.map((s) => (s === 0 ? '' : SERVICES[s].name)),
    ...(u.buildingLevel3 ? [t.level3] : []),
    ...(u.serviceLevel3 ? [t.serviceLevel3] : []),
  ].filter(Boolean);
  const name = t[MILESTONES[m]!.key];
  const text = `${t.reached} ${name}. ${t.unlocks}: ${items.join(', ')}.`;
  return m === MILESTONES.length - 1 ? `${text} ${t.finalAchievement}` : text;
}

/** La partida guardada si se eligió continuar; si no, una nueva con un mapa distinto cada vez. */
function loadOrCreate(continueSaved: boolean): { state: CityState; loaded: boolean } {
  if (continueSaved) {
    const saved = loadGame();
    if (saved) return { state: saved, loaded: true };
  }
  deleteSave();
  const state = new CityState();
  generateMap(state, Math.floor(Math.random() * 1e9));
  return { state, loaded: false };
}

async function start(): Promise<void> {
  const host = document.getElementById('app')!;
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: COLORS.background,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });
  host.appendChild(app.canvas);
  // Los sprites se cargan mientras el jugador mira la pantalla de inicio.
  const assets = loadAssets();
  const choice = await showStartScreen(saveSummary());
  await assets;

  const { state, loaded } = loadOrCreate(choice === 'continue');
  const sound = new Sound();
  const clock = new GameClock(state);
  const growth = new GrowthSim(state);
  growth.refresh(true);
  // Solo en desarrollo: acceso desde la consola del navegador para probar.
  if (import.meta.env.DEV) Object.assign(window, { city: { state, growth } });

  const world = new Container();
  const mapRenderer = new MapRenderer(
    state,
    (x, y) => {
      growth.network.update();
      return growth.services.isWorking(x, y);
    },
    (i) => growth.hasPower(i),
  );
  const heatmap = new Heatmap(state, growth);
  const overlay = new Overlay(state);
  const traffic = new Traffic(state, growth.network, (x, y) => mapRenderer.bandOf(x, y));
  world.addChild(mapRenderer.layer, heatmap.graphics, mapRenderer.gridLayer, mapRenderer.borderLayer, overlay.graphics);
  app.stage.addChild(world);

  // La cámara puede moverse dentro del rombo que ocupa el mapa.
  const size = state.size;
  const camera = new Camera(world, app.screen, {
    left: tileToWorld(0, size).x,
    right: tileToWorld(size, 0).x,
    top: tileToWorld(0, 0).y,
    bottom: tileToWorld(size, size).y,
  });
  const recenter = (): void => {
    const c = startCenter(state);
    const w = tileToWorld(c.x, c.y);
    camera.centerOn(w.x, w.y);
  };
  recenter();

  const shell = createShell();
  const toast = new Toast(shell.center);
  const showError = (msg: string): void => {
    toast.show(msg);
    sound.play('error');
  };

  const save = (announce: boolean): void => {
    const ok = saveGame(state);
    if (announce || !ok) toast.show(ok ? TEXTS.save.saved : TEXTS.save.error, ok ? 'info' : 'error');
  };
  const newGame = (): void => {
    if (!window.confirm(TEXTS.save.confirmNew)) return;
    deleteSave();
    // Evita que el guardado al cerrar la página vuelva a escribir la ciudad vieja.
    window.removeEventListener('beforeunload', saveOnLeave);
    window.location.reload();
  };
  const saveOnLeave = (): void => {
    saveGame(state);
  };
  window.addEventListener('beforeunload', saveOnLeave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveGame(state);
  });
  window.setInterval(() => saveGame(state), SAVE.autosaveMs);

  const hud = new Hud(shell.left, state, growth);
  const budgetPanel = new BudgetPanel(shell.root, state, () => growth.refresh(), (i) => growth.hasPower(i));
  const topBar = new TopBar(
    shell.top,
    state,
    clock,
    {
      onBudget: () => budgetPanel.toggle(),
      onSave: () => save(true),
      onNewGame: newGame,
      onHelp: () => hud.toggleHelp(),
    },
    sound,
  );
  const cityPanel = new CityPanel(shell.right, state);
  const supplyPanel = new SupplyPanel(shell.right, growth);
  const alerts = new Alerts(shell.center, state, growth);
  const cursorLabel = new CursorLabel(shell.root);

  const controls = new CameraControls(app.canvas, camera, recenter);
  const tools = new ToolController(
    app.canvas,
    state,
    showError,
    (tool) => {
      growth.refresh();
      heatmap.redraw();
      const zoneTool = tool === Tool.Residential || tool === Tool.Commercial || tool === Tool.Industrial;
      sound.play(tool === Tool.Demolish ? 'demolish' : zoneTool ? 'zone' : 'build');
    },
  );
  const bottomBar = new BottomBar(shell.bottom, tools, state, showError);
  const serviceInfo = new ServiceInfo(shell.left, state, growth, tools, heatmap, showError);
  const mapsPanel = new MapsPanel(shell.left, heatmap);
  installShortcuts(
    tools,
    clock,
    () => hud.toggleHelp(),
    () => sound.toggleMute(),
  );

  if (loaded) toast.show(TEXTS.save.loaded, 'info');
  // En una partida nueva no se anuncia el primer hito; en una cargada, solo los que falten.
  state.announcedMilestone = Math.max(state.announcedMilestone, loaded ? 0 : currentMilestone(state));

  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaMS, MAX_FRAME_MS);
    const days = clock.update(dt);
    let newFires = 0;
    for (let i = 0; i < days; i++) {
      growth.dailyTick();
      newFires += growth.newFires;
    }
    if (days > 0) {
      mapRenderer.refreshPower();
      if (heatmap.mode !== null) heatmap.redraw();
      const m = currentMilestone(state);
      if (m > state.announcedMilestone) {
        state.announcedMilestone = m;
        toast.show(milestoneMessage(m), 'info', 7000);
        sound.play('milestone');
      } else if (newFires > 0) {
        toast.show(TEXTS.fire.started);
        sound.play('fire');
      }
      sound.setAmbient(state.stats.population / SOUND.ambientFullPopulation);
    }
    controls.update(dt);
    camera.apply();
    mapRenderer.cull(camera.viewRect());

    let tile: TileCoord | null = null;
    if (controls.pointer) {
      const w = camera.screenToWorld(controls.pointer.x, controls.pointer.y);
      const t = worldToTile(w.x, w.y);
      if (state.inBounds(t.x, t.y)) tile = t;
    }
    tools.setHover(tile);
    mapRenderer.sync();
    traffic.update(dt, TIME.speeds[clock.speedIndex] ?? 0, camera.zoom >= TRAFFIC.minZoom);
    mapRenderer.gridVisible = tools.tool !== Tool.Select;
    const radius = tools.tool === Tool.Service ? growth.services.radiusOf(tools.serviceType, 1) : 0;
    const sector = tools.sector ? { ...tools.sector, size: state.sectorSize } : null;
    overlay.update(tile, tools.plan, tools.tool === Tool.Demolish, radius, sector);

    const plan = tools.plan;
    const label = plan ? (plan.error ?? (plan.cost < 0 ? `+${formatMoney(-plan.cost)}` : formatMoney(plan.cost))) : null;
    cursorLabel.update(label, controls.pointer?.x ?? 0, controls.pointer?.y ?? 0, !!plan?.error);

    hud.update(tile, camera.zoom, ticker.FPS);
    topBar.update();
    cityPanel.update();
    supplyPanel.update();
    bottomBar.update();
    mapsPanel.update();
    serviceInfo.update();
    budgetPanel.update();
    alerts.update();
  });
}

void start();
