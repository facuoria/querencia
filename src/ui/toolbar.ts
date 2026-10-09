import type { CityState } from '../core/cityState';
import { Zone } from '../core/types';
import { COSTS } from '../data/config';
import { TEXTS } from '../data/texts';
import { Tool, type ToolController } from '../input/tools';
import { lockedMessage } from '../sim/construction';
import { isZoneUnlocked, zoneMilestone } from '../sim/milestones';
import { sectorCost } from '../sim/sectors';
import { formatMoney } from './topBar';

interface ButtonDef {
  tool: Tool;
  label: string;
  key: string;
  cost?: string;
  zone?: Zone;
  cls?: string;
}

const BUTTONS: ButtonDef[] = [
  { tool: Tool.Select, label: TEXTS.tools.select, key: 'Esc' },
  { tool: Tool.Road, label: TEXTS.tools.road, key: 'R', cost: formatMoney(COSTS.road) },
  {
    tool: Tool.Residential,
    label: TEXTS.tools.residential,
    key: 'Z',
    cost: formatMoney(COSTS.zone),
    zone: Zone.Residential,
    cls: 'res',
  },
  {
    tool: Tool.Commercial,
    label: TEXTS.tools.commercial,
    key: 'X',
    cost: formatMoney(COSTS.zone),
    zone: Zone.Commercial,
    cls: 'com',
  },
  {
    tool: Tool.Industrial,
    label: TEXTS.tools.industrial,
    key: 'C',
    cost: formatMoney(COSTS.zone),
    zone: Zone.Industrial,
    cls: 'ind',
  },
  { tool: Tool.Sector, label: TEXTS.sectors.tool, key: 'T' },
  { tool: Tool.Demolish, label: TEXTS.tools.demolish, key: 'B', cost: TEXTS.tools.demolishRefund },
];

interface ButtonView {
  el: HTMLButtonElement;
  name: HTMLSpanElement;
  meta: HTMLElement;
  def: ButtonDef;
}

/** Barra de herramientas abajo al centro. Las zonas bloqueadas por hito se ven con candado. */
export class Toolbar {
  private readonly buttons = new Map<Tool, ButtonView>();
  private last = '';

  constructor(
    parent: HTMLElement,
    private readonly tools: ToolController,
    private readonly state: CityState,
  ) {
    const bar = document.createElement('div');
    bar.className = 'hud-panel toolbar';
    for (const def of BUTTONS) {
      const b = document.createElement('button');
      if (def.cls) b.classList.add(`zone-${def.cls}`);
      const name = document.createElement('span');
      const meta = document.createElement('small');
      b.append(name, meta);
      b.addEventListener('click', () => tools.setTool(def.tool));
      this.buttons.set(def.tool, { el: b, name, meta, def });
      bar.append(b);
    }
    parent.append(bar);
  }

  update(): void {
    const st = this.state;
    const cost = sectorCost(st);
    const locks = BUTTONS.map((d) => (d.zone !== undefined && !isZoneUnlocked(st, d.zone) ? 1 : 0)).join('');
    const key = `${this.tools.tool}|${cost}|${locks}`;
    if (key === this.last) return;
    this.last = key;
    for (const [tool, { el, name, meta, def }] of this.buttons) {
      const locked = def.zone !== undefined && !isZoneUnlocked(st, def.zone);
      el.classList.toggle('active', tool === this.tools.tool);
      el.disabled = locked;
      el.title = locked && def.zone !== undefined ? lockedMessage(zoneMilestone(def.zone)) : '';
      name.textContent = locked ? `🔒 ${def.label}` : def.label;
      const price = tool === Tool.Sector ? formatMoney(cost) : def.cost;
      meta.textContent = price ? `${def.key} · ${price}` : def.key;
    }
  }
}
