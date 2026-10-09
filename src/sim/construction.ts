import type { CityState } from '../core/cityState';
import { Road, Terrain, type TileCoord } from '../core/types';
import { COSTS } from '../data/config';
import { TEXTS } from '../data/texts';

export const TileStatus = {
  /** Se construye o se demuele. */
  Ok: 0,
  /** Ya hay calle: no se cobra ni se toca. */
  Existing: 1,
  /** No se puede: agua, sector bloqueado o autopista. */
  Invalid: 2,
} as const;
export type TileStatus = (typeof TileStatus)[keyof typeof TileStatus];

export interface PlannedTile extends TileCoord {
  status: TileStatus;
}

export interface Plan {
  tiles: PlannedTile[];
  cost: number;
  /** Motivo por el que no se puede hacer, o null si se puede. */
  error: string | null;
}

/** Recorrido en L entre dos casillas: primero por el eje con más distancia. */
export function lPath(from: TileCoord, to: TileCoord): TileCoord[] {
  const out: TileCoord[] = [];
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  const xFirst = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y);
  let x = from.x;
  let y = from.y;
  out.push({ x, y });
  if (xFirst) {
    while (x !== to.x) out.push({ x: (x += dx), y });
    while (y !== to.y) out.push({ x, y: (y += dy) });
  } else {
    while (y !== to.y) out.push({ x, y: (y += dy) });
    while (x !== to.x) out.push({ x: (x += dx), y });
  }
  return out;
}

export function planRoad(state: CityState, path: TileCoord[]): Plan {
  let cost = 0;
  let error: string | null = null;
  const tiles = path.map((p): PlannedTile => {
    if (!state.inBounds(p.x, p.y)) return { ...p, status: TileStatus.Invalid };
    if (state.getRoad(p.x, p.y) !== Road.None) return { ...p, status: TileStatus.Existing };
    if (!state.isTileUnlocked(p.x, p.y)) {
      error ??= TEXTS.errors.locked;
      return { ...p, status: TileStatus.Invalid };
    }
    if (state.getTerrain(p.x, p.y) === Terrain.Water) {
      error ??= TEXTS.errors.water;
      return { ...p, status: TileStatus.Invalid };
    }
    cost += COSTS.road + (state.getTerrain(p.x, p.y) === Terrain.Forest ? COSTS.clearForest : 0);
    return { ...p, status: TileStatus.Ok };
  });
  if (!error && cost > state.money) error = TEXTS.errors.noMoney;
  return { tiles, cost, error };
}

/** Construye el plan si es válido. Devuelve el error, o null si se construyó. */
export function buildRoad(state: CityState, plan: Plan): string | null {
  if (plan.error) return plan.error;
  for (const t of plan.tiles) {
    if (t.status !== TileStatus.Ok) continue;
    if (state.getTerrain(t.x, t.y) === Terrain.Forest) state.setTerrain(t.x, t.y, Terrain.Grass);
    state.setRoad(t.x, t.y, Road.Street);
  }
  state.money -= plan.cost;
  return null;
}

/** Todas las casillas del rectángulo entre dos esquinas. */
export function rectArea(a: TileCoord, b: TileCoord): TileCoord[] {
  const out: TileCoord[] = [];
  for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) {
    for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) out.push({ x, y });
  }
  return out;
}

export function planDemolish(state: CityState, area: TileCoord[]): Plan {
  let cost = 0;
  let touchesHighway = false;
  const tiles: PlannedTile[] = [];
  for (const p of area) {
    if (!state.inBounds(p.x, p.y)) continue;
    const road = state.getRoad(p.x, p.y);
    if (road === Road.Highway) {
      touchesHighway = true;
      tiles.push({ ...p, status: TileStatus.Invalid });
      continue;
    }
    const hasSomething = road === Road.Street || state.getTerrain(p.x, p.y) === Terrain.Forest;
    if (!hasSomething) continue;
    if (!state.isTileUnlocked(p.x, p.y)) {
      tiles.push({ ...p, status: TileStatus.Invalid });
      continue;
    }
    cost += COSTS.demolish;
    tiles.push({ ...p, status: TileStatus.Ok });
  }
  let error: string | null = null;
  if (cost === 0) error = touchesHighway ? TEXTS.errors.highway : TEXTS.errors.nothing;
  else if (cost > state.money) error = TEXTS.errors.noMoney;
  return { tiles, cost, error };
}

export function demolish(state: CityState, plan: Plan): string | null {
  if (plan.error) return plan.error;
  for (const t of plan.tiles) {
    if (t.status !== TileStatus.Ok) continue;
    if (state.getRoad(t.x, t.y) === Road.Street) state.setRoad(t.x, t.y, Road.None);
    else if (state.getTerrain(t.x, t.y) === Terrain.Forest) state.setTerrain(t.x, t.y, Terrain.Grass);
  }
  state.money -= plan.cost;
  return null;
}
