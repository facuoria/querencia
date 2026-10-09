import type { CityState } from '../core/cityState';
import { ServiceType, type TileCoord } from '../core/types';
import { SERVICE_LIST, SERVICES } from '../data/services';
import { TEXTS } from '../data/texts';
import type { ToolController } from '../input/tools';
import type { Heatmap, HeatmapMode } from '../render/heatmap';
import { lockedMessage, upgradeCost, upgradeService } from '../sim/construction';
import type { GrowthSim } from '../sim/growth';
import { maxServiceLevel, serviceLevelMilestone } from '../sim/milestones';
import { UTILITIES } from '../sim/services';
import { icon, type IconName } from './icons';
import { panel } from './shell';
import { formatMoney } from './topBar';
import { tooltip } from './tooltip';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function n(v: number): string {
  return Math.round(v).toLocaleString('es-AR');
}

const SUPPLY_NAMES: Record<number, string> = {
  [ServiceType.Power]: TEXTS.supplyNames.power,
  [ServiceType.Water]: TEXTS.supplyNames.water,
  [ServiceType.Gas]: TEXTS.supplyNames.gas,
};

/** Luz, agua y gas como "uso / capacidad", con el nombre completo y una barra. */
export class SupplyPanel {
  private readonly rows = new Map<number, { row: HTMLElement; fill: HTMLDivElement; value: HTMLSpanElement }>();
  private last = '';

  constructor(
    parent: HTMLElement,
    private readonly growth: GrowthSim,
  ) {
    const p = panel('supply-panel', TEXTS.panels.supply);
    for (const u of UTILITIES) {
      const row = el('div', 'supply-row');
      const head = el('div', 'row');
      const name = el('span', 'row-label', SUPPLY_NAMES[u]);
      const value = el('span', 'row-value mono');
      head.append(icon(SERVICES[u].icon, 'sm'), name, value);
      const track = el('div', 'meter');
      const fill = el('div', 'meter-fill');
      track.append(fill);
      row.append(head, track);
      p.body.append(row);
      tooltip.attach(row, () => {
        const s = this.growth.services.utilities[u]!;
        return {
          title: SUPPLY_NAMES[u]!,
          description: `${TEXTS.panels.use} ${n(s.consumption)} / ${TEXTS.panels.capacity} ${n(s.capacity)}${
            s.consumption > s.capacity ? ` · ${TEXTS.utilities.deficit}` : ''
          }`,
        };
      });
      this.rows.set(u, { row, fill, value });
    }
    parent.append(p.el);
  }

  update(): void {
    const sv = this.growth.services;
    const key = UTILITIES.map((u) => `${sv.utilities[u]!.capacity}/${sv.utilities[u]!.consumption}`).join('|');
    if (key === this.last) return;
    this.last = key;
    for (const u of UTILITIES) {
      const s = sv.utilities[u]!;
      const r = this.rows.get(u)!;
      const ratio = s.capacity > 0 ? Math.min(1, s.consumption / s.capacity) : s.consumption > 0 ? 1 : 0;
      const state = s.consumption > s.capacity ? 'bad' : ratio > 0.85 ? 'warn' : 'good';
      r.fill.style.width = `${ratio * 100}%`;
      r.row.dataset.state = state;
      r.value.textContent = `${n(s.consumption)} / ${n(s.capacity)}`;
    }
  }
}

/** Selector del mapa de calor, con ícono y nombre en cada opción. */
export class MapsPanel {
  private readonly buttons = new Map<HeatmapMode, HTMLButtonElement>();
  private last: HeatmapMode | undefined;

  constructor(
    parent: HTMLElement,
    private readonly heatmap: Heatmap,
  ) {
    const p = panel('maps-panel', TEXTS.panels.maps);
    const grid = el('div', 'maps-grid');
    const m = TEXTS.maps;
    const modes: Array<[HeatmapMode, IconName, string]> = [
      [null, 'layers', m.none],
      ...SERVICE_LIST.map((d): [HeatmapMode, IconName, string] => [d.type, d.icon, m.byService[d.key]]),
      ['landValue', 'circle-dollar-sign', m.landValue],
      ['happiness', 'smile', m.happiness],
    ];
    for (const [mode, ic, label] of modes) {
      const b = el('button', 'map-button');
      b.append(icon(ic, 'sm'), el('span', undefined, label));
      b.addEventListener('click', () => heatmap.setMode(mode));
      tooltip.attach(b, { title: label, description: mode === null ? m.noneHint : m.hint });
      this.buttons.set(mode, b);
      grid.append(b);
    }
    p.body.append(grid);
    parent.append(p.el);
  }

  update(): void {
    if (this.heatmap.mode === this.last) return;
    this.last = this.heatmap.mode;
    for (const [mode, b] of this.buttons) {
      b.classList.toggle('active', mode === this.heatmap.mode);
      b.setAttribute('aria-pressed', String(mode === this.heatmap.mode));
    }
  }
}

