import type { CityState } from '../core/cityState';
import { SECTORS } from '../data/config';
import { TEXTS } from '../data/texts';

/** Precio del próximo sector: cada compra encarece la siguiente. */
export function sectorCost(state: CityState): number {
  return Math.round(SECTORS.baseCost * SECTORS.costGrowth ** state.sectorsBought);
}

/** Un sector se puede comprar si está bloqueado y toca (por un lado) un sector propio. */
export function canBuySector(state: CityState, sx: number, sy: number): boolean {
  const n = state.sectorsPerSide;
  if (sx < 0 || sy < 0 || sx >= n || sy >= n || state.isSectorUnlocked(sx, sy)) return false;
  const own = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < n && y < n && state.isSectorUnlocked(x, y);
  return own(sx - 1, sy) || own(sx + 1, sy) || own(sx, sy - 1) || own(sx, sy + 1);
}

/** Motivo por el que no se puede comprar, o null si se puede. */
export function sectorError(state: CityState, sx: number, sy: number): string | null {
  if (state.isSectorUnlocked(sx, sy)) return TEXTS.sectors.owned;
  if (!canBuySector(state, sx, sy)) return TEXTS.sectors.notAdjacent;
  if (sectorCost(state) > state.money) return TEXTS.errors.noMoney;
  return null;
}

export function buySector(state: CityState, sx: number, sy: number): string | null {
  const error = sectorError(state, sx, sy);
  if (error) return error;
  state.money -= sectorCost(state);
  state.sectorsBought++;
  state.unlockSector(sx, sy);
  return null;
}
