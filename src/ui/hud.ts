import type { CityState } from '../core/cityState';
import { Road, Terrain, Zone, type TileCoord } from '../core/types';
import { TEXTS } from '../data/texts';
import { capacityOf } from '../sim/capacity';
import type { GrowthSim } from '../sim/growth';

const TERRAIN_NAMES: Record<Terrain, string> = {
  [Terrain.Grass]: TEXTS.terrain.grass,
  [Terrain.Water]: TEXTS.terrain.water,
  [Terrain.Forest]: TEXTS.terrain.forest,
};

const ZONE_NAMES: Record<Zone, string> = {
  [Zone.None]: '',
  [Zone.Residential]: TEXTS.zones.residential,
  [Zone.Commercial]: TEXTS.zones.commercial,
  [Zone.Industrial]: TEXTS.zones.industrial,
};

/** Panel de información de la casilla bajo el cursor. Solo lee el estado. */
export class Hud {
  private readonly info: HTMLDivElement;
  private readonly help: HTMLDivElement;
  private lastText = '';

  constructor(
    parent: HTMLElement,
    private readonly state: CityState,
    private readonly growth: GrowthSim,
  ) {
    const panel = document.createElement('div');
    panel.className = 'hud-panel hud-info';
    const title = document.createElement('h1');
    title.textContent = TEXTS.title;
    this.info = document.createElement('div');
    panel.append(title, this.info);

    const help = document.createElement('div');
    help.className = 'hud-panel hud-help';
    help.style.display = 'none';
    this.help = help;
    for (const line of TEXTS.help) {
      const p = document.createElement('div');
      p.textContent = line;
      help.append(p);
    }
    parent.append(panel, help);
  }

  toggleHelp(): void {
    this.help.style.display = this.help.style.display === 'none' ? 'block' : 'none';
  }

  update(tile: TileCoord | null, zoom: number, fps: number): void {
    const h = TEXTS.hud;
    const z = TEXTS.zones;
    const st = this.state;
    const lines: string[] = [];
    if (tile) {
      const { x, y } = tile;
      const sector = st.sectorOf(x, y);
      const locked = !st.isSectorUnlocked(sector.x, sector.y);
      const road = st.getRoad(x, y);
      const zone = st.getZone(x, y);
      const level = st.getLevel(x, y);
      lines.push(`${h.tile}: ${x}, ${y}`);
      if (road === Road.Highway) lines.push(TEXTS.road.highway);
      else if (road === Road.Street) lines.push(TEXTS.road.street);
      else if (zone !== Zone.None) {
        if (level === 0) lines.push(`${ZONE_NAMES[zone]} · ${z.emptyLot}`);
        else {
          const cap = capacityOf(zone, level);
          const unit = zone === Zone.Residential ? z.residents : z.jobs;
          lines.push(`${ZONE_NAMES[zone]} · ${z.level} ${level} · ${cap} ${unit}`);
        }
        if (!this.growth.network.hasAccess(x, y)) lines.push(`⚠ ${z.noAccess}`);
        lines.push(`${z.landValue}: ${Math.round(this.growth.landValue[st.index(x, y)]! * 100)}%`);
        if (zone === Zone.Residential) {
          const p = this.growth.happiness.partsAt(x, y);
          const hp = TEXTS.happinessParts;
          const f = (v: number): string => (v > 0 ? `+${Math.round(v)}` : String(Math.round(v)));
          lines.push(`${z.happiness}: ${Math.round(p.total)}`);
          lines.push(`  ${hp.services} ${f(p.services)} · ${hp.economy} ${f(p.economy)}`);
          lines.push(`  ${hp.environment} ${f(p.environment)} · ${hp.safety} ${f(p.safety)}`);
        }
      } else lines.push(`${h.terrain}: ${TERRAIN_NAMES[st.getTerrain(x, y)]}`);
      const pop = Math.round(st.sectorPopulation[sector.y * st.sectorsPerSide + sector.x]!);
      lines.push(
        locked
          ? `${h.sector} ${sector.x}, ${sector.y} (${h.locked})`
          : `${TEXTS.stats.neighborhood} ${sector.x}, ${sector.y}: ${pop.toLocaleString('es-AR')} ${z.residents} · ${TEXTS.stats.happiness} ${Math.round(st.sectorHappiness[sector.y * st.sectorsPerSide + sector.x]!)}`,
      );
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
