import type { CityState, TaxRates } from '../core/cityState';
import { ECONOMY } from '../data/config';
import { TEXTS } from '../data/texts';
import { projectMonth } from '../sim/economy';
import { formatMoney } from './topBar';

const TAXES: Array<{ key: keyof TaxRates; label: string }> = [
  { key: 'residential', label: TEXTS.zones.residential },
  { key: 'commercial', label: TEXTS.zones.commercial },
  { key: 'industrial', label: TEXTS.zones.industrial },
];

function signed(n: number): string {
  return n >= 0 ? `+${formatMoney(n)}` : `-${formatMoney(-n)}`;
}

/** Presupuesto: tasas de impuestos ajustables, ingresos y gastos estimados del mes. */
export class BudgetPanel {
  private readonly panel: HTMLDivElement;
  private readonly body: HTMLDivElement;
  private readonly rateLabels = new Map<keyof TaxRates, HTMLSpanElement>();
  private open = false;
  private last = '';

  constructor(
    parent: HTMLElement,
    private readonly state: CityState,
    onChange: () => void,
    private readonly producing: (i: number) => boolean = () => true,
  ) {
    const b = TEXTS.budget;
    this.panel = document.createElement('div');
    this.panel.className = 'hud-panel budget-panel';
    const title = document.createElement('div');
    title.className = 'service-title';
    title.textContent = b.title;
    const taxTitle = document.createElement('div');
    taxTitle.className = 'demand-title';
    taxTitle.textContent = b.taxes;
    this.panel.append(title, taxTitle);

    for (const t of TAXES) {
      const row = document.createElement('label');
      row.className = 'tax-row';
      const name = document.createElement('span');
      name.textContent = t.label;
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = String(ECONOMY.minTaxRate);
      slider.max = String(ECONOMY.maxTaxRate);
      slider.step = '1';
      slider.value = String(state.taxRates[t.key]);
      const value = document.createElement('span');
      value.className = 'tax-value';
      slider.addEventListener('input', () => {
        state.taxRates[t.key] = Number(slider.value);
        onChange();
      });
      row.append(name, slider, value);
      this.rateLabels.set(t.key, value);
      this.panel.append(row);
    }
    this.body = document.createElement('div');
    this.body.className = 'budget-body';
    const close = document.createElement('button');
    close.textContent = b.close;
    close.addEventListener('click', () => this.toggle(false));
    this.panel.append(this.body, close);
    parent.append(this.panel);
  }

  toggle(force?: boolean): void {
    this.open = force ?? !this.open;
    this.panel.style.display = this.open ? 'block' : 'none';
    this.last = '';
  }

  update(): void {
    if (!this.open) return;
    const st = this.state;
    const p = projectMonth(st, this.producing);
    const key = `${JSON.stringify(p)}|${JSON.stringify(st.taxRates)}|${st.lastMonth?.balance}`;
    if (key === this.last) return;
    this.last = key;
    for (const t of TAXES) this.rateLabels.get(t.key)!.textContent = `${st.taxRates[t.key]}%`;
    const b = TEXTS.budget;
    const lines = [
      b.income,
      `  ${TEXTS.zones.residential}: ${signed(p.income.residential)}`,
      `  ${TEXTS.zones.commercial}: ${signed(p.income.commercial)}`,
      `  ${TEXTS.zones.industrial}: ${signed(p.income.industrial)}`,
      b.expenses,
      `  ${b.roads}: ${signed(-p.roadUpkeep)}`,
      `  ${b.services}: ${signed(-p.serviceUpkeep)}`,
      `${b.projected}: ${signed(p.balance)}`,
    ];
    if (st.lastMonth) lines.push(`${b.lastMonth}: ${signed(st.lastMonth.balance)}`);
    this.body.textContent = lines.join('\n');
  }
}
