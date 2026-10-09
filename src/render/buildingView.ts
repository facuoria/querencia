import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { hash2 } from '../core/noise';
import { ServiceType, Zone } from '../core/types';
import { SERVICES } from '../data/services';
import { BUILDING_BASE_OFFSET_Y, BUILDING_STYLES, SERVICE_SPRITES, SPRITE_ORIGIN } from '../data/sprites';
import { tex } from './assets';
import { tileToWorld } from './iso';

/** Tinte de un edificio en llamas. */
const FIRE_TINT = 0xffa07a;

const STYLE_BY_ZONE = {
  [Zone.Residential]: BUILDING_STYLES.residential,
  [Zone.Commercial]: BUILDING_STYLES.commercial,
  [Zone.Industrial]: BUILDING_STYLES.industrial,
} as const;

function pick<T>(list: readonly T[], x: number, y: number, salt: number): T {
  return list[Math.floor(hash2(x, y, salt) * list.length)] ?? list[0]!;
}

/** Apila piezas de edificio sobre una casilla: la base primero, después pisos y techo. */
class Stacker {
  readonly container = new Container();
  /** Borde superior de la última pieza (vértice de arriba del rombo de su techo). */
  top: number;
  private readonly cx: number;

  constructor(x: number, y: number, base: string) {
    const corner = tileToWorld(x, y);
    this.cx = corner.x;
    const sprite = new Sprite(tex(base));
    sprite.position.set(corner.x - SPRITE_ORIGIN.x, corner.y - BUILDING_BASE_OFFSET_Y);
    this.container.addChild(sprite);
    this.top = sprite.y + 1;
  }

  add(name: string): void {
    const sprite = new Sprite(tex(name));
    const w = sprite.texture.width;
    const h = sprite.texture.height;
    sprite.position.set(this.cx - w / 2, Math.round(this.top + w / 2 - h));
    this.container.addChild(sprite);
    this.top = sprite.y;
  }

  /** Ícono redondo flotando sobre el edificio. */
  badge(icon: string, warning: boolean): void {
    const g = new Graphics()
      .circle(0, 0, 17)
      .fill({ color: warning ? 0xffe1dc : 0xffffff, alpha: 0.95 })
      .stroke({ width: 3, color: warning ? 0xe0463a : 0x2b3644 });
    const text = new Text({ text: icon, style: { fontSize: 20 } });
    text.anchor.set(0.5);
    const badge = new Container();
    badge.addChild(g, text);
    badge.position.set(this.cx, this.top - 22);
    this.container.addChild(badge);
  }
}

/**
 * Arma un edificio de zona apilando piezas: planta baja con vereda, pisos y techo.
 * Las variantes salen de la posición, así que el mismo lote siempre se ve igual.
 */
export function createBuilding(zone: Zone, level: number, x: number, y: number, burning = false): Container {
  if (zone === Zone.None || level === 0) return new Container();
  const def = STYLE_BY_ZONE[zone];
  const style = pick(def.styles, x, y, 101);
  const s = new Stacker(x, y, pick(style.bases, x, y, 102));

  let floors = def.floorsByLevel[level] ?? 0;
  if (level === 3 && def.extraFloorsLevel3 > 0) floors += Math.floor(hash2(x, y, 103) * (def.extraFloorsLevel3 + 1));
  const floor = pick(style.floors, x, y, 104);
  for (let i = 0; i < floors; i++) s.add(floor);

  if (floors > 0 || def.roofOnGroundFloor) {
    const roofs = level >= def.flatRoofFromLevel ? def.flatRoofs : style.roofs;
    s.add(pick(roofs, x, y, 105));
  }
  if (burning) {
    s.container.tint = FIRE_TINT;
    s.badge('🔥', true);
  }
  return s.container;
}

/** Edificio de servicio con su ícono. Si no funciona (sin calle), el ícono se marca en rojo. */
export function createService(type: ServiceType, level: number, x: number, y: number, working: boolean): Container {
  const sprite = SERVICE_SPRITES[type];
  if (type === ServiceType.None || !sprite) return new Container();
  const s = new Stacker(x, y, sprite.base);
  const floors = sprite.floorsByLevel[level - 1] ?? 0;
  for (let i = 0; i < floors; i++) s.add(sprite.floor);
  if (sprite.roof) s.add(sprite.roof);
  s.badge(SERVICES[type].icon, !working);
  return s.container;
}
