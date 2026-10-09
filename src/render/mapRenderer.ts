import { Container, Graphics, Sprite } from 'pixi.js';
import type { CityState } from '../core/cityState';
import { hash2 } from '../core/noise';
import { Road, Terrain } from '../core/types';
import { COLORS } from '../data/config';
import { HIGHWAY_SPRITES, ROAD_SPRITES, SPRITE_ORIGIN, TERRAIN_SPRITES, TREE_SPRITE } from '../data/sprites';
import { roadMask } from '../sim/roads';
import { tex } from './assets';
import type { ViewRect } from './camera';
import { HALF_H, HALF_W, tileToWorld } from './iso';

/** Margen para que los árboles y el espesor de las casillas no se corten antes de salir de pantalla. */
const MARGIN_TOP = 80;
const MARGIN_BOTTOM = 40;

interface Chunk {
  sx: number;
  sy: number;
  ground: Container;
  objects: Container;
  grid: Graphics;
  /** Sprite de cada casilla del sector, indexado por y local * tamaño + x local. */
  tiles: Sprite[];
  bounds: ViewRect;
}

function pick(list: readonly string[], x: number, y: number, salt: number): string {
  const i = Math.floor(hash2(x, y, salt) * list.length);
  return list[i] ?? list[0]!;
}

/**
 * Dibuja el terreno y las calles por sectores. Solo se muestran los sectores
 * que intersectan la pantalla.
 */
export class MapRenderer {
  readonly groundLayer = new Container();
  readonly gridLayer = new Container();
  readonly objectLayer = new Container();
  /** Contorno de la zona desbloqueada. */
  readonly borderLayer = new Graphics();
  private readonly chunks: Chunk[] = [];
  private readonly chunkByIndex: Chunk[] = [];

