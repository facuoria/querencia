import type { CityState } from '../core/cityState';
import { Road, ServiceType, Terrain, Zone, type TileCoord } from '../core/types';
import { COSTS } from '../data/config';
import { MILESTONES } from '../data/config';
import { SERVICES, investedIn } from '../data/services';
import {
  isServiceUnlocked,
  isZoneUnlocked,
  maxServiceLevel,
  milestonePopulation,
  serviceLevelMilestone,
  serviceMilestone,
  zoneMilestone,
} from './milestones';
import { TEXTS } from '../data/texts';

export const TileStatus = {
  /** Se construye o se demuele. */
  Ok: 0,
  /** Ya está hecho: no se cobra ni se toca. */
  Existing: 1,
  /** No se puede: agua, sector bloqueado, edificio o autopista. */
  Invalid: 2,
} as const;
export type TileStatus = (typeof TileStatus)[keyof typeof TileStatus];

export interface PlannedTile extends TileCoord {
  status: TileStatus;
}

export interface Plan {
  tiles: PlannedTile[];
  /** Positivo: se paga. Negativo: se devuelve dinero. */
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

/** Todas las casillas del rectángulo entre dos esquinas. */
export function rectArea(a: TileCoord, b: TileCoord): TileCoord[] {
  const out: TileCoord[] = [];
  for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) {
    for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) out.push({ x, y });
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
    if (state.getLevel(p.x, p.y) > 0 || state.getService(p.x, p.y) !== ServiceType.None) {
      error ??= TEXTS.errors.building;
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
    // Una calle sobre un lote vacío borra la zona.
    if (state.getZone(t.x, t.y) !== Zone.None) state.setZone(t.x, t.y, Zone.None);
    state.setRoad(t.x, t.y, Road.Street);
  }
  state.money -= plan.cost;
  return null;
}

/**
 * Zonificar un rectángulo. Las casillas que no se pueden (calles, agua, sectores bloqueados)
 * se saltean en silencio; los edificios de otra zona se marcan en rojo y no se tocan.
 */
export function planZone(state: CityState, area: TileCoord[], zone: Zone): Plan {
  if (!isZoneUnlocked(state, zone)) return { tiles: [], cost: 0, error: lockedMessage(zoneMilestone(zone)) };
  let cost = 0;
  const tiles: PlannedTile[] = [];
  for (const p of area) {
    if (!state.inBounds(p.x, p.y)) continue;
    if (state.getRoad(p.x, p.y) !== Road.None) continue;
    if (state.getTerrain(p.x, p.y) === Terrain.Water || !state.isTileUnlocked(p.x, p.y)) continue;
    if (state.getService(p.x, p.y) !== ServiceType.None) continue;
    const current = state.getZone(p.x, p.y);
    if (current === zone) {
      tiles.push({ ...p, status: TileStatus.Existing });
    } else if (current !== Zone.None && state.getLevel(p.x, p.y) > 0) {
      tiles.push({ ...p, status: TileStatus.Invalid });
    } else {
      cost += COSTS.zone;
      tiles.push({ ...p, status: TileStatus.Ok });
    }
  }
  let error: string | null = null;
  if (tiles.length === 0) error = TEXTS.errors.nothingToZone;
  else if (cost > state.money) error = TEXTS.errors.noMoney;
  return { tiles, cost, error };
}

export function applyZone(state: CityState, plan: Plan, zone: Zone): string | null {
  if (plan.error) return plan.error;
  for (const t of plan.tiles) {
    if (t.status === TileStatus.Ok) state.setZone(t.x, t.y, zone);
  }
  state.money -= plan.cost;
  return null;
}

/** Lo que se devuelve al demoler: una parte de lo que costó construir. El costo del plan queda negativo. */
export function planDemolish(state: CityState, area: TileCoord[]): Plan {
  let cost = 0;
  let count = 0;
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
    const zoned = state.getZone(p.x, p.y) !== Zone.None;
    const service = state.getService(p.x, p.y);
    const hasSomething =
      road === Road.Street || zoned || service !== ServiceType.None || state.getTerrain(p.x, p.y) === Terrain.Forest;
    if (!hasSomething) continue;
    if (!state.isTileUnlocked(p.x, p.y)) {
      tiles.push({ ...p, status: TileStatus.Invalid });
      continue;
    }
    if (road === Road.Street) cost -= COSTS.road * COSTS.demolishRefund;
    else if (service !== ServiceType.None) {
      cost -= investedIn(SERVICES[service], state.getServiceLevel(p.x, p.y)) * COSTS.demolishRefund;
    } else if (zoned) cost -= COSTS.zone * COSTS.demolishRefund;
    count++;
    tiles.push({ ...p, status: TileStatus.Ok });
  }
  let error: string | null = null;
  if (count === 0) error = touchesHighway ? TEXTS.errors.highway : TEXTS.errors.nothing;
  return { tiles, cost: Math.floor(cost), error };
}

