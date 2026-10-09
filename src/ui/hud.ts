import type { CityState } from '../core/cityState';
import { Road, ServiceType, Terrain, Zone, type TileCoord } from '../core/types';
import { SERVICES } from '../data/services';
import { TEXTS } from '../data/texts';
import { capacityOf } from '../sim/capacity';
import type { GrowthSim } from '../sim/growth';
import { icon } from './icons';
import { panel } from './shell';

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

interface Row {
  label: string;
  value: string;
  state?: 'good' | 'warn' | 'bad';
}

function signed(v: number): string {
  const r = Math.round(v);
  return r > 0 ? `+${r}` : String(r);
}

/** Panel de la casilla bajo el cursor y ayuda de controles. Solo lee el estado. */
export class Hud {
  private readonly title: HTMLHeadingElement;
  private readonly rows: HTMLDivElement;
  private readonly warning: HTMLDivElement;
  private readonly footer: HTMLDivElement;
  private readonly help: HTMLElement;
  private last = '';

  constructor(
    parent: HTMLElement,
    private readonly state: CityState,
    private readonly growth: GrowthSim,
  ) {
    const info = panel('info-panel');
    this.title = document.createElement('h2');
    this.title.className = 'panel-title';
    this.rows = document.createElement('div');
    this.warning = document.createElement('div');
    this.warning.className = 'inline-alert';
    this.warning.dataset.state = 'warn';
    this.footer = document.createElement('div');
    this.footer.className = 'caption mono';
    info.body.append(this.title, this.rows, this.warning, this.footer);

    const help = panel('help-panel', TEXTS.helpTitle);
    for (const line of TEXTS.help) {
      const p = document.createElement('div');
      p.className = 'help-line';
      p.textContent = line;
      help.body.append(p);
    }
    help.el.style.display = 'none';
    this.help = help.el;
    parent.append(info.el, help.el);
  }

  toggleHelp(): void {
    this.help.style.display = this.help.style.display === 'none' ? '' : 'none';
  }

  update(tile: TileCoord | null, zoom: number, fps: number): void {
    const h = TEXTS.hud;
    const z = TEXTS.zones;
    const st = this.state;
    let title: string = h.noTile;
    const rows: Row[] = [];
    let warning = '';
    if (tile) {
      const { x, y } = tile;
      const i = st.index(x, y);
      const sector = st.sectorOf(x, y);
      const s = sector.y * st.sectorsPerSide + sector.x;
      const locked = !st.isSectorUnlocked(sector.x, sector.y);
      const road = st.getRoad(x, y);
      const zone = st.getZone(x, y);
      const level = st.getLevel(x, y);
      const service = st.getService(x, y);
      if (road === Road.Highway) title = TEXTS.road.highway;
      else if (road === Road.Street) title = TEXTS.road.street;
      else if (service !== ServiceType.None) {
        title = `${SERVICES[service].name} · ${z.level} ${st.getServiceLevel(x, y)}`;
        if (!this.growth.services.isWorking(x, y)) warning = TEXTS.services.noAccess;
      } else if (zone !== Zone.None) {
        title = level === 0 ? `${ZONE_NAMES[zone]} · ${z.emptyLot}` : `${ZONE_NAMES[zone]} · ${z.level} ${level}`;
        if (level > 0) {
          const unit = zone === Zone.Residential ? z.residents : z.jobs;
          rows.push({ label: unit.charAt(0).toUpperCase() + unit.slice(1), value: String(capacityOf(zone, level)) });
        }
        const lv = Math.round(this.growth.landValue[i]! * 100);
        rows.push({ label: z.landValue, value: `${lv}%` });
        if (zone === Zone.Residential) {
          const p = this.growth.happiness.partsAt(x, y);
          const hp = TEXTS.happinessParts;
          const total = Math.round(p.total);
          rows.push({ label: z.happiness, value: String(total), state: total >= 55 ? 'good' : total >= 35 ? 'warn' : 'bad' });
          rows.push({ label: `· ${hp.services}`, value: signed(p.services) });
          rows.push({ label: `· ${hp.economy}`, value: signed(p.economy) });
          rows.push({ label: `· ${hp.environment}`, value: signed(p.environment) });
          rows.push({ label: `· ${hp.safety}`, value: signed(p.safety) });
        }
        if (!this.growth.network.hasAccess(x, y)) warning = z.noAccess;
      } else title = TERRAIN_NAMES[st.getTerrain(x, y)];
      if (locked) {
        rows.push({ label: h.sector, value: h.locked });
      } else {
        rows.push({
          label: TEXTS.stats.neighborhood,
          value: `${Math.round(st.sectorPopulation[s]!).toLocaleString('es-AR')} ${z.residents}`,
        });
        rows.push({ label: `· ${TEXTS.stats.happiness}`, value: String(Math.round(st.sectorHappiness[s]!)) });
      }
      rows.unshift({ label: h.tile, value: `${x}, ${y}` });
    }
    const footer = `${h.zoom} ${zoom.toFixed(2)}x · ${h.fps} ${Math.round(fps)}`;
    const key = `${title}|${warning}|${footer}|${rows.map((r) => `${r.label}=${r.value}`).join(';')}`;
    if (key === this.last) return;
    this.last = key;
    this.title.textContent = title;
    this.rows.replaceChildren(
      ...rows.map((r) => {
        const row = document.createElement('div');
        row.className = 'row';
        if (r.state) row.dataset.state = r.state;
        const l = document.createElement('span');
        l.className = 'row-label';
        l.textContent = r.label;
        const v = document.createElement('span');
        v.className = 'row-value mono';
        v.textContent = r.value;
        row.append(l, v);
        return row;
      }),
    );
    this.warning.replaceChildren();
    this.warning.style.display = warning ? '' : 'none';
    if (warning) {
      const text = document.createElement('span');
      text.textContent = warning;
      this.warning.append(icon('triangle-alert', 'sm'), text);
    }
    this.footer.textContent = footer;
  }
}