  constructor(private readonly state: CityState) {
    const n = state.sectorsPerSide;
    // Orden por profundidad isométrica: los sectores de atrás primero.
    const order: Array<[number, number]> = [];
    for (let sy = 0; sy < n; sy++) for (let sx = 0; sx < n; sx++) order.push([sx, sy]);
    order.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));

    for (const [sx, sy] of order) {
      const chunk = this.createChunk(sx, sy);
      this.groundLayer.addChild(chunk.ground);
      this.gridLayer.addChild(chunk.grid);
      this.objectLayer.addChild(chunk.objects);
      this.chunks.push(chunk);
      this.chunkByIndex[sy * n + sx] = chunk;
    }
    this.gridLayer.visible = false;
    this.drawBorder();
  }

  set gridVisible(v: boolean) {
    this.gridLayer.visible = v;
  }

  /** Aplica los cambios del estado desde el último cuadro. */
  sync(): void {
    const changes = this.state.takeChanges();
    if (changes.length === 0) return;
    const touched = new Set<Chunk>();
    for (const idx of changes) {
      const x = idx % this.state.size;
      const y = Math.floor(idx / this.state.size);
      const chunk = this.chunkAt(x, y);
      this.updateTile(chunk, x, y);
      touched.add(chunk);
    }
    for (const c of touched) this.buildObjects(c);
  }

  /** Vuelve a dibujar un sector entero, por ejemplo al desbloquearlo. */
  rebuildSector(sx: number, sy: number): void {
    const chunk = this.chunkByIndex[sy * this.state.sectorsPerSide + sx];
    if (!chunk) return;
    const s = this.state.sectorSize;
    for (let ly = 0; ly < s; ly++) for (let lx = 0; lx < s; lx++) this.updateTile(chunk, sx * s + lx, sy * s + ly);
    this.buildObjects(chunk);
    this.drawBorder();
  }

  /** Muestra solo los sectores que se ven en pantalla. Devuelve cuántos quedaron visibles. */
  cull(view: ViewRect): number {
    let visible = 0;
    for (const c of this.chunks) {
      const b = c.bounds;
      const on = b.right >= view.left && b.left <= view.right && b.bottom >= view.top && b.top <= view.bottom;
      c.ground.visible = on;
      c.objects.visible = on;
      c.grid.visible = on;
      if (on) visible++;
    }
    return visible;
  }

  private chunkAt(x: number, y: number): Chunk {
    const s = this.state.sectorSize;
    return this.chunkByIndex[Math.floor(y / s) * this.state.sectorsPerSide + Math.floor(x / s)]!;
  }

  private createChunk(sx: number, sy: number): Chunk {
    const s = this.state.sectorSize;
    const x0 = sx * s;
    const y0 = sy * s;
    const chunk: Chunk = {
      sx,
      sy,
      ground: new Container(),
      objects: new Container(),
      grid: new Graphics(),
      tiles: new Array<Sprite>(s * s),
      bounds: this.sectorBounds(sx, sy),
    };
    // Se agregan por diagonales para que las casillas de adelante tapen el espesor de las de atrás.
    for (let d = 0; d <= 2 * (s - 1); d++) {
      for (let lx = Math.max(0, d - (s - 1)); lx <= Math.min(d, s - 1); lx++) {
        const ly = d - lx;
        const sprite = new Sprite();
        const p = tileToWorld(x0 + lx, y0 + ly);
        sprite.position.set(p.x - SPRITE_ORIGIN.x, p.y - SPRITE_ORIGIN.y);
        chunk.tiles[ly * s + lx] = sprite;
        chunk.ground.addChild(sprite);
      }
    }
    for (let ly = 0; ly < s; ly++) for (let lx = 0; lx < s; lx++) this.updateTile(chunk, x0 + lx, y0 + ly);
    this.buildObjects(chunk);
    this.drawGrid(chunk);
    return chunk;
  }

  private updateTile(chunk: Chunk, x: number, y: number): void {
    const s = this.state.sectorSize;
    const sprite = chunk.tiles[(y - chunk.sy * s) * s + (x - chunk.sx * s)]!;
    sprite.texture = tex(this.tileSpriteName(x, y));
    sprite.tint = this.state.isSectorUnlocked(chunk.sx, chunk.sy) ? 0xffffff : COLORS.lockedTint;
  }

  private tileSpriteName(x: number, y: number): string {
    const road = this.state.getRoad(x, y);
    if (road !== Road.None) {
      const mask = roadMask(this.state, x, y);
      if (road === Road.Highway) {
        const hw = HIGHWAY_SPRITES[mask];
        if (hw) return hw;
      }
      return ROAD_SPRITES[mask] ?? ROAD_SPRITES[0]!;
    }
    if (this.state.getTerrain(x, y) === Terrain.Water) return pick(TERRAIN_SPRITES.water, x, y, 11);
    return pick(TERRAIN_SPRITES.grass, x, y, 13);
  }

  /** Árboles del sector, ordenados de atrás hacia adelante. */
  private buildObjects(chunk: Chunk): void {
    for (const child of chunk.objects.removeChildren()) child.destroy();
    const state = this.state;
    const s = state.sectorSize;
    const x0 = chunk.sx * s;
    const y0 = chunk.sy * s;
    const tint = state.isSectorUnlocked(chunk.sx, chunk.sy) ? null : COLORS.lockedTint;
    const trees: Array<{ x: number; y: number; depth: number; tint: number; scale: number }> = [];

    for (let ly = 0; ly < s; ly++) {
      for (let lx = 0; lx < s; lx++) {
        const x = x0 + lx;
        const y = y0 + ly;
        if (state.getTerrain(x, y) !== Terrain.Forest || state.getRoad(x, y) !== Road.None) continue;
        const center = tileToWorld(x + 0.5, y + 0.5);
        const count = 2 + Math.floor(hash2(x, y, 21) * 3);
        for (let i = 0; i < count; i++) {
          // Posición al azar dentro del rombo, en coordenadas de casilla.
          const u = 0.15 + hash2(x, y, 30 + i) * 0.7 - 0.5;
          const v = 0.15 + hash2(x, y, 40 + i) * 0.7 - 0.5;
          const px = center.x + (u - v) * HALF_W;
          const py = center.y + (u + v) * HALF_H;
          const tints = COLORS.treeTints;
          trees.push({
            x: px,
            y: py,
            depth: py,
            tint: tint ?? tints[Math.floor(hash2(x, y, 60 + i) * tints.length)] ?? 0xffffff,
            scale: 0.9 + hash2(x, y, 50 + i) * 0.5,
          });
        }
      }
    }
    trees.sort((a, b) => a.depth - b.depth);
    const texture = tex(TREE_SPRITE);
    for (const t of trees) {
      const sp = new Sprite(texture);
      sp.anchor.set(0.5, 0.95);
      sp.position.set(t.x, t.y);
      sp.scale.set(t.scale);
      sp.tint = t.tint;
      chunk.objects.addChild(sp);
    }
  }

  private drawBorder(): void {
    const g = this.borderLayer;
    const st = this.state;
    const n = st.sectorsPerSide;
    const s = st.sectorSize;
    const open = (sx: number, sy: number): boolean => sx >= 0 && sy >= 0 && sx < n && sy < n && st.isSectorUnlocked(sx, sy);
    const line = (ax: number, ay: number, bx: number, by: number): void => {
      const a = tileToWorld(ax * s, ay * s);
      const b = tileToWorld(bx * s, by * s);
      g.moveTo(a.x, a.y).lineTo(b.x, b.y);
    };
    g.clear();
    for (let sy = 0; sy < n; sy++) {
      for (let sx = 0; sx < n; sx++) {
        if (!open(sx, sy)) continue;
        if (!open(sx - 1, sy)) line(sx, sy, sx, sy + 1);
        if (!open(sx + 1, sy)) line(sx + 1, sy, sx + 1, sy + 1);
        if (!open(sx, sy - 1)) line(sx, sy, sx + 1, sy);
        if (!open(sx, sy + 1)) line(sx, sy + 1, sx + 1, sy + 1);
      }
    }
    g.stroke({ width: 4, color: COLORS.unlockedBorder, alpha: 0.8 });
  }

  private drawGrid(chunk: Chunk): void {
    const g = chunk.grid;
    const s = this.state.sectorSize;
    const x0 = chunk.sx * s;
    const y0 = chunk.sy * s;
    g.clear();
    for (let i = 0; i <= s; i++) {
      const a = tileToWorld(x0 + i, y0);
      const b = tileToWorld(x0 + i, y0 + s);
      g.moveTo(a.x, a.y).lineTo(b.x, b.y);
      const c = tileToWorld(x0, y0 + i);
      const e = tileToWorld(x0 + s, y0 + i);
      g.moveTo(c.x, c.y).lineTo(e.x, e.y);
    }
    g.stroke({ width: 1, color: COLORS.gridLine, alpha: COLORS.gridLineAlpha });
  }

  private sectorBounds(sx: number, sy: number): ViewRect {
    const s = this.state.sectorSize;
    const x0 = sx * s;
    const y0 = sy * s;
    const top = tileToWorld(x0, y0);
    const right = tileToWorld(x0 + s, y0);
    const bottom = tileToWorld(x0 + s, y0 + s);
    const left = tileToWorld(x0, y0 + s);
    return { left: left.x, right: right.x, top: top.y - MARGIN_TOP, bottom: bottom.y + MARGIN_BOTTOM };
  }
}
