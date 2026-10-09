import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { CityState } from '../core/cityState';
import { ServiceType } from '../core/types';
import { INDICATORS } from '../data/config';
import { SERVICE_LIST } from '../data/services';
import { iconSvg, type IconName } from '../ui/icons';
import { tileToWorld } from './iso';

/** Gravedad de un indicador: los problemas se ven siempre; la información, solo de cerca. */
type Severity = 'bad' | 'info';

interface Candidate {
  x: number;
  y: number;
  kind: string;
  severity: Severity;
  /** Altura sobre el centro de la casilla, en unidades del mundo. */
  lift: number;
}

interface ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface Projector {
  zoom: number;
  worldToScreen(wx: number, wy: number): { x: number; y: number };
}

/** Rasteriza un ícono SVG en un círculo, para usarlo como textura en el mapa. */
async function badgeTexture(name: IconName, stroke: string, fill: string, ring: string): Promise<Texture> {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = ring;
  ctx.stroke();
  const svg = iconSvg(name)
    .replace('<svg', `<svg width="36" height="36"`)
    .replace(/currentColor/g, stroke);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  ctx.drawImage(img, (size - 36) / 2, (size - 36) / 2, 36, 36);
  return Texture.from(canvas);
}

/**
 * Indicadores sobre el mapa (incendios, servicios sin calle, íconos de servicios).
 * Se dibujan en coordenadas de pantalla con tamaño legible, se agrupan para no amontonarse
 * y no aparecen debajo de los paneles de la interfaz.
 */
export class Indicators {
  readonly layer = new Container();
  private readonly textures = new Map<string, Texture>();
  private candidates: Candidate[] = [];
  private refreshedAt = 0;
  private readonly pool: Array<{ root: Container; sprite: Sprite; count: Text; countBg: Graphics }> = [];
  private readonly pings: Array<{ x: number; y: number; until: number; g: Graphics }> = [];

  constructor(
    private readonly state: CityState,
    private readonly isServiceWorking: (x: number, y: number) => boolean,
  ) {}

  /** Prepara las texturas. Hay que esperarlo antes de usar la capa. */
  async load(colors: { paper: string; ink: string; accent: string; bad: string }): Promise<void> {
    this.textures.set('fire', await badgeTexture('flame', colors.paper, colors.bad, colors.bad));
    this.textures.set('broken', await badgeTexture('triangle-alert', colors.paper, colors.bad, colors.bad));
    for (const def of SERVICE_LIST) {
      this.textures.set(`service-${def.type}`, await badgeTexture(def.icon, colors.accent, colors.paper, colors.accent));
    }
  }

  /** Recalcula qué hay para mostrar. Se llama al cambiar el estado (cada día o al construir). */
  refresh(): void {
    this.refreshedAt = performance.now();
    const st = this.state;
    const n = st.size;
    const out: Candidate[] = [];
    for (let i = 0; i < st.fire.length; i++) {
      const x = i % n;
      const y = (i - x) / n;
      if (st.fire[i]! > 0) out.push({ x, y, kind: 'fire', severity: 'bad', lift: INDICATORS.liftBuilding });
      const service = st.service[i] as ServiceType;
      if (service === ServiceType.None) continue;
      const working = this.isServiceWorking(x, y);
      out.push({
        x,
        y,
        kind: working ? `service-${service}` : 'broken',
        severity: working ? 'info' : 'bad',
        lift: INDICATORS.liftBuilding,
      });
    }
    this.candidates = out;
  }

  /** Marca un lugar por unos segundos (por ejemplo, al hacer clic en una alerta). */
  ping(x: number, y: number): void {
    const g = new Graphics();
    this.layer.addChild(g);
    this.pings.push({ x, y, until: performance.now() + INDICATORS.pingMs, g });
  }

