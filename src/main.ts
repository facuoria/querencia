import { Application, Container } from 'pixi.js';
import { CityState } from './core/cityState';
import { generateMap, startCenter } from './core/mapGen';
import type { TileCoord } from './core/types';
import { COLORS } from './data/config';
import { CameraControls } from './input/cameraControls';
import { installShortcuts } from './input/shortcuts';
import { Tool, ToolController } from './input/tools';
import { loadAssets } from './render/assets';
import { Camera } from './render/camera';
import { tileToWorld, worldToTile } from './render/iso';
import { Heatmap } from './render/heatmap';
import { MapRenderer } from './render/mapRenderer';
import { Overlay } from './render/overlay';
import { GameClock } from './sim/clock';
import { GrowthSim } from './sim/growth';
import { Alerts } from './ui/alerts';
import { BudgetPanel } from './ui/budgetPanel';
import { DemandPanel } from './ui/demandPanel';
import { Hud } from './ui/hud';
import { MapsPanel, ServiceBar, ServiceInfo } from './ui/servicePanels';
import { CursorLabel, Toast } from './ui/toast';
import { Toolbar } from './ui/toolbar';
import { TopBar, formatMoney } from './ui/topBar';
import './ui/styles.css';

/** Tope de tiempo por cuadro, para que volver a una pestaña inactiva no adelante días de golpe. */
const MAX_FRAME_MS = 250;

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
  await loadAssets();

  const state = new CityState();
  generateMap(state);
  const clock = new GameClock(state);
  const growth = new GrowthSim(state);
  growth.refresh();
  // Solo en desarrollo: acceso desde la consola del navegador para probar.
  if (import.meta.env.DEV) Object.assign(window, { city: { state, growth } });

  const world = new Container();
  const mapRenderer = new MapRenderer(state, (x, y) => {
    growth.network.update();
    return growth.services.isWorking(x, y);
  });
  const heatmap = new Heatmap(state, growth);
  const overlay = new Overlay(state);
  world.addChild(
    mapRenderer.layer,
    heatmap.graphics,
    mapRenderer.gridLayer,
    mapRenderer.borderLayer,
    overlay.graphics,
  );
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

  const uiRoot = document.createElement('div');
  uiRoot.id = 'ui';
  document.body.appendChild(uiRoot);
  const hud = new Hud(uiRoot, state, growth);
  const demandPanel = new DemandPanel(uiRoot, state);
  const budgetPanel = new BudgetPanel(uiRoot, state, () => growth.refresh());
  const topBar = new TopBar(uiRoot, state, clock, () => budgetPanel.toggle());
  const alerts = new Alerts(uiRoot, state, growth);
  const toast = new Toast(uiRoot);
  const cursorLabel = new CursorLabel(uiRoot);

  const controls = new CameraControls(app.canvas, camera, recenter);
  const tools = new ToolController(
    app.canvas,
    state,
    (msg) => toast.show(msg),
    () => {
      growth.refresh();
      heatmap.redraw();
    },
  );
  const toolbar = new Toolbar(uiRoot, tools);
  const serviceBar = new ServiceBar(uiRoot, tools);
  const mapsPanel = new MapsPanel(uiRoot, growth, heatmap);
  const serviceInfo = new ServiceInfo(uiRoot, state, growth, tools, heatmap, (msg) => toast.show(msg));
  installShortcuts(tools, clock);

  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaMS, MAX_FRAME_MS);
    const days = clock.update(dt);
    for (let i = 0; i < days; i++) growth.dailyTick();
    if (days > 0 && heatmap.mode !== null) heatmap.redraw();
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
    mapRenderer.gridVisible = tools.tool !== Tool.Select;
    const radius = tools.tool === Tool.Service ? growth.services.radiusOf(tools.serviceType, 1) : 0;
    overlay.update(tile, tools.plan, tools.tool === Tool.Demolish, radius);

    const plan = tools.plan;
    const label = plan ? (plan.error ?? (plan.cost < 0 ? `+${formatMoney(-plan.cost)}` : formatMoney(plan.cost))) : null;
    cursorLabel.update(label, controls.pointer?.x ?? 0, controls.pointer?.y ?? 0, !!plan?.error);

    hud.update(tile, camera.zoom, ticker.FPS);
    topBar.update();
    demandPanel.update();
    toolbar.update();
    serviceBar.update();
    mapsPanel.update();
    serviceInfo.update();
    budgetPanel.update();
    alerts.update();
  });
}

void start();
