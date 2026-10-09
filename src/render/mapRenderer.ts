import { Container, Graphics, GraphicsContext, Sprite } from 'pixi.js';
import type { CityState } from '../core/cityState';
import { hash2 } from '../core/noise';
import { Road, Terrain, Zone } from '../core/types';
import { COLORS } from '../data/config';
import { HIGHWAY_SPRITES, ROAD_SPRITES, SPRITE_ORIGIN, TERRAIN_SPRITES, TREE_SPRITE } from '../data/sprites';
import { roadMask } from '../sim/roads';
import { tex } from './assets';
import { createBuilding } from './buildingView';
import type { ViewRect } from './camera';
import { HALF_H, HALF_W, tileDiamond, tileToWorld } from './iso';

/** Ancho de cada banda, medido en casillas a lo largo de la diagonal. */
const BAND_WIDTH = 16;
/** Margen hacia arriba para que los edificios altos no se corten antes de salir de pantalla. */
const MARGIN_TOP = 520;
const MARGIN_BOTTOM = 60;

interface Band {
  container: Container;
  bounds: ViewRect;
}

function pick(list: readonly string[], x: number, y: number, salt: number): string {
  return list[Math.floor(hash2(x, y, salt) * list.length)] ?? list[0]!;
}

/**
 * Dibuja terreno, calles, árboles y edificios en el orden correcto de profundidad.
 * Las casillas se agrupan en bandas diagonales (misma x + y) y cada banda se divide
 * en tramos; solo se muestran los tramos que se ven en pantalla.
 */
export class MapRenderer {
  /** Terreno, calles, zonas, árboles y edificios. */
  readonly layer = new Container();
  /** Grilla (solo con una herramienta activa) y contorno de la zona desbloqueada. */
  readonly gridLayer = new Graphics();
  readonly borderLayer = new Graphics();
  private readonly bands: Band[] = [];
  /** Contenedor de cada casilla, por índice. */
  private readonly tiles: Container[] = [];
  private readonly zoneMarks: Record<number, GraphicsContext> = {};

