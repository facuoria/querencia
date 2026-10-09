import type { CityState } from '../core/cityState';
import { Zone, type TileCoord } from '../core/types';
import { ECONOMY, HAPPINESS } from '../data/config';
import { SERVICES } from '../data/services';
import { TEXTS } from '../data/texts';
import { servicesCut } from '../sim/economy';
import type { GrowthSim } from '../sim/growth';
import { UTILITIES } from '../sim/services';
import { icon, type IconName } from './icons';
import { tooltip } from './tooltip';

/** Qué hace una alerta al hacerle clic. */
type AlertAction = { kind: 'focus'; tiles: TileCoord[] } | { kind: 'budget' };

interface AlertItem {
  id: string;
  icon: IconName;
  text: string;
  severity: 'bad' | 'warn';
  action: AlertAction;
}

export interface AlertHandlers {
  /** Llevar la cámara a una casilla y marcarla. */
  focus: (tile: TileCoord) => void;
  openBudget: () => void;
}

/** Cuántas alertas se muestran a la vez; el resto se resume en una línea. */
const MAX_VISIBLE = 4;

/**
 * Avisos que duran mientras dura el problema. Cada uno es un botón: lleva la cámara al lugar
 * (recorriendo los casos si hay varios) o abre el presupuesto.
 */
export class Alerts {
  private readonly el: HTMLDivElement;
  private items: AlertItem[] = [];
  /** Próximo caso a mostrar de cada alerta, para recorrerlos con clics sucesivos. */
  private readonly cursor = new Map<string, number>();
  private last = '';
  private lastCheck = 0;

  constructor(
    parent: HTMLElement,
    private readonly state: CityState,
    private readonly growth: GrowthSim,
    private readonly handlers: AlertHandlers,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'alerts';
    this.el.setAttribute('aria-label', TEXTS.panels.alerts);
    parent.append(this.el);
  }

  update(): void {
    // Buscar los lugares recorre todo el mapa: con dos veces por segundo alcanza.
    const now = performance.now();
    if (now - this.lastCheck < 500) return;
    this.lastCheck = now;
    this.items = this.collect();
    const key = this.items.map((a) => `${a.id}:${a.text}`).join('|');
    if (key === this.last) return;
    this.last = key;
    this.render();
  }

  private collect(): AlertItem[] {
    const st = this.state;
    const a = TEXTS.alerts;
    const sv = this.growth.services;
    const n = st.size;
    const list: AlertItem[] = [];
    const tileOf = (i: number): TileCoord => ({ x: i % n, y: Math.floor(i / n) });

    const fires: TileCoord[] = [];
    const dark: TileCoord[] = [];
    for (let i = 0; i < st.buildingLevel.length; i++) {
      if (st.fire[i]! > 0) fires.push(tileOf(i));
      if (st.buildingLevel[i]! > 0 && !this.growth.hasPower(i)) dark.push(tileOf(i));
    }
    if (fires.length > 0) {
      list.push({
        id: 'fire',
        icon: 'flame',
        severity: 'bad',
        text: `${a.fires}: ${fires.length}`,
        action: { kind: 'focus', tiles: fires },
      });
    }
    if (dark.length > 0 && sv.utilities[UTILITIES[0]]!.capacity > 0) {
      list.push({
        id: 'blackout',
        icon: 'zap-off',
        severity: 'bad',
        text: `${a.blackout}: ${dark.length} ${a.buildingsWithoutPower}`,
        action: { kind: 'focus', tiles: dark },
      });
    }
    for (const u of UTILITIES) {
      const s = sv.utilities[u]!;
      if (s.consumption <= s.capacity) continue;
      const missing: TileCoord[] = [];
      for (let i = 0; i < st.buildingLevel.length; i++) {
        if (st.buildingLevel[i]! > 0 && sv.coverage[u]![i] === 1 && sv.supplied[u]![i] !== 1) missing.push(tileOf(i));
      }
      const key = SERVICES[u].key as 'power' | 'water' | 'gas';
      list.push({
        id: `deficit-${u}`,
        icon: SERVICES[u].icon,
        severity: 'warn',
        text: `${TEXTS.utilities.deficit}: ${TEXTS.supplyNames[key]}`,
        action: missing.length > 0 ? { kind: 'focus', tiles: missing } : { kind: 'budget' },
      });
    }
    if (servicesCut(st)) {
      list.push({ id: 'cuts', icon: 'scissors', severity: 'bad', text: a.cuts, action: { kind: 'budget' } });
    } else if (st.money < 0) {
      list.push({ id: 'negative', icon: 'wallet', severity: 'bad', text: a.negative, action: { kind: 'budget' } });
    }

    if (st.stats.population > 50) {
      if (st.stats.happiness < HAPPINESS.leaveBelow) {
        list.push({
          id: 'unhappy',
          icon: 'frown',
          severity: 'warn',
          text: a.unhappy,
          action: { kind: 'focus', tiles: this.unhappiest() },
        });
      }
      if (st.stats.unemployment > 0.15) {
        list.push({
          id: 'unemployment',
          icon: 'briefcase',
          severity: 'warn',
          text: `${a.unemployment} (${Math.round(st.stats.unemployment * 100)}%)`,
          action: { kind: 'focus', tiles: this.mostPopulated() },
        });
      }
    }
    const high = Math.max(st.taxRates.residential, st.taxRates.commercial, st.taxRates.industrial);
    if (high >= ECONOMY.defaultTaxRate + 5) {
      list.push({ id: 'taxes', icon: 'trending-up', severity: 'warn', text: a.highTaxes, action: { kind: 'budget' } });
    }
    return list;
  }

