import type { CityState } from '../core/cityState';
import { ECONOMY, HAPPINESS } from '../data/config';
import { SERVICES } from '../data/services';
import { TEXTS } from '../data/texts';
import { servicesCut } from '../sim/economy';
import type { GrowthSim } from '../sim/growth';
import { UTILITIES } from '../sim/services';

/** Avisos que se mantienen mientras dura un problema: saldo negativo, falta de suministro, desempleo, descontento. */
export class Alerts {
  private readonly el: HTMLDivElement;
  private last = '';

  constructor(
    parent: HTMLElement,
    private readonly state: CityState,
    private readonly growth: GrowthSim,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'alerts';
    parent.append(this.el);
  }

  update(): void {
    const st = this.state;
    const a = TEXTS.alerts;
    const list: string[] = [];
    if (servicesCut(st)) list.push(`✂ ${a.cuts}`);
    else if (st.money < 0) list.push(`💸 ${a.negative}`);
    for (const u of UTILITIES) {
      const s = this.growth.services.utilities[u]!;
      if (s.consumption > s.capacity) list.push(`${SERVICES[u].icon} ${TEXTS.utilities.deficit}: ${SERVICES[u].name}`);
    }
    if (st.stats.population > 50) {
      if (st.stats.unemployment > 0.15) list.push(`💼 ${a.unemployment} (${Math.round(st.stats.unemployment * 100)}%)`);
      if (st.stats.happiness < HAPPINESS.leaveBelow) list.push(`😠 ${a.unhappy}`);
    }
    const fires = this.growth.fire.count();
    if (fires > 0) list.push(`🔥 ${a.fires}: ${fires}`);
    const dark = this.growth.blackoutCount();
    if (dark > 0 && this.growth.services.utilities[1]!.capacity > 0) {
      list.push(`⚡ ${a.blackout}: ${dark} ${a.buildingsWithoutPower}`);
    }
    const high = Math.max(st.taxRates.residential, st.taxRates.commercial, st.taxRates.industrial);
    if (high >= ECONOMY.defaultTaxRate + 5) list.push(`📈 ${a.highTaxes}`);
    const key = list.join('|');
    if (key === this.last) return;
    this.last = key;
    this.el.replaceChildren(
      ...list.map((text) => {
        const d = document.createElement('div');
        d.className = 'alert';
        d.textContent = text;
        return d;
      }),
    );
  }
}
