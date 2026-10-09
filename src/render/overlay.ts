import { Graphics } from 'pixi.js';
import type { CityState } from '../core/cityState';
import type { TileCoord } from '../core/types';
import { COLORS } from '../data/config';
import { TileStatus, type Plan } from '../sim/construction';
import { tileDiamond } from './iso';

/** Marca la casilla bajo el cursor o las casillas de una construcción en curso. */
export class Overlay {
  readonly graphics = new Graphics();
  private key = '';

  constructor(private readonly state: CityState) {}

  update(hover: TileCoord | null, plan: Plan | null, demolishing: boolean): void {
    const key = plan
      ? `p${demolishing ? 'd' : 'b'}${plan.error ?? ''}:${plan.tiles.map((t) => `${t.x},${t.y},${t.status}`).join(';')}`
      : hover
        ? `h${hover.x},${hover.y}`
        : '';
    if (key === this.key) return;
    this.key = key;

    const g = this.graphics;
    g.clear();
    if (plan) {
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
}