export function demolish(state: CityState, plan: Plan): string | null {
  if (plan.error) return plan.error;
  for (const t of plan.tiles) {
    if (t.status !== TileStatus.Ok) continue;
    if (state.getRoad(t.x, t.y) === Road.Street) state.setRoad(t.x, t.y, Road.None);
    else if (state.getService(t.x, t.y) !== ServiceType.None) state.setService(t.x, t.y, ServiceType.None);
    else if (state.getZone(t.x, t.y) !== Zone.None) state.setZone(t.x, t.y, Zone.None);
    else if (state.getTerrain(t.x, t.y) === Terrain.Forest) state.setTerrain(t.x, t.y, Terrain.Grass);
  }
  state.money -= plan.cost;
  return null;
}

/** Ubicar un edificio de servicio en una casilla libre (pasto, bosque o lote vacío). */
export function planService(state: CityState, p: TileCoord, type: Exclude<ServiceType, 0>): Plan {
  const def = SERVICES[type];
  const fail = (error: string): Plan => ({ tiles: [{ ...p, status: TileStatus.Invalid }], cost: def.cost, error });
  if (!isServiceUnlocked(state, type)) return fail(lockedMessage(serviceMilestone(type)));
  if (!state.inBounds(p.x, p.y)) return fail(TEXTS.errors.occupied);
  if (!state.isTileUnlocked(p.x, p.y)) return fail(TEXTS.errors.locked);
  if (state.getTerrain(p.x, p.y) === Terrain.Water) return fail(TEXTS.errors.water);
  const busy =
    state.getRoad(p.x, p.y) !== Road.None ||
    state.getService(p.x, p.y) !== ServiceType.None ||
    state.getLevel(p.x, p.y) > 0;
  if (busy) return fail(TEXTS.errors.occupied);
  if (def.cost > state.money) return fail(TEXTS.errors.noMoney);
  return { tiles: [{ ...p, status: TileStatus.Ok }], cost: def.cost, error: null };
}

export function buildService(state: CityState, plan: Plan, type: Exclude<ServiceType, 0>): string | null {
  if (plan.error) return plan.error;
  const t = plan.tiles[0]!;
  if (state.getTerrain(t.x, t.y) === Terrain.Forest) state.setTerrain(t.x, t.y, Terrain.Grass);
  state.setService(t.x, t.y, type, 1);
  state.money -= plan.cost;
  return null;
}

/** Costo de mejorar el servicio de una casilla, o null si no hay servicio o ya está al máximo. */
export function upgradeCost(state: CityState, x: number, y: number): number | null {
  const type = state.getService(x, y);
  if (type === ServiceType.None) return null;
  return SERVICES[type].upgradeCost[state.getServiceLevel(x, y) - 1] ?? null;
}

export function upgradeService(state: CityState, x: number, y: number): string | null {
  const cost = upgradeCost(state, x, y);
  if (cost === null) return TEXTS.services.maxLevel;
  const next = state.getServiceLevel(x, y) + 1;
  if (next > maxServiceLevel(state)) return lockedMessage(serviceLevelMilestone(next));
  if (cost > state.money) return TEXTS.errors.noMoney;
  state.setService(x, y, state.getService(x, y), state.getServiceLevel(x, y) + 1);
  state.money -= cost;
  return null;
}

/** "Se desbloquea con 500 habitantes (Pueblo)". */
export function lockedMessage(milestone: number): string {
  const key = MILESTONES[milestone]?.key ?? 'village';
  const pop = milestonePopulation(milestone).toLocaleString('es-AR');
  return `${TEXTS.milestones.lockedUntil} ${pop} ${TEXTS.zones.residents} (${TEXTS.milestones[key]})`;
}
