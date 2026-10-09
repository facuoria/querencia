import { MAP, TERRAIN_GEN } from '../data/config';
import { CityState } from './cityState';
import { fbm } from './noise';
import { Terrain } from './types';

export function generateMap(state: CityState, seed = MAP.seed): void {
  const center = state.size / 2;
  const g = TERRAIN_GEN;
  for (let y = 0; y < state.size; y++) {
    for (let x = 0; x < state.size; x++) {
      const dist = Math.hypot(x - center, y - center);
      const landBias = Math.max(0, 1 - dist / g.centerLandRadius) * g.centerLandBias;
      const water = fbm(x / g.waterScale, y / g.waterScale, seed) + landBias;
      if (water < g.waterThreshold) {
        state.setTerrain(x, y, Terrain.Water);
        continue;
      }
      const forest = fbm(x / g.forestScale, y / g.forestScale, seed + 7777, 3);
      state.setTerrain(x, y, forest > g.forestThreshold ? Terrain.Forest : Terrain.Grass);
    }
  }
  for (const [sx, sy] of MAP.initialSectors) state.unlockSector(sx, sy);
}
