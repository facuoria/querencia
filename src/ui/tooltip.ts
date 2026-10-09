import { TEXTS } from '../data/texts';

/** Contenido de una ayuda emergente. */
export interface TipContent {
  title: string;
  /** Costo ya formateado, por ejemplo "$ 3.000". */
  cost?: string;
  /** Tecla de atajo. */
  key?: string;
  description?: string;
  /** Si está bloqueado: qué hay que lograr para usarlo. */
  locked?: string | null;
}

type TipSource = TipContent | (() => TipContent);

/**
 * Ayudas emergentes propias: a diferencia del atributo title, se ven también en botones
 * bloqueados y muestran nombre, costo, atajo, descripción y motivo del bloqueo.
 */
class TooltipManager {
  private el: HTMLDivElement | null = null;
  private timer = 0;
  private readonly sources = new WeakMap<Element, TipSource>();

  /** Asocia una ayuda a un elemento. Se puede llamar de nuevo para cambiarla. */
  attach(target: HTMLElement, source: TipSource): void {
    const first = !this.sources.has(target);
    this.sources.set(target, source);
    // Nombre accesible aunque el botón solo tenga ícono.
    const content = typeof source === 'function' ? source() : source;
    if (!target.getAttribute('aria-label') || !first) target.setAttribute('aria-label', content.title);
    if (!first) return;
    target.addEventListener('pointerenter', () => this.schedule(target));
    target.addEventListener('pointerleave', () => this.hide());
    target.addEventListener('pointerdown', () => this.hide());
    target.addEventListener('focus', () => this.show(target));
    target.addEventListener('blur', () => this.hide());
  }

  private schedule(target: HTMLElement): void {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.show(target), 280);
  }

  private hide(): void {
    window.clearTimeout(this.timer);
    if (this.el) this.el.classList.remove('visible');
  }

  private show(target: HTMLElement): void {
    const source = this.sources.get(target);
    if (!source) return;
    const c = typeof source === 'function' ? source() : source;
    const el = this.ensure();
    el.replaceChildren();
    const head = document.createElement('div');
    head.className = 'tip-head';
    const title = document.createElement('strong');
    title.textContent = c.title;
    head.append(title);
    if (c.key) {
      const key = document.createElement('kbd');
      key.textContent = c.key;
      head.append(key);
    }
    el.append(head);
    if (c.cost) {
      const cost = document.createElement('div');
      cost.className = 'tip-cost mono';
      cost.textContent = c.cost;
      el.append(cost);
    }
    if (c.description) {
      const d = document.createElement('div');
      d.className = 'tip-desc';
      d.textContent = c.description;
      el.append(d);
    }
    if (c.locked) {
      const l = document.createElement('div');
      l.className = 'tip-locked';
      l.textContent = `${TEXTS.tooltip.locked}: ${c.locked}`;
      el.append(l);
    }
    // Arriba del elemento si hay lugar; si no, abajo. Siempre dentro de la pantalla.
    el.style.left = '0px';
    el.style.top = '0px';
    el.classList.add('visible');
    const r = target.getBoundingClientRect();
    const t = el.getBoundingClientRect();
    const margin = 8;
    let x = r.left + r.width / 2 - t.width / 2;
    x = Math.max(margin, Math.min(window.innerWidth - t.width - margin, x));
    let y = r.top - t.height - margin;
    if (y < margin) y = r.bottom + margin;
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
  }

  private ensure(): HTMLDivElement {
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.className = 'tooltip';
      this.el.setAttribute('role', 'tooltip');
      document.body.append(this.el);
    }
    return this.el;
  }
}

export const tooltip = new TooltipManager();