/** Ficha del servicio elegido con la herramienta Seleccionar: datos y botón para mejorarlo. */
export class ServiceInfo {
  private readonly panelEl: HTMLElement;
  private readonly titleIcon: HTMLSpanElement;
  private readonly titleText: HTMLSpanElement;
  private readonly body: HTMLDivElement;
  private readonly upgrade: HTMLButtonElement;
  private readonly upgradeLabel: HTMLSpanElement;
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
    const t = TEXTS.services;
    const p = panel('service-info');
    this.panelEl = p.el;
    const head = el('div', 'service-head');
    this.titleIcon = el('span', 'icon icon-lg');
    this.titleText = el('h2', 'panel-title service-name');
    const close = el('button', 'icon-button');
    close.append(icon('x', 'sm'));
    tooltip.attach(close, { title: t.close });
    head.append(this.titleIcon, this.titleText, close);
    this.body = el('div', 'service-body');
    const actions = el('div', 'service-actions');
    this.upgrade = el('button', 'text-button primary');
    this.upgradeLabel = el('span');
    this.upgrade.append(icon('circle-arrow-up', 'sm'), this.upgradeLabel);
    tooltip.attach(this.upgrade, () => this.upgradeTip());
    const coverage = el('button', 'text-button');
    coverage.append(icon('eye', 'sm'), el('span', undefined, t.showCoverage));
    actions.append(this.upgrade, coverage);
    this.panelEl.append(head, this.body, actions);
    this.panelEl.style.display = 'none';
    parent.append(this.panelEl);

    this.upgrade.addEventListener('click', () => {
      if (!this.tile) return;
      const err = upgradeService(state, this.tile.x, this.tile.y);
      if (err) onError(err);
      else {
        growth.refresh();
        heatmap.redraw();
      }
    });
    coverage.addEventListener('click', () => {
      if (this.tile) heatmap.setMode(state.getService(this.tile.x, this.tile.y));
    });
    close.addEventListener('click', () => (this.tools.selected = null));
  }

  /** Motivo por el que no se puede mejorar (hito o nivel máximo), o null. */
  private lockReason(): string | null {
    if (!this.tile) return null;
    const next = this.state.getServiceLevel(this.tile.x, this.tile.y) + 1;
    if (next > 3) return null;
    return next > maxServiceLevel(this.state) ? lockedMessage(serviceLevelMilestone(next)) : null;
  }

  private upgradeTip(): { title: string; cost?: string; description?: string; locked?: string | null } {
    if (!this.tile) return { title: TEXTS.services.upgrade };
    const cost = upgradeCost(this.state, this.tile.x, this.tile.y);
    if (cost === null) return { title: TEXTS.services.maxLevel };
    return {
      title: TEXTS.services.upgrade,
      cost: formatMoney(cost),
      description: TEXTS.services.upgradeHint,
      locked: this.lockReason() ?? (this.state.money < cost ? TEXTS.errors.noMoney : null),
    };
  }

  update(): void {
    const sel = this.tools.selected;
    const st = this.state;
    const type = sel ? st.getService(sel.x, sel.y) : ServiceType.None;
    if (!sel || type === ServiceType.None) {
      if (this.tile) this.panelEl.style.display = 'none';
      this.tile = null;
      this.last = '';
      return;
    }
    this.tile = sel;
    const level = st.getServiceLevel(sel.x, sel.y);
    const working = this.growth.services.isWorking(sel.x, sel.y);
    const cost = upgradeCost(st, sel.x, sel.y);
    const locked = this.lockReason();
    const key = `${sel.x},${sel.y},${type},${level},${working},${cost},${st.money >= (cost ?? 0)},${locked}`;
    if (key === this.last) return;
    this.last = key;

    const def = SERVICES[type];
    const t = TEXTS.services;
    this.panelEl.style.display = '';
    this.titleIcon.innerHTML = icon(def.icon, 'lg').innerHTML;
    this.titleText.textContent = def.name;
    const rows: Array<[string, string]> = [
      [t.level, `${level} / 3`],
      [t.radius, `${def.radius[level - 1]} ${t.tiles}`],
    ];
    if (def.capacity) rows.push([t.capacity, n(def.capacity[level - 1] ?? 0)]);
    this.body.replaceChildren(
      ...rows.map(([label, value]) => {
        const r = el('div', 'row');
        r.append(el('span', 'row-label', label), el('span', 'row-value mono', value));
        return r;
      }),
    );
    if (!working) {
      const warn = el('div', 'inline-alert');
      warn.dataset.state = 'bad';
      warn.append(icon('triangle-alert', 'sm'), el('span', undefined, t.noAccess));
      this.body.append(warn);
    }
    this.upgradeLabel.textContent = cost === null ? t.maxLevel : `${t.upgrade} · ${formatMoney(cost)}`;
    const blocked = cost === null || locked !== null || st.money < cost;
    this.upgrade.classList.toggle('locked', blocked);
    this.upgrade.setAttribute('aria-disabled', String(blocked));
  }
}
