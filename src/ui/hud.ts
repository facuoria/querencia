import type { CityState } from '../core/cityState';
import { Terrain, type TileCoord } from '../core/types';
import { TEXTS } from '../data/texts';

const TERRAIN_NAMES: Record<Terrain, string> = {
  [Terrain.Grass]: TEXTS.terrain.grass,
  [Terrain.Water]: TEXTS.terrain.water,
  [Terrain.Forest]: TEXTS.terrain.forest,
};

/** Panel de información en HTML encima del canvas. Solo lee el estado. */
export class Hud {
  private readonly info: HTMLDivElement;
  private lastText = '';

  constructor(parent: HTMLElement, private readonly state: CityState) {
    const panel = document.createElement('div');
    panel.className = 'hud-panel hud-info';
    const title = document.createElement('h1');
    title.textContent = TEXTS.title;
    this.info = document.createElement('div');
    panel.append(title, this.info);

    const help = document.createElement('div');
    help.className = 'hud-panel hud-help';
    for (const line of TEXTS.help) {
      const p = document.createElement('div');
      p.textContent = line;
      help.append(p);
    }
    parent.append(panel, help);
  }

  update(tile: TileCoord | null, zoom: number, fps: number): void {
    const h = TEXTS.hud;
    const lines: string[] = [];
    if (tile) {
      const sector = this.state.sectorOf(tile.x, tile.y);
      const locked = !this.state.isSectorUnlocked(sector.x, sector.y);
      lines.push(`${h.tile}: ${tile.x}, ${tile.y}`);
      lines.push(`${h.terrain}: ${TERRAIN_NAMES[this.state.getTerrain(tile.x, tile.y)]}`);
      lines.push(`${h.sector}: ${sector.x}, ${sector.y} (${locked ? h.locked : h.unlocked})`);
    } else {
      lines.push(h.noTile);
    }
    lines.push(`${h.zoom}: ${zoom.toFixed(2)}x · ${h.fps}: ${Math.round(fps)}`);
    const text = lines.join('\n');
    if (text === this.lastText) return;
    this.lastText = text;
    this.info.textContent = text;
  }
}
