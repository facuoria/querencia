import type { CityState } from '../core/cityState';
import { ServiceType, type TileCoord } from '../core/types';
import { SERVICE_LIST, SERVICES } from '../data/services';
import { TEXTS } from '../data/texts';
import type { ToolController } from '../input/tools';
import type { Heatmap, HeatmapMode } from '../render/heatmap';
import { lockedMessage, upgradeCost, upgradeService } from '../sim/construction';
import { isServiceUnlocked, serviceMilestone } from '../sim/milestones';
import type { GrowthSim } from '../sim/growth';
import { UTILITIES } from '../sim/services';
import { formatMoney } from './topBar';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Fila de botones para ubicar edificios de servicio. */
export class ServiceBar {
  private readonly buttons = new Map<number, HTMLButtonElement>();
  private last = '';

  constructor(
    parent: HTMLElement,
    private readonly tools: ToolController,
    private readonly state: CityState,
  ) {
    const bar = el('div', 'hud-panel service-bar');
    for (const def of SERVICE_LIST) {
      const b = el('button');
      b.append(el('span', 'service-icon', def.icon), el('small', undefined, def.name));
      b.addEventListener('click', () => tools.setService(def.type));
      this.buttons.set(def.type, b);
      bar.append(b);
    }
    parent.append(bar);
  }

  update(): void {
    const active = this.tools.tool === 'service' ? this.tools.serviceType : -1;
    const locks = SERVICE_LIST.map((d) => (isServiceUnlocked(this.state, d.type) ? 0 : 1)).join('');
    const key = `${active}|${locks}`;
    if (key === this.last) return;
    this.last = key;
    for (const [type, b] of this.buttons) {
      const def = SERVICES[type as 1];
      const locked = !isServiceUnlocked(this.state, def.type);
      b.classList.toggle('active', type === active);
      b.disabled = locked;
      b.classList.toggle('locked', locked);
      b.title = locked ? lockedMessage(serviceMilestone(def.type)) : `${def.name} · ${formatMoney(def.cost)}`;
    }
  }
}

const UTILITY_NAMES: Record<number, string> = {
  [ServiceType.Power]: TEXTS.utilities.power,
  [ServiceType.Water]: TEXTS.utilities.water,
  [ServiceType.Gas]: TEXTS.utilities.gas,
};

/** Estado de luz, agua y gas, y selector del mapa de calor. */
export class MapsPanel {
  private readonly rows = new Map<number, { fill: HTMLDivElement; label: HTMLSpanElement }>();
  private readonly mapButtons = new Map<HeatmapMode, HTMLButtonElement>();
  private last = '';

  constructor(
    parent: HTMLElement,
    private readonly growth: GrowthSim,
    private readonly heatmap: Heatmap,
  ) {
    const panel = el('div', 'hud-panel maps-panel');
    for (const u of UTILITIES) {
      const row = el('div', 'utility-row');
      const name = el('span', 'utility-name', `${SERVICES[u].icon} ${UTILITY_NAMES[u]}`);
      const track = el('div', 'utility-track');
      const fill = el('div', 'utility-fill');
      track.append(fill);
      const label = el('span', 'utility-label');
      row.append(name, track, label);
      panel.append(row);
      this.rows.set(u, { fill, label });
    }
    panel.append(el('div', 'demand-title', TEXTS.maps.title));
    const grid = el('div', 'maps-grid');
    const modes: Array<[HeatmapMode, string]> = [
      [null, TEXTS.maps.none],
      ...SERVICE_LIST.map((d): [HeatmapMode, string] => [d.type, d.icon]),
      ['landValue', '💰'],
      ['happiness', '🙂'],
    ];
    for (const [mode, label] of modes) {
      const b = el('button', undefined, label);
      b.title =
        mode === null
          ? TEXTS.maps.none
          : mode === 'landValue'
            ? TEXTS.maps.landValue
            : mode === 'happiness'
              ? TEXTS.maps.happiness
              : SERVICES[mode as 1].name;
      b.addEventListener('click', () => heatmap.setMode(mode));
      this.mapButtons.set(mode, b);
      grid.append(b);
    }
    panel.append(grid);
    parent.append(panel);
  }

