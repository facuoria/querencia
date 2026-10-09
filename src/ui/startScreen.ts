import { TEXTS } from '../data/texts';

export interface SaveSummary {
  savedAt: string;
  population: number;
}

export type StartChoice = 'continue' | 'new';

/** Pantalla de inicio. Resuelve cuando el jugador elige continuar o empezar de nuevo. */
export function showStartScreen(save: SaveSummary | null): Promise<StartChoice> {
  const t = TEXTS.start;
  const screen = document.createElement('div');
  screen.className = 'start-screen';
  const card = document.createElement('div');
  card.className = 'start-card';
  const title = document.createElement('h1');
  title.textContent = t.title;
  const subtitle = document.createElement('p');
  subtitle.className = 'start-subtitle';
  subtitle.textContent = t.subtitle;
  const buttons = document.createElement('div');
  buttons.className = 'start-buttons';
  const tips = document.createElement('ul');
  tips.className = 'start-tips';
  for (const tip of t.tips) {
    const li = document.createElement('li');
    li.textContent = tip;
    tips.append(li);
  }
  card.append(title, subtitle, buttons, tips);
  screen.append(card);
  document.body.append(screen);

  return new Promise((resolve) => {
    const choose = (choice: StartChoice): void => {
      screen.remove();
      resolve(choice);
    };
    if (save) {
      const cont = document.createElement('button');
      cont.className = 'primary';
      const date = new Date(save.savedAt).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
      cont.innerHTML = '';
      const label = document.createElement('span');
      label.textContent = t.continue;
      const detail = document.createElement('small');
      detail.textContent = `${t.savedOn} ${date} · ${save.population.toLocaleString('es-AR')} ${TEXTS.zones.residents}`;
      cont.append(label, detail);
      cont.addEventListener('click', () => choose('continue'));
      buttons.append(cont);
    }
    const fresh = document.createElement('button');
    if (!save) fresh.className = 'primary';
    fresh.textContent = t.newGame;
    fresh.addEventListener('click', () => {
      if (save && !window.confirm(TEXTS.save.confirmNew)) return;
      choose('new');
    });
    buttons.append(fresh);
  });
}
