import { Application, Container } from 'pixi.js';
import { CityState } from './core/cityState';
import { generateMap } from './core/mapGen';
import { COLORS, MAP } from './data/config';
import { CameraControls } from './input/cameraControls';
import { Camera } from './render/camera';
import { TileHighlight } from './render/highlight';
import { tileToWorld, worldToTile } from './render/iso';
import { MapRenderer } from './render/mapRenderer';
import { Hud } from './ui/hud';
import './ui/styles.css';

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

  const state = new CityState();
  generateMap(state);

  const world = new Container();
  const mapRenderer = new MapRenderer(state);
  const highlight = new TileHighlight(state);
  world.addChild(mapRenderer.groundLayer, highlight.graphics, mapRenderer.objectLayer);
  app.stage.addChild(world);

  // La cámara puede moverse dentro del rombo que ocupa el mapa.
  const size = state.size;
  const camera = new Camera(world, app.screen, {
    left: tileToWorld(0, size).x,
    right: tileToWorld(size, 0).x,
    top: tileToWorld(0, 0).y,
    bottom: tileToWorld(size, size).y,
  });

  // Centro del bloque de sectores iniciales.
  const recenter = (): void => {
    const s = state.sectorSize;
    const xs = MAP.initialSectors.map(([sx]) => sx);
    const ys = MAP.initialSectors.map(([, sy]) => sy);
    const cx = ((Math.min(...xs) + Math.max(...xs) + 1) * s) / 2;
    const cy = ((Math.min(...ys) + Math.max(...ys) + 1) * s) / 2;
    const c = tileToWorld(cx, cy);
    camera.centerOn(c.x, c.y);
  };
  recenter();

  const controls = new CameraControls(app.canvas, camera, recenter);

  const uiRoot = document.createElement('div');
  uiRoot.id = 'ui';
  document.body.appendChild(uiRoot);
  const hud = new Hud(uiRoot, state);

  app.ticker.add((ticker) => {
    controls.update(ticker.deltaMS);
    camera.apply();
    mapRenderer.cull(camera.viewRect());

    let tile = null;
    if (controls.pointer) {
      const w = camera.screenToWorld(controls.pointer.x, controls.pointer.y);
      const t = worldToTile(w.x, w.y);
      if (state.inBounds(t.x, t.y)) tile = t;
    }
    highlight.update(tile);
    hud.update(tile, camera.zoom, ticker.FPS);
  });
}

void start();
