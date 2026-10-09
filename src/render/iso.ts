import { ISO } from '../data/config';

export const HALF_W = ISO.tileWidth / 2;
export const HALF_H = ISO.tileHeight / 2;

/** Esquina superior del rombo de la casilla, en coordenadas del mundo. */
export function tileToWorld(x: number, y: number): { x: number; y: number } {
  return { x: (x - y) * HALF_W, y: (x + y) * HALF_H };
}

/** Casilla que contiene el punto del mundo (puede quedar fuera del mapa). */
export function worldToTile(wx: number, wy: number): { x: number; y: number } {
  const a = wx / HALF_W;
  const b = wy / HALF_H;
  return { x: Math.floor((a + b) / 2), y: Math.floor((b - a) / 2) };
}

/** Los cuatro vértices del rombo de la casilla: arriba, derecha, abajo, izquierda. */
export function tileDiamond(x: number, y: number): number[] {
  const p = tileToWorld(x, y);
  return [p.x, p.y, p.x + HALF_W, p.y + HALF_H, p.x, p.y + 2 * HALF_H, p.x - HALF_W, p.y + HALF_H];
}

export function darken(color: number, factor: number): number {
  const r = Math.round(((color >> 16) & 0xff) * factor);
  const g = Math.round(((color >> 8) & 0xff) * factor);
  const b = Math.round((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}
