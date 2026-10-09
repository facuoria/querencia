/** Avisos breves que desaparecen solos. */
export class Toast {
  private readonly el: HTMLDivElement;
  private timer = 0;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'toast';
    parent.append(this.el);
  }

  show(message: string): void {
    this.el.textContent = message;
    this.el.classList.add('visible');
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.el.classList.remove('visible'), 2200);
  }
}

/** Costo de la construcción en curso, pegado al cursor. */
export class CursorLabel {
  private readonly el: HTMLDivElement;
  private last = '';

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'cursor-label';
    parent.append(this.el);
  }

  update(text: string | null, x: number, y: number, error: boolean): void {
    if (!text) {
      if (this.last !== '') this.el.style.display = 'none';
      this.last = '';
      return;
    }
    this.el.style.display = 'block';
    this.el.style.transform = `translate(${x + 18}px, ${y + 14}px)`;
    const key = `${text}|${error}`;
    if (key === this.last) return;
    this.last = key;
    this.el.textContent = text;
    this.el.classList.toggle('error', error);
  }
}
