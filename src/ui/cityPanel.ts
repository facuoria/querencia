import type { CityState } from '../core/cityState';
import { MILESTONES } from '../data/config';
import { TEXTS } from '../data/texts';
import { currentMilestone } from '../sim/milestones';
import { icon } from './icons';
import { panel } from './shell';
import { tooltip } from './tooltip';

const BARS = [
  { key: 'residential', label: TEXTS.zones.residential, cls: 'zone-res' },
  { key: 'commercial', label: TEXTS.zones.commercial, cls: 'zone-com' },
  { key: 'industrial', label: TEXTS.zones.industrial, cls: 'zone-ind' },
] as const;

/** Hito actual con progreso al siguiente, desempleo y demanda por tipo de zona con leyenda. */
export class CityPanel {
  private readonly milestoneName: HTMLSpanElement;
  private readonly milestoneProgress: HTMLDivElement;
  private readonly milestoneText: HTMLSpanElement;
  private readonly unemployment: HTMLSpanElement;
  private readonly fills: HTMLDivElement[] = [];
  private readonly values: HTMLSpanElement[] = [];
  private last = '';

  constructor(parent: HTMLElement, private readonly state: CityState) {
    const p = TEXTS.panels;
    const city = panel('city-panel', p.city);

    const ms = document.createElement('div');
    ms.className = 'row';
    this.milestoneName = document.createElement('span');
    this.milestoneName.className = 'row-label';
    ms.append(icon('trophy', 'sm'), this.milestoneName);
    const track = document.createElement('div');
    track.className = 'meter';
    this.milestoneProgress = document.createElement('div');
    this.milestoneProgress.className = 'meter-fill';
    track.append(this.milestoneProgress);
    this.milestoneText = document.createElement('span');
    this.milestoneText.className = 'caption mono';

    const un = document.createElement('div');
    un.className = 'row';
    const unLabel = document.createElement('span');
    unLabel.className = 'row-label';
    unLabel.textContent = TEXTS.stats.unemployment;
    this.unemployment = document.createElement('span');
    this.unemployment.className = 'row-value mono';
    un.append(icon('briefcase', 'sm'), unLabel, this.unemployment);
    city.body.append(ms, track, this.milestoneText, un);

    const demand = panel('demand-panel', p.demand);
    const caption = document.createElement('div');
    caption.className = 'caption';
    caption.textContent = TEXTS.panels.demandCaption;
    demand.body.append(caption);
    tooltip.attach(demand.el, { title: p.demand, description: p.demandHint });
    for (const b of BARS) {
      const row = document.createElement('div');
      row.className = 'demand-row';
      const swatch = document.createElement('span');
      swatch.className = `swatch ${b.cls}`;
      const label = document.createElement('span');
      label.className = 'demand-label';
      label.textContent = b.label;
      const bar = document.createElement('div');
      bar.className = 'demand-bar';
      const fill = document.createElement('div');
      fill.className = `demand-fill ${b.cls}`;
      bar.append(fill);
      const value = document.createElement('span');
      value.className = 'demand-value mono';
      row.append(swatch, label, bar, value);
      demand.body.append(row);
      this.fills.push(fill);
      this.values.push(value);
    }
    parent.append(city.el, demand.el);
  }

  update(): void {
    const st = this.state;
    const s = st.stats;
    const m = currentMilestone(st);
    const values = BARS.map((b) => s.demand[b.key]);
    const key = `${s.population}|${m}|${Math.round(s.unemployment * 100)}|${values.map((v) => v.toFixed(2)).join(',')}`;
    if (key === this.last) return;
    this.last = key;

    const here = MILESTONES[m]!;
    const next = MILESTONES[m + 1];
    this.milestoneName.textContent = `${TEXTS.panels.milestone}: ${TEXTS.milestones[here.key]}`;
    if (next) {
      const from = here.population;
      const ratio = Math.max(0, Math.min(1, (s.population - from) / (next.population - from)));
      this.milestoneProgress.style.width = `${ratio * 100}%`;
      this.milestoneText.textContent = `${s.population.toLocaleString('es-AR')} / ${next.population.toLocaleString('es-AR')} ${TEXTS.units.inhabitants} · ${TEXTS.milestones[next.key]}`;
    } else {
      this.milestoneProgress.style.width = '100%';
      this.milestoneText.textContent = TEXTS.panels.lastMilestone;
    }
    const u = Math.round(s.unemployment * 100);
    this.unemployment.textContent = `${u}%`;
    this.unemployment.dataset.state = u > 15 ? 'bad' : u > 8 ? 'warn' : '';

    values.forEach((v, i) => {
      const fill = this.fills[i]!;
      // Barra divergente desde el centro: a la derecha falta, a la izquierda sobra.
      const w = Math.abs(v) * 50;
      fill.style.width = `${w}%`;
      fill.style.left = v >= 0 ? '50%' : `${50 - w}%`;
      fill.classList.toggle('negative', v < 0);
      const pct = Math.round(v * 100);
      this.values[i]!.textContent = pct > 0 ? `+${pct}` : String(pct);
    });
  }
}