  /** Ubica los indicadores para el cuadro actual. blocked: rectángulos de pantalla tapados por paneles. */
  update(view: Projector, blocked: ScreenRect[]): void {
    // Además de los avisos explícitos, se revisa el estado dos veces por segundo (recorrerlo es barato).
    const now0 = performance.now();
    if (now0 - this.refreshedAt > 500) this.refresh();
    const zoom = view.zoom;
    const size = Math.max(INDICATORS.minSize, Math.min(INDICATORS.maxSize, INDICATORS.baseSize * (0.6 + zoom * 0.5)));
    const showInfo = zoom >= INDICATORS.infoMinZoom;
    const cell = size * INDICATORS.clusterFactor;

    // Agrupa por celdas de pantalla: en cada celda queda el más grave, con la cantidad.
    const cells = new Map<string, { c: Candidate; sx: number; sy: number; count: number }>();
    for (const c of this.candidates) {
      if (c.severity === 'info' && !showInfo) continue;
      if (zoom < INDICATORS.minZoom) continue;
      const w = tileToWorld(c.x + 0.5, c.y + 0.5);
      const p = view.worldToScreen(w.x, w.y - c.lift);
      if (blocked.some((r) => p.x > r.left - size / 2 && p.x < r.right + size / 2 && p.y > r.top - size / 2 && p.y < r.bottom + size / 2)) {
        continue;
      }
      if (p.x < 0 || p.y < 0 || p.x > window.innerWidth || p.y > window.innerHeight) continue;
      const key = `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`;
      const prev = cells.get(key);
      if (!prev) cells.set(key, { c, sx: p.x, sy: p.y, count: 1 });
      else {
        prev.count++;
        if (prev.c.severity !== 'bad' && c.severity === 'bad') {
          prev.c = c;
          prev.sx = p.x;
          prev.sy = p.y;
        }
      }
    }

    let used = 0;
    for (const { c, sx, sy, count } of cells.values()) {
      if (used >= INDICATORS.maxVisible) break;
      const item = this.item(used++);
      item.root.visible = true;
      item.root.position.set(Math.round(sx), Math.round(sy));
      item.sprite.texture = this.textures.get(c.kind) ?? Texture.EMPTY;
      item.sprite.width = size;
      item.sprite.height = size;
      const many = count > 1;
      item.count.visible = many;
      item.countBg.visible = many;
      if (many) {
        item.count.text = count > 99 ? '99+' : String(count);
        item.countBg.position.set(size * 0.38, -size * 0.38);
        item.count.position.set(size * 0.38, -size * 0.38);
      }
    }
    for (let k = used; k < this.pool.length; k++) this.pool[k]!.root.visible = false;

    const now = performance.now();
    for (let k = this.pings.length - 1; k >= 0; k--) {
      const ping = this.pings[k]!;
      if (now > ping.until) {
        ping.g.destroy();
        this.pings.splice(k, 1);
        continue;
      }
      const t = 1 - (ping.until - now) / INDICATORS.pingMs;
      const w = tileToWorld(ping.x + 0.5, ping.y + 0.5);
      const p = view.worldToScreen(w.x, w.y);
      const r = 18 + ((t * 3) % 1) * 26;
      ping.g.clear().circle(p.x, p.y, r).stroke({ width: 3, color: INDICATORS.pingColor, alpha: 1 - ((t * 3) % 1) });
    }
  }

  private item(k: number): { root: Container; sprite: Sprite; count: Text; countBg: Graphics } {
    let item = this.pool[k];
    if (!item) {
      const root = new Container();
      const sprite = new Sprite();
      sprite.anchor.set(0.5);
      const countBg = new Graphics().circle(0, 0, 9).fill(INDICATORS.countFill);
      const count = new Text({
        text: '',
        style: { fontFamily: 'IBM Plex Mono, Consolas, monospace', fontSize: 11, fontWeight: '600', fill: INDICATORS.countText },
      });
      count.anchor.set(0.5);
      root.addChild(sprite, countBg, count);
      this.layer.addChild(root);
      item = { root, sprite, count, countBg };
      this.pool.push(item);
    }
    return item;
  }
}