  /** Casas con el ánimo más bajo, de peor a mejor (hasta 10). */
  private unhappiest(): TileCoord[] {
    const st = this.state;
    const out: Array<{ i: number; h: number }> = [];
    for (let i = 0; i < st.zones.length; i++) {
      if (st.zones[i] === Zone.Residential && st.buildingLevel[i]! > 0) out.push({ i, h: st.happiness[i]! });
    }
    out.sort((p, q) => p.h - q.h);
    return out.slice(0, 10).map(({ i }) => ({ x: i % st.size, y: Math.floor(i / st.size) }));
  }

  /** Centro del barrio con más habitantes (donde vive la gente que busca trabajo). */
  private mostPopulated(): TileCoord[] {
    const st = this.state;
    let best = 0;
    for (let s = 1; s < st.sectorPopulation.length; s++) {
      if (st.sectorPopulation[s]! > st.sectorPopulation[best]!) best = s;
    }
    const sx = best % st.sectorsPerSide;
    const sy = Math.floor(best / st.sectorsPerSide);
    return [{ x: sx * st.sectorSize + st.sectorSize / 2, y: sy * st.sectorSize + st.sectorSize / 2 }];
  }

  private activate(item: AlertItem): void {
    if (item.action.kind === 'budget') {
      this.handlers.openBudget();
      return;
    }
    const tiles = item.action.tiles;
    if (tiles.length === 0) return;
    const k = (this.cursor.get(item.id) ?? 0) % tiles.length;
    this.cursor.set(item.id, k + 1);
    this.handlers.focus(tiles[k]!);
  }

  private render(): void {
    const shown = this.items.slice(0, MAX_VISIBLE);
    const nodes: HTMLElement[] = shown.map((item) => {
      const b = document.createElement('button');
      b.className = 'alert';
      b.dataset.state = item.severity;
      const text = document.createElement('span');
      text.textContent = item.text;
      const go = icon(item.action.kind === 'budget' ? 'landmark' : 'map-pin', 'sm');
      go.classList.add('alert-go');
      b.append(icon(item.icon, 'sm'), text, go);
      b.addEventListener('click', () => {
        const current = this.items.find((x) => x.id === item.id);
        if (current) this.activate(current);
      });
      tooltip.attach(b, {
        title: item.text,
        description: item.action.kind === 'budget' ? TEXTS.panels.openBudget : TEXTS.panels.goTo,
      });
      return b;
    });
    const rest = this.items.length - shown.length;
    if (rest > 0) {
      const more = document.createElement('div');
      more.className = 'alert-more';
      more.textContent = `${TEXTS.panels.moreAlerts} ${rest}`;
      nodes.push(more);
    }
    this.el.replaceChildren(...nodes);
  }
}
