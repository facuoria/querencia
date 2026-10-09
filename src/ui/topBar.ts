import type { CityState } from '../core/cityState';
import { TIME } from '../data/config';
import { TEXTS } from '../data/texts';
import { dateOf, type GameClock } from '../sim/clock';
import { icon, iconSvg, type IconName } from './icons';
import { tooltip } from './tooltip';

export function formatMoney(n: number): string {
  return `$ ${Math.round(n).toLocaleString('es-AR')}`;
}

/** Ícono de cara según el ánimo (0 a 100). */
export function moodIconName(h: number): IconName {
  return h >= 70 ? 'laugh' : h >= 55 ? 'smile' : h >= 40 ? 'meh' : h >= 25 ? 'frown' : 'angry';
}

/** Estado del ánimo para el color: bueno, atención o crítico. */
export function moodState(h: number): 'good' | 'warn' | 'bad' {
  return h >= 55 ? 'good' : h >= 35 ? 'warn' : 'bad';
}

export interface TopBarActions {
  onBudget: () => void;
  onSave: () => void;
  onNewGame: () => void;
  onHelp: () => void;
}

interface Stat {
  root: HTMLDivElement;
  icon: HTMLSpanElement;
  value: HTMLSpanElement;
}

function stat(iconName: IconName, label: string, cls = ''): Stat {
  const root = document.createElement('div');
  root.className = `stat ${cls}`;
  const ic = icon(iconName, 'lg');
  const text = document.createElement('div');
  text.className = 'stat-text';
  const l = document.createElement('span');
  l.className = 'stat-label';
  l.textContent = label;
  const value = document.createElement('span');
  value.className = 'stat-value mono';
  text.append(l, value);
  root.append(ic, text);
  return { root, icon: ic, value };
}

function iconButton(name: IconName): { button: HTMLButtonElement; glyph: HTMLSpanElement } {
  const button = document.createElement('button');
  button.className = 'icon-button';
  const glyph = icon(name);
  button.append(glyph);
  return { button, glyph };
}

/**
 * Barra superior. A la izquierda lo más importante (dinero, población, ánimo), en el centro
 * la fecha y la velocidad, y a la derecha las acciones de la partida.
 */
export class TopBar {
  private readonly money: Stat;
  private readonly population: Stat;
  private readonly mood: Stat;
  private readonly date: Stat;
  private readonly speedButtons: HTMLButtonElement[] = [];
  private readonly soundGlyph: HTMLSpanElement;
  private last = '';

  constructor(
    parent: HTMLElement,
    private readonly state: CityState,
    private readonly clock: GameClock,
    actions: TopBarActions,
    private readonly sound: { muted: boolean; toggleMute: () => void },
  ) {
    const t = TEXTS.top;
    const bar = document.createElement('div');
    bar.className = 'panel top-bar';

    const brand = document.createElement('div');
    brand.className = 'brand';
    brand.textContent = TEXTS.title;

    this.money = stat('wallet', t.money, 'stat-primary');
    this.population = stat('users', t.population, 'stat-primary');
    this.mood = stat('smile', t.happiness, 'stat-primary');
    const left = document.createElement('div');
    left.className = 'top-group';
    left.append(brand, this.money.root, this.population.root, this.mood.root);

    this.date = stat('calendar', t.date);
    const speeds = document.createElement('div');
    speeds.className = 'segmented';
    speeds.setAttribute('role', 'group');
    const speedTips = [
      { title: t.pause, key: TEXTS.keys.space },
      { title: t.speed1, key: '1' },
      { title: t.speed2, key: '2' },
      { title: t.speed3, key: '3' },
    ];
    TIME.speeds.forEach((mult, i) => {
      const b = document.createElement('button');
      if (i === 0) b.append(icon('pause'));
      else {
        b.append(icon(i === 1 ? 'play' : 'fast-forward', 'sm'));
        const label = document.createElement('span');
        label.className = 'mono';
        label.textContent = `x${mult}`;
        b.append(label);
      }
      b.addEventListener('click', () => clock.setSpeed(i));
      tooltip.attach(b, speedTips[i]!);
      this.speedButtons.push(b);
      speeds.append(b);
    });
    const center = document.createElement('div');
    center.className = 'top-group';
    center.append(this.date.root, speeds);

    const budget = document.createElement('button');
    budget.className = 'text-button';
    const budgetLabel = document.createElement('span');
    budgetLabel.textContent = TEXTS.budget.button;
    budget.append(icon('landmark'), budgetLabel);
    budget.addEventListener('click', actions.onBudget);
    tooltip.attach(budget, { title: TEXTS.budget.button, description: t.budgetHint });

    const save = iconButton('save');
    save.button.addEventListener('click', actions.onSave);
    tooltip.attach(save.button, { title: TEXTS.save.save, description: t.saveHint });
    const fresh = iconButton('file-plus');
    fresh.button.addEventListener('click', actions.onNewGame);
    tooltip.attach(fresh.button, { title: TEXTS.save.newGame, description: t.newGameHint });
    const soundButton = iconButton('volume-2');
    this.soundGlyph = soundButton.glyph;
    soundButton.button.addEventListener('click', () => sound.toggleMute());
    tooltip.attach(soundButton.button, () => ({ title: this.sound.muted ? t.soundOff : t.soundOn, key: 'M' }));
    const help = iconButton('circle-help');
    help.button.addEventListener('click', actions.onHelp);
    tooltip.attach(help.button, { title: TEXTS.helpTitle, key: 'H', description: t.helpHint });
    const right = document.createElement('div');
    right.className = 'top-group';
    right.append(budget, save.button, fresh.button, soundButton.button, help.button);

    bar.append(left, center, right);
    parent.append(bar);
  }

  update(): void {
    const st = this.state;
    const h = Math.round(st.stats.happiness);
    const key = `${Math.round(st.money)}|${st.day}|${this.clock.speedIndex}|${this.sound.muted}|${st.stats.population}|${h}`;
    if (key === this.last) return;
    this.last = key;
    this.money.value.textContent = formatMoney(st.money);
    this.money.root.dataset.state = st.money < 0 ? 'bad' : '';
    this.population.value.textContent = st.stats.population.toLocaleString('es-AR');
    this.mood.value.textContent = String(h);
    this.mood.icon.innerHTML = iconSvg(moodIconName(h));
    this.mood.root.dataset.state = moodState(h);
    const d = dateOf(st.day);
    this.date.value.textContent = `${d.day} ${TEXTS.time.months[d.month]!.slice(0, 3)} · ${TEXTS.time.year} ${d.year}`;
    this.speedButtons.forEach((b, i) => {
      b.classList.toggle('active', i === this.clock.speedIndex);
      b.setAttribute('aria-pressed', String(i === this.clock.speedIndex));
    });
    this.soundGlyph.innerHTML = iconSvg(this.sound.muted ? 'volume-x' : 'volume-2');
  }
}
