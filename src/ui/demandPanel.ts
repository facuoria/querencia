import type { CityState } from '../core/cityState';
import { TEXTS } from '../data/texts';

const BARS = [
  { key: 'residential', label: 'R', cls: 'res', title: TEXTS.zones.residential },
  { key: 'commercial', label: 'C', cls: 'com', title: TEXTS.zones.commercial },
  { key: 'industrial', label: 'I', cls: 'ind', title: TEXTS.zones.industrial },
] as const;

/** Población y barras de demanda residencial, comercial e industrial. */
export class DemandPanel {
  private readonly population: HTMLDivElement;
  private readonly fills: HTMLDivElement[] = [];
  private last = '';

  constructor(parent: HTMLElement, private readonly state: CityState) {
    const panel = document.createElement('div');
    panel.className = 'hud-panel demand-panel';
    this.population = document.createElement('div');
    this.population.className = 'population';
    const title = document.createElement('div');
    title.className = 'demand-title';
    title.textContent = TEXTS.stats.demand;
    const bars = document.createElement('div');
    bars.className = 'demand-bars';
    for (const def of BARS) {
      const col = document.createElement('div');
      col.className = 'demand-col';
      col.title = def.title;
      const track = document.createElement('div');
      track.className = 'demand-track';
      const fill = document.createElement('div');
      fill.className = `demand-fill zone-${def.cls}`;
      track.append(fill);
      const label = document.createElement('span');
      label.textContent = def.label;
      col.append(track, label);
      bars.append(col);
      this.fills.push(fill);
    }
    panel.append(this.population, title, bars);
    parent.append(panel);
  }

  update(): void {
    const s = this.state.stats;
    const values = BARS.map((b) => s.demand[b.key]);
    const key = `${s.population}|${values.map((v) => v.toFixed(2)).join(',')}`;
    if (key === this.last) return;
    this.last = key;
    this.population.textContent = `${TEXTS.stats.population}: ${s.population.toLocaleString('es-AR')}`;
    values.forEach((v, i) => {
      const fill = this.fills[i]!;
      // La barra crece hacia arriba con demanda positiva y hacia abajo con negativa, desde el medio.
      const h = Math.abs(v) * 50;
      fill.style.height = `${h}%`;
      fill.style.top = v >= 0 ? `${50 - h}%` : '50%';
      fill.classList.toggle('negative', v < 0);
    });
  }
}
