import { COSTS } from '../data/config';
import { TEXTS } from '../data/texts';
import { Tool, type ToolController } from '../input/tools';
import { formatMoney } from './topBar';

const BUTTONS: Array<{ tool: Tool; label: string; key: string; cost?: string }> = [
  { tool: Tool.Select, label: TEXTS.tools.select, key: 'Esc' },
  { tool: Tool.Road, label: TEXTS.tools.road, key: 'R', cost: formatMoney(COSTS.road) },
  { tool: Tool.Demolish, label: TEXTS.tools.demolish, key: 'B', cost: TEXTS.tools.demolishRefund },
];

/** Barra de herramientas abajo al centro. */
export class Toolbar {
  private readonly buttons = new Map<Tool, HTMLButtonElement>();
  private current: Tool | null = null;

  constructor(parent: HTMLElement, private readonly tools: ToolController) {
    const bar = document.createElement('div');
    bar.className = 'hud-panel toolbar';
    for (const def of BUTTONS) {
      const b = document.createElement('button');
      const name = document.createElement('span');
      name.textContent = def.label;
      const meta = document.createElement('small');
      meta.textContent = def.cost ? `${def.key} · ${def.cost}` : def.key;
      b.append(name, meta);
      b.addEventListener('click', () => tools.setTool(def.tool));
      this.buttons.set(def.tool, b);
      bar.append(b);
    }
    parent.append(bar);
  }

  update(): void {
    if (this.tools.tool === this.current) return;
    this.current = this.tools.tool;
    for (const [tool, b] of this.buttons) b.classList.toggle('active', tool === this.current);
  }
}
