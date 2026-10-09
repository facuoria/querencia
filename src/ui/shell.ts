/** Zonas fijas de la pantalla. Los paneles van dentro de cada zona y nunca se pisan entre sí. */
export interface Shell {
  root: HTMLDivElement;
  top: HTMLElement;
  left: HTMLElement;
  center: HTMLElement;
  right: HTMLElement;
  bottom: HTMLElement;
}

function region(tag: 'header' | 'aside' | 'main' | 'footer', cls: string): HTMLElement {
  const el = document.createElement(tag);
  el.className = `region ${cls}`;
  return el;
}

/**
 * Grilla de la interfaz: barra superior, columna izquierda, centro libre (el mapa se ve),
 * columna derecha y barra inferior. Las zonas no capturan el mouse; solo los paneles.
 */
export function createShell(): Shell {
  const root = document.createElement('div');
  root.id = 'ui';
  const shell: Shell = {
    root,
    top: region('header', 'region-top'),
    left: region('aside', 'region-left'),
    center: region('main', 'region-center'),
    right: region('aside', 'region-right'),
    bottom: region('footer', 'region-bottom'),
  };
  root.append(shell.top, shell.left, shell.center, shell.right, shell.bottom);
  document.body.appendChild(root);
  return shell;
}

/** Panel con título opcional. */
export function panel(cls: string, title?: string): { el: HTMLElement; body: HTMLElement } {
  const el = document.createElement('section');
  el.className = `panel ${cls}`;
  if (title) {
    const h = document.createElement('h2');
    h.className = 'panel-title';
    h.textContent = title;
    el.append(h);
  }
  const body = document.createElement('div');
  body.className = 'panel-body';
  el.append(body);
  return { el, body };
}
