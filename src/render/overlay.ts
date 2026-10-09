import { Graphics } from 'pixi.js';
import type { CityState } from '../core/cityState';
import type { TileCoord } from '../core/types';
import { COLORS } from '../data/config';
import { TileStatus, type Plan } from '../sim/construction';
import { tileDiamond, tileToWorld } from './iso';

/** Sector marcado al comprar terreno. */
export interface SectorMark {
  sx: number;
  sy: number;
  size: number;
  buyable: boolean;
}

/** Marca la casilla bajo el cursor o las casillas de una construcción en curso. */
export class Overlay {
  readonly graphics = new Graphics();
  private key = '';

  constructor(private readonly state: CityState) {}

  /** radius: si es mayor que 0, se marca el área que cubriría el servicio que se está ubicando. */
  update(hover: TileCoord | null, plan: Plan | null, demolishing: boolean, radius = 0, sector: SectorMark | null = null): void {
    if (sector) {
      this.drawSector(sector);
      return;
    }
    const key = plan
      ? `p${demolishing ? 'd' : 'b'}${radius}${plan.error ?? ''}:${plan.tiles.map((t) => `${t.x},${t.y},${t.status}`).join(';')}`
      : hover
        ? `h${hover.x},${hover.y}`
        : '';
    if (key === this.key) return;
    this.key = key;

    const g = this.graphics;
    g.clear();
    if (plan) {
      const center = plan.tiles[0];
      if (radius > 0 && center) {
        for (let y = center.y - radius; y <= center.y + radius; y++) {
          for (let x = center.x - radius; x <= center.x + radius; x++) {
            if (!this.state.inBounds(x, y) || Math.hypot(x - center.x, y - center.y) > radius) continue;
            g.poly(tileDiamond(x, y)).fill({ color: COLORS.previewRadius, alpha: 0.16 });
          }
        }
      }
      for (const t of plan.tiles) {
        const color =
          t.status === TileStatus.Invalid
            ? COLORS.previewInvalid
            : t.status === TileStatus.Existing
              ? COLORS.previewExisting
              : plan.error
                ? COLORS.previewInvalid
                : demolishing
                  ? COLORS.previewDemolish
                  : COLORS.previewBuild;
        g.poly(tileDiamond(t.x, t.y)).fill({ color, alpha: 0.45 }).stroke({ width: 2, color, alpha: 0.9 });
      }
      return;
    }
    if (hover) {
      const color = this.state.isTileUnlocked(hover.x, hover.y) ? COLORS.hoverValid : COLORS.hoverLocked;
      g.poly(tileDiamond(hover.x, hover.y)).fill({ color, alpha: 0.25 }).stroke({ width: 3, color, alpha: 0.9 });
    }
  }

  private drawSector(m: SectorMark): void {
    const key = `s${m.sx},${m.sy},${m.buyable}`;
    if (key === this.key) return;
    this.key = key;
    const g = this.graphics;
    g.clear();
    const color = m.buyable ? COLORS.sectorBuyable : COLORS.sectorBlocked;
    const x0 = m.sx * m.size;
    const y0 = m.sy * m.size;
    const top = tileToWorld(x0, y0);
    const right = tileToWorld(x0 + m.size, y0);
    const bottom = tileToWorld(x0 + m.size, y0 + m.size);
    const left = tileToWorld(x0, y0 + m.size);
    g.poly([top.x, top.y, right.x, right.y, bottom.x, bottom.y, left.x, left.y])
      .fill({ color, alpha: 0.25 })
      .stroke({ width: 6, color, alpha: 0.9 });
  }
}
