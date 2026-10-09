// Vista de prueba TEMPORAL para revisar los autos (solo en desarrollo): abrir con ?prueba=vehiculos.
// Muestra un auto de cada tipo de carrocería en las cuatro direcciones, sobre calles reales,
// usando las mismas funciones que el tráfico del juego. Se puede borrar cuando ya no haga falta.

import { Application, Container, Graphics, Sprite, Text } from 'pixi.js';
import { TRAFFIC } from '../data/config';
import { CAR_ANCHOR, CAR_MODELS, ROAD_SPRITES, SPRITE_ORIGIN } from '../data/sprites';
import { loadAssets, tex } from '../render/assets';
import { tileToWorld } from '../render/iso';
import { carFrame, frameFor, travelPoint } from '../render/traffic';

/** Todos los autos civiles (5 colores x 6 carrocerías). */
const MODELS = CAR_MODELS;

/** Las cuatro direcciones: de qué casilla a cuál va el auto, y por qué calle. */
const CASES = [
  { from: [1, 0], to: [2, 0], axis: 'x' },
  { from: [1, 0], to: [0, 0], axis: 'x' },
  { from: [0, 1], to: [0, 2], axis: 'y' },
  { from: [0, 1], to: [0, 0], axis: 'y' },
] as const;

export async function runVehicleTest(app: Application): Promise<void> {
  await loadAssets();
  const css = getComputedStyle(document.documentElement);
  const ink = css.getPropertyValue('--ink').trim();
  const accent = css.getPropertyValue('--accent').trim();
  const cellW = 330;
  const cellH = 165;
  // 30 modelos en dos bloques de 15 filas, achicados para que entren en pantalla.
  const root = new Container();
  root.position.set(20, 50);
  root.scale.set(0.42);
  app.stage.addChild(root);

  const title = new Text({
    text: 'Prueba de vehículos: cada fila es un modelo; cada columna, una dirección (flecha = sentido de marcha)',
    style: { fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 16, fill: ink },
  });
  title.position.set(40, 18);
  app.stage.addChild(title);

  MODELS.forEach((model, row) => {
    CASES.forEach((c, col) => {
      const cell = new Container();
      const block = Math.floor(row / 15);
      cell.position.set((block * 4 + col) * cellW + cellW / 2, (row % 15) * cellH + 30);
      root.addChild(cell);

      // Tres casillas de calle recta en el eje del caso.
      const mask = c.axis === 'x' ? 5 : 10;
      for (let k = 0; k < 3; k++) {
        const [tx, ty] = c.axis === 'x' ? [k, 0] : [0, k];
        const p = tileToWorld(tx, ty);
        const road = new Sprite(tex(ROAD_SPRITES[mask]!));
        road.position.set(p.x - SPRITE_ORIGIN.x, p.y - SPRITE_ORIGIN.y);
        cell.addChild(road);
      }
      const [fx, fy] = c.from;
      const [nx, ny] = c.to;
      const pos = travelPoint(fx, fy, nx, ny, 0, TRAFFIC.laneOffset);
      const ahead = travelPoint(fx, fy, nx, ny, 0.45, TRAFFIC.laneOffset);
      const arrow = new Graphics()
        .moveTo(pos.x, pos.y)
        .lineTo(ahead.x, ahead.y)
        .stroke({ width: 2, color: accent });
      const ang = Math.atan2(ahead.y - pos.y, ahead.x - pos.x);
      arrow
        .poly([
          ahead.x,
          ahead.y,
          ahead.x - 9 * Math.cos(ang - 0.45),
          ahead.y - 9 * Math.sin(ang - 0.45),
          ahead.x - 9 * Math.cos(ang + 0.45),
          ahead.y - 9 * Math.sin(ang + 0.45),
        ])
        .fill(accent);
      cell.addChild(arrow);
      const car = new Sprite(tex(carFrame(model, nx - fx, ny - fy)));
      car.anchor.set(CAR_ANCHOR.x, CAR_ANCHOR.y);
      car.scale.set(TRAFFIC.carScale);
      car.position.set(pos.x, pos.y);
      cell.addChild(car);
      const label = new Text({
        text: `${model} · ${frameFor(nx - fx, ny - fy)}`,
        style: { fontFamily: 'IBM Plex Mono, monospace', fontSize: 22, fill: ink },
      });
      label.position.set(-cellW / 2 + 10, -22);
      cell.addChild(label);
    });
  });
}
