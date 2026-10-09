import { Container, Sprite } from 'pixi.js';
import { hash2 } from '../core/noise';
import { Zone } from '../core/types';
import { BUILDING_BASE_OFFSET_Y, BUILDING_STYLES, SPRITE_ORIGIN } from '../data/sprites';
import { tex } from './assets';
import { tileToWorld } from './iso';

const STYLE_BY_ZONE = {
  [Zone.Residential]: BUILDING_STYLES.residential,
  [Zone.Commercial]: BUILDING_STYLES.commercial,
  [Zone.Industrial]: BUILDING_STYLES.industrial,
} as const;

function pick<T>(list: readonly T[], x: number, y: number, salt: number): T {
  return list[Math.floor(hash2(x, y, salt) * list.length)] ?? list[0]!;
}

/**
 * Arma un edificio apilando piezas: planta baja con vereda, pisos y techo.
 * Las variantes salen de la posición, así que el mismo lote siempre se ve igual.
 */
export function createBuilding(zone: Zone, level: number, x: number, y: number): Container {
  const out = new Container();
  if (zone === Zone.None || level === 0) return out;
  const def = STYLE_BY_ZONE[zone];
  const style = pick(def.styles, x, y, 101);
  const top = tileToWorld(x, y);

  const base = new Sprite(tex(pick(style.bases, x, y, 102)));
  base.position.set(top.x - SPRITE_ORIGIN.x, top.y - BUILDING_BASE_OFFSET_Y);
  out.addChild(base);
  // Borde superior de la última pieza (el vértice de arriba del rombo de su techo).
  let curTop = base.y + 1;

  const stack = (name: string): void => {
    const sprite = new Sprite(tex(name));
    const w = sprite.texture.width;
    const h = sprite.texture.height;
    sprite.position.set(top.x - w / 2, Math.round(curTop + w / 2 - h));
    out.addChild(sprite);
    curTop = sprite.y;
  };

  let floors = def.floorsByLevel[level] ?? 0;
  if (level === 3 && def.extraFloorsLevel3 > 0) floors += Math.floor(hash2(x, y, 103) * (def.extraFloorsLevel3 + 1));
  const floor = pick(style.floors, x, y, 104);
  for (let i = 0; i < floors; i++) stack(floor);

  if (floors > 0 || def.roofOnGroundFloor) {
    const roofs = level >= def.flatRoofFromLevel ? def.flatRoofs : style.roofs;
    stack(pick(roofs, x, y, 105));
  }
  return out;
}