  update(): void {
    const sv = this.growth.services;
    const parts: string[] = [String(this.heatmap.mode)];
    for (const u of UTILITIES) {
      const s = sv.utilities[u]!;
      parts.push(`${s.capacity}/${s.consumption}`);
    }
    const key = parts.join('|');
    if (key === this.last) return;
    this.last = key;
    for (const u of UTILITIES) {
      const s = sv.utilities[u]!;
      const row = this.rows.get(u)!;
      const ratio = s.capacity > 0 ? Math.min(1, s.consumption / s.capacity) : s.consumption > 0 ? 1 : 0;
      const deficit = s.consumption > s.capacity;
      row.fill.style.width = `${ratio * 100}%`;
      row.fill.classList.toggle('deficit', deficit);
      row.label.textContent = `${s.consumption}/${s.capacity}`;
      row.label.classList.toggle('deficit', deficit);
      row.label.title = deficit ? TEXTS.utilities.deficit : '';
    }
    for (const [mode, b] of this.mapButtons) b.classList.toggle('active', mode === this.heatmap.mode);
  }
}

/** Ficha del servicio elegido con la herramienta Seleccionar: datos y botón para mejorarlo. */
export class ServiceInfo {
  private readonly panel: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly body: HTMLDivElement;
  private readonly upgrade: HTMLButtonElement;
  private readonly coverage: HTMLButtonElement;
  private tile: TileCoord | null = null;
  private last = '';

  constructor(
    parent: HTMLElement,
    private readonly state: CityState,
    private readonly growth: GrowthSim,
    private readonly tools: ToolController,
    heatmap: Heatmap,
    onError: (msg: string) => void,
  ) {
    this.panel = el('div', 'hud-panel service-info');
    this.title = el('div', 'service-title');
    this.body = el('div', 'service-body');
    const actions = el('div', 'service-actions');
    this.upgrade = el('button');
    this.coverage = el('button', undefined, TEXTS.services.showCoverage);
    const close = el('button', undefined, TEXTS.services.close);
    actions.append(this.upgrade, this.coverage, close);
    this.panel.append(this.title, this.body, actions);
    parent.append(this.panel);

    this.upgrade.addEventListener('click', () => {
      if (!this.tile) return;
      const err = upgradeService(state, this.tile.x, this.tile.y);
      if (err) onError(err);
      else {
        growth.refresh();
        heatmap.redraw();
      }
    });
    this.coverage.addEventListener('click', () => {
      if (this.tile) heatmap.setMode(state.getService(this.tile.x, this.tile.y));
    });
    close.addEventListener('click', () => (this.tools.selected = null));
  }

  update(): void {
    const sel = this.tools.selected;
    const st = this.state;
    const type = sel ? st.getService(sel.x, sel.y) : ServiceType.None;
    if (!sel || type === ServiceType.None) {
      if (this.tile) this.panel.style.display = 'none';
      this.tile = null;
      this.last = '';
      return;
    }
    this.tile = sel;
    const level = st.getServiceLevel(sel.x, sel.y);
    const working = this.growth.services.isWorking(sel.x, sel.y);
    const cost = upgradeCost(st, sel.x, sel.y);
    const key = `${sel.x},${sel.y},${type},${level},${working},${cost},${st.money >= (cost ?? 0)}`;
    if (key === this.last) return;
    this.last = key;

    const def = SERVICES[type];
    const t = TEXTS.services;
    this.panel.style.display = 'block';
    this.title.textContent = `${def.icon} ${def.name}`;
    const lines = [
      `${t.level} ${level} / 3`,
      `${t.radius}: ${def.radius[level - 1]} ${t.tiles}`,
    ];
    if (def.capacity) lines.push(`${t.capacity}: ${def.capacity[level - 1]}`);
    if (!working) lines.push(`⚠ ${t.noAccess}`);
    this.body.textContent = lines.join('\n');
    this.upgrade.textContent = cost === null ? t.maxLevel : `${t.upgrade} · ${formatMoney(cost)}`;
    this.upgrade.disabled = cost === null || st.money < cost;
  }
}
