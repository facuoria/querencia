import { Graphics } from 'pixi.js';
import type { CityState } from '../core/cityState';
import type { TileCoord } from '../core/types';
import { COLORS } from '../data/config';
import { tileDiamond } from './iso';

/** Rombo que marca la casilla bajo el cursor. */
export class TileHighlight {
  readonly graphics = new Graphics();
  private current: TileCoord | null = null;

  constructor(private readonly state: CityState) {}

  update(tile: TileCoord | null): void {
    if (tile?.x === this.current?.x && tile?.y === this.current?.y) return;
    this.current = tile ? { ...tile } : null;
    const g = this.graphics;
    g.clear();
    if (!tile) return;
    const color = this.state.isTileUnlocked(tile.x, tile.y) ? COLORS.hoverValid : COLORS.hoverLocked;
    g.poly(tileDiamond(tile.x, tile.y)).fill({ color, alpha: 0.25 }).stroke({ width: 2, color, alpha: 0.9 });
  }
}
