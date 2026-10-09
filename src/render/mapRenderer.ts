import { Container, Graphics } from 'pixi.js';
import type { CityState } from '../core/cityState';
import { hash2 } from '../core/noise';
import { Terrain } from '../core/types';
import { COLORS } from '../data/config';
import type { ViewRect } from './camera';
import { HALF_H, HALF_W, darken, tileDiamond, tileToWorld } from './iso';

/** Margen vertical para que los árboles no desaparezcan antes de salir de pantalla. */
const OBJECT_MARGIN = 48;

interface Chunk {
  sx: number;
  sy: number;
  ground: Graphics;
  objects: Graphics;
  bounds: ViewRect;
}

function pick(colors: readonly number[], x: number, y: number, salt: number): number {
  const i = Math.floor(hash2(x, y, salt) * colors.length);
  return colors[i] ?? colors[0]!;
}

/**
 * Dibuja el terreno por sectores. Cada sector es un bloque de geometría estática
 * y solo se muestran los que intersectan la pantalla.
 */
export class MapRenderer {
  readonly groundLayer = new Container();
  readonly objectLayer = new Container();
  private readonly chunks: Chunk[] = [];

  constructor(private readonly state: CityState) {
    const n = state.sectorsPerSide;
    // Orden por profundidad isométrica: los sectores de atrás primero.
    const order: Array<[number, number]> = [];
    for (let sy = 0; sy < n; sy++) for (let sx = 0; sx < n; sx++) order.push([sx, sy]);
    order.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));

    for (const [sx, sy] of order) {
      const chunk: Chunk = {
        sx,
        sy,
        ground: new Graphics(),
        objects: new Graphics(),
        bounds: this.sectorBounds(sx, sy),
      };
      this.groundLayer.addChild(chunk.ground);
      this.objectLayer.addChild(chunk.objects);
      this.chunks.push(chunk);
      this.drawChunk(chunk);
    }
  }

  /** Vuelve a dibujar un sector, por ejemplo al desbloquearlo. */
  rebuildSector(sx: number, sy: number): void {
    const chunk = this.chunks.find((c) => c.sx === sx && c.sy === sy);
    if (chunk) this.drawChunk(chunk);
  }

  /** Muestra solo los sectores que se ven en pantalla. Devuelve cuántos quedaron visibles. */
  cull(view: ViewRect): number {
    let visible = 0;
    for (const c of this.chunks) {
      const b = c.bounds;
      const on = b.right >= view.left && b.left <= view.right && b.bottom >= view.top && b.top <= view.bottom;
      c.ground.visible = on;
      c.objects.visible = on;
      if (on) visible++;
    }
    return visible;
  }

  private sectorBounds(sx: number, sy: number): ViewRect {
    const s = this.state.sectorSize;
    const x0 = sx * s;
    const y0 = sy * s;
    const top = tileToWorld(x0, y0);
    const right = tileToWorld(x0 + s, y0);
    const bottom = tileToWorld(x0 + s, y0 + s);
    const left = tileToWorld(x0, y0 + s);
    return { left: left.x, right: right.x, top: top.y - OBJECT_MARGIN, bottom: bottom.y };
  }

  private drawChunk(chunk: Chunk): void {
    const { ground, objects, sx, sy } = chunk;
    const state = this.state;
    const s = state.sectorSize;
    const x0 = sx * s;
    const y0 = sy * s;
    const locked = !state.isSectorUnlocked(sx, sy);
    const shade = (c: number): number => (locked ? darken(c, COLORS.lockedDarken) : c);

    ground.clear();
    objects.clear();

    // Recorrido por diagonales para que los objetos de adelante tapen a los de atrás.
    for (let d = 0; d <= 2 * (s - 1); d++) {
      for (let lx = Math.max(0, d - (s - 1)); lx <= Math.min(d, s - 1); lx++) {
        const x = x0 + lx;
        const y = y0 + (d - lx);
        const t = state.getTerrain(x, y);
        const base =
          t === Terrain.Water
            ? pick(COLORS.water, x, y, 11)
            : t === Terrain.Forest
              ? pick(COLORS.forestGround, x, y, 12)
              : pick(COLORS.grass, x, y, 13);
        ground.poly(tileDiamond(x, y)).fill(shade(base));
        if (t === Terrain.Forest) this.drawTrees(objects, x, y, shade);
      }
    }

    // Líneas de grilla en un solo trazo por sector.
    for (let i = 0; i <= s; i++) {
      const a = tileToWorld(x0 + i, y0);
      const b = tileToWorld(x0 + i, y0 + s);
      ground.moveTo(a.x, a.y).lineTo(b.x, b.y);
      const c = tileToWorld(x0, y0 + i);
      const e = tileToWorld(x0 + s, y0 + i);
      ground.moveTo(c.x, c.y).lineTo(e.x, e.y);
    }
    ground.stroke({ width: 1, color: COLORS.gridLine, alpha: COLORS.gridLineAlpha });

    if (locked) {
      const top = tileToWorld(x0, y0);
      const right = tileToWorld(x0 + s, y0);
      const bottom = tileToWorld(x0 + s, y0 + s);
      const left = tileToWorld(x0, y0 + s);
      ground
        .poly([top.x, top.y, right.x, right.y, bottom.x, bottom.y, left.x, left.y])
        .stroke({ width: 2, color: COLORS.lockedBorder, alpha: 0.6 });
    }
  }

  private drawTrees(g: Graphics, x: number, y: number, shade: (c: number) => number): void {
    const center = tileToWorld(x + 0.5, y + 0.5);
    const count = 1 + Math.floor(hash2(x, y, 21) * 2);
    const trees: Array<{ ox: number; oy: number; size: number }> = [];
    for (let i = 0; i < count; i++) {
      trees.push({
        ox: (hash2(x, y, 30 + i) - 0.5) * HALF_W * 0.9,
        oy: (hash2(x, y, 40 + i) - 0.5) * HALF_H * 0.9,
        size: 0.8 + hash2(x, y, 50 + i) * 0.45,
      });
    }
    trees.sort((a, b) => a.oy - b.oy);
    for (const [i, tr] of trees.entries()) {
      const bx = center.x + tr.ox;
      const by = center.y + tr.oy;
      const k = tr.size;
      g.rect(bx - 1.5 * k, by - 6 * k, 3 * k, 6 * k).fill(shade(COLORS.treeTrunk));
      const leaf = shade(pick(COLORS.treeFoliage, x, y, 60 + i));
      g.poly([bx, by - 30 * k, bx + 9 * k, by - 12 * k, bx - 9 * k, by - 12 * k]).fill(leaf);
      g.poly([bx, by - 22 * k, bx + 11 * k, by - 5 * k, bx - 11 * k, by - 5 * k]).fill(leaf);
    }
  }
}
