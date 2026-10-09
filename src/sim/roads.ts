import type { CityState } from '../core/cityState';
import { Road } from '../core/types';

export const DIR_BITS = {
  west: 1, // x - 1
  north: 2, // y - 1
  east: 4, // x + 1
  south: 8, // y + 1
} as const;

/**
 * Con qué vecinos se conecta una calle (ver DIR_BITS).
 * La autopista se considera conectada hacia afuera del mapa.
 */
export function roadMask(state: CityState, x: number, y: number): number {
  const self = state.getRoad(x, y);
  if (self === Road.None) return 0;
  const connects = (nx: number, ny: number): boolean => {
    if (!state.inBounds(nx, ny)) return self === Road.Highway;
    return state.getRoad(nx, ny) !== Road.None;
  };
  return (
    (connects(x - 1, y) ? DIR_BITS.west : 0) |
    (connects(x, y - 1) ? DIR_BITS.north : 0) |
    (connects(x + 1, y) ? DIR_BITS.east : 0) |
    (connects(x, y + 1) ? DIR_BITS.south : 0)
  );
}
