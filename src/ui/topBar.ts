import type { CityState } from '../core/cityState';
import { TIME } from '../data/config';
import { TEXTS } from '../data/texts';
import { dateOf, type GameClock } from '../sim/clock';

export function formatMoney(n: number): string {
  return `$ ${Math.round(n).toLocaleString('es-AR')}`;
}

/** Dinero, fecha y control de velocidad. */
export class TopBar {
  private readonly money: HTMLSpanElement;
  private readonly date: HTMLSpanElement;
  private readonly speedButtons: HTMLButtonElement[] = [];
  private readonly soundButton: HTMLButtonElement;
  private last = '';

  constructor(
    parent: HTMLElement,
    private readonly state: CityState,
    private readonly clock: GameClock,
    onBudget: () => void,
    onSave: () => void,
    onNewGame: () => void,
    onHelp: () => void,
    private readonly sound: { muted: boolean; toggleMute: () => void },
  ) {
    const bar = document.createElement('div');
    bar.className = 'hud-panel top-bar';
    this.money = document.createElement('span');
    this.money.className = 'top-money';
    this.date = document.createElement('span');
    this.date.className = 'top-date';
    const speeds = document.createElement('div');
    speeds.className = 'speed-buttons';
    TIME.speeds.forEach((mult, i) => {
      const b = document.createElement('button');
      b.textContent = i === 0 ? '❚❚' : `x${mult}`;
      b.title = i === 0 ? TEXTS.time.pause : `x${mult}`;
      b.addEventListener('click', () => clock.setSpeed(i));
      this.speedButtons.push(b);
      speeds.append(b);
    });
    const budget = document.createElement('button');
    budget.textContent = `📊 ${TEXTS.budget.button}`;
    budget.addEventListener('click', onBudget);
    const save = document.createElement('button');
    save.textContent = '💾';
    save.title = TEXTS.save.save;
    save.addEventListener('click', onSave);
    const fresh = document.createElement('button');
    fresh.textContent = '🆕';
    fresh.title = TEXTS.save.newGame;
    fresh.addEventListener('click', onNewGame);
    const help = document.createElement('button');
    help.textContent = '❔';
    help.title = TEXTS.helpButton;
    help.addEventListener('click', onHelp);
    this.soundButton = document.createElement('button');
    this.soundButton.addEventListener('click', () => sound.toggleMute());
    bar.append(this.money, budget, this.date, speeds, save, fresh, this.soundButton, help);
    parent.append(bar);
  }

  update(): void {
    const d = dateOf(this.state.day);
    const key = `${Math.round(this.state.money)}|${this.state.day}|${this.clock.speedIndex}|${this.sound.muted}`;
    if (key === this.last) return;
    this.last = key;
    this.money.textContent = formatMoney(this.state.money);
    this.money.classList.toggle('negative', this.state.money < 0);
    this.date.textContent = `${d.day} de ${TEXTS.time.months[d.month]}, ${TEXTS.time.year} ${d.year}`;
    this.speedButtons.forEach((b, i) => b.classList.toggle('active', i === this.clock.speedIndex));
    this.soundButton.textContent = this.sound.muted ? '🔇' : '🔊';
    this.soundButton.title = this.sound.muted ? TEXTS.sound.off : TEXTS.sound.on;
  }
}
