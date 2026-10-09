// Íconos SVG de línea (Lucide, licencia ISC). Origen y licencia en LICENSES.md.
// Se importan como texto para poder pintarlos con currentColor desde el CSS.

const files = import.meta.glob('./svg/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

export type IconName =
  | 'angry'
  | 'briefcase'
  | 'calendar'
  | 'chevrons-right'
  | 'circle-arrow-up'
  | 'circle-dollar-sign'
  | 'circle-help'
  | 'droplet'
  | 'eye'
  | 'factory'
  | 'fast-forward'
  | 'file-plus'
  | 'fire-extinguisher'
  | 'flame'
  | 'frown'
  | 'graduation-cap'
  | 'hospital'
  | 'house'
  | 'info'
  | 'landmark'
  | 'laugh'
  | 'layers'
  | 'lock'
  | 'map-pin'
  | 'map-plus'
  | 'meh'
  | 'mouse-pointer-2'
  | 'pause'
  | 'piggy-bank'
  | 'play'
  | 'route'
  | 'save'
  | 'school'
  | 'scissors'
  | 'siren'
  | 'smile'
  | 'store'
  | 'trash-2'
  | 'trees'
  | 'trending-up'
  | 'triangle-alert'
  | 'trophy'
  | 'users'
  | 'volume-2'
  | 'volume-x'
  | 'wallet'
  | 'x'
  | 'zap-off'
  | 'zap';

const SVGS = new Map<string, string>();
for (const [path, raw] of Object.entries(files)) {
  const name = path.replace('./svg/', '').replace('.svg', '');
  // Sin el comentario de licencia ni el tamaño fijo: el tamaño lo pone el CSS.
  const clean = raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s(width|height)="24"/g, '')
    .replace(/class="[^"]*"/, 'aria-hidden="true" focusable="false"')
    .trim();
  SVGS.set(name, clean);
}

/** Marcado SVG del ícono (trazo en currentColor). */
export function iconSvg(name: IconName): string {
  return SVGS.get(name) ?? '';
}

/** Ícono listo para insertar en el HTML. size: sm, md o lg (ver --icon-* en theme.css). */
export function icon(name: IconName, size: 'sm' | 'md' | 'lg' = 'md'): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = `icon icon-${size}`;
  span.innerHTML = iconSvg(name);
  return span;
}