  constructor(private readonly state: CityState) {
    const n = state.size;
    for (const [zone, color] of [
      [Zone.Residential, COLORS.zoneResidential],
      [Zone.Commercial, COLORS.zoneCommercial],
      [Zone.Industrial, COLORS.zoneIndustrial],
    ] as const) {
      this.zoneMarks[zone] = new GraphicsContext()
        .poly(tileDiamond(0, 0))
        .fill({ color, alpha: COLORS.zoneAlpha })
        .poly(tileDiamond(0, 0).map((v, i) => (i % 2 === 0 ? v * 0.8 : v * 0.8 + HALF_H * 0.2)))
        .stroke({ width: 2, color, alpha: 0.9 });
    }

    const segments = Math.ceil((2 * n - 1) / BAND_WIDTH);
    const bandIndex = new Map<number, Band>();
    for (let d = 0; d <= 2 * (n - 1); d++) {
      for (let seg = 0; seg < segments; seg++) {
        const band: Band = { container: new Container(), bounds: this.bandBounds(d, seg) };
        bandIndex.set(d * segments + seg, band);
        this.bands.push(band);
        this.layer.addChild(band.container);
      }
    }
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const seg = Math.floor((x - y + n - 1) / BAND_WIDTH);
        const band = bandIndex.get((x + y) * segments + seg)!;
        const c = new Container();
        band.container.addChild(c);
        this.tiles[y * n + x] = c;
        this.buildTile(x, y);
      }
    }
    this.drawGrid();
    this.drawBorder();
    this.gridLayer.visible = false;
  }

  set gridVisible(v: boolean) {
    this.gridLayer.visible = v;
  }

  /** Aplica los cambios del estado desde el último cuadro. */
  sync(): void {
    for (const idx of this.state.takeChanges()) {
      const x = idx % this.state.size;
      this.buildTile(x, (idx - x) / this.state.size);
    }
  }

  /** Vuelve a dibujar un sector entero, por ejemplo al desbloquearlo. */
  rebuildSector(sx: number, sy: number): void {
    const s = this.state.sectorSize;
    for (let y = sy * s; y < (sy + 1) * s; y++) for (let x = sx * s; x < (sx + 1) * s; x++) this.buildTile(x, y);
    this.drawBorder();
  }

  /** Muestra solo los tramos que se ven en pantalla. Devuelve cuántos quedaron visibles. */
  cull(view: ViewRect): number {
    let visible = 0;
    for (const band of this.bands) {
      const b = band.bounds;
      const on = b.right >= view.left && b.left <= view.right && b.bottom >= view.top && b.top <= view.bottom;
      band.container.visible = on;
      if (on) visible++;
    }
    return visible;
  }

  private buildTile(x: number, y: number): void {
    const st = this.state;
    const c = this.tiles[y * st.size + x]!;
    for (const child of c.removeChildren()) child.destroy({ children: true });
    c.tint = st.isTileUnlocked(x, y) ? 0xffffff : COLORS.lockedTint;

    const top = tileToWorld(x, y);
    const ground = new Sprite(tex(this.groundSprite(x, y)));
    ground.position.set(top.x - SPRITE_ORIGIN.x, top.y - SPRITE_ORIGIN.y);
    c.addChild(ground);

    const zone = st.getZone(x, y);
    const level = st.getLevel(x, y);
    if (zone !== Zone.None && level === 0) {
      const mark = new Graphics(this.zoneMarks[zone]);
      mark.position.set(top.x, top.y);
      c.addChild(mark);
    }
    if (level > 0) {
      c.addChild(createBuilding(zone, level, x, y));
      return;
    }
    if (st.getTerrain(x, y) === Terrain.Forest && st.getRoad(x, y) === Road.None) this.addTrees(c, x, y);
  }

  private groundSprite(x: number, y: number): string {
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

  /** Árboles de una casilla de bosque, ordenados de atrás hacia adelante. */
  private addTrees(c: Container, x: number, y: number): void {
    const center = tileToWorld(x + 0.5, y + 0.5);
    const count = 2 + Math.floor(hash2(x, y, 21) * 3);
    const trees: Array<{ px: number; py: number; i: number }> = [];
    for (let i = 0; i < count; i++) {
      // Posición al azar dentro del rombo, en coordenadas de casilla.
      const u = 0.15 + hash2(x, y, 30 + i) * 0.7 - 0.5;
      const v = 0.15 + hash2(x, y, 40 + i) * 0.7 - 0.5;
      trees.push({ px: center.x + (u - v) * HALF_W, py: center.y + (u + v) * HALF_H, i });
    }
    trees.sort((a, b) => a.py - b.py);
    const texture = tex(TREE_SPRITE);
    const tints = COLORS.treeTints;
    for (const t of trees) {
      const sp = new Sprite(texture);
      sp.anchor.set(0.5, 0.95);
      sp.position.set(t.px, t.py);
      sp.scale.set(0.9 + hash2(x, y, 50 + t.i) * 0.5);
      sp.tint = tints[Math.floor(hash2(x, y, 60 + t.i) * tints.length)] ?? 0xffffff;
      c.addChild(sp);
    }
  }

  private drawGrid(): void {
    const g = this.gridLayer;
    const n = this.state.size;
    for (let i = 0; i <= n; i++) {
      const a = tileToWorld(i, 0);
      const b = tileToWorld(i, n);
      g.moveTo(a.x, a.y).lineTo(b.x, b.y);
      const c = tileToWorld(0, i);
      const e = tileToWorld(n, i);
      g.moveTo(c.x, c.y).lineTo(e.x, e.y);
    }
    g.stroke({ width: 1, color: COLORS.gridLine, alpha: COLORS.gridLineAlpha });
  }

  private drawBorder(): void {
    const g = this.borderLayer;
    const st = this.state;
    const n = st.sectorsPerSide;
    const s = st.sectorSize;
    const open = (sx: number, sy: number): boolean =>
      sx >= 0 && sy >= 0 && sx < n && sy < n && st.isSectorUnlocked(sx, sy);
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

  private bandBounds(d: number, seg: number): ViewRect {
    const n = this.state.size;
    const xmyMin = seg * BAND_WIDTH - (n - 1);
    const xmyMax = xmyMin + BAND_WIDTH - 1;
    return {
      left: xmyMin * HALF_W - HALF_W,
      right: xmyMax * HALF_W + HALF_W,
      top: d * HALF_H - MARGIN_TOP,
      bottom: d * HALF_H + 2 * HALF_H + MARGIN_BOTTOM,
    };
  }
}
