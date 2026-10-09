import { MAP, TERRAIN_GEN } from '../data/config';
import { CityState } from './cityState';
import { fbm } from './noise';
import { Road, Terrain } from './types';

/** Centro, en casillas, del bloque de sectores iniciales. */
export function startCenter(state: CityState): { x: number; y: number } {
  const s = state.sectorSize;
  const xs = MAP.initialSectors.map(([sx]) => sx);
  const ys = MAP.initialSectors.map(([, sy]) => sy);
  return {
    x: ((Math.min(...xs) + Math.max(...xs) + 1) * s) / 2,
    y: ((Math.min(...ys) + Math.max(...ys) + 1) * s) / 2,
  };
}

export function generateMap(state: CityState, seed: number = MAP.seed): void {
  const g = TERRAIN_GEN;
  const start = startCenter(state);
  for (let y = 0; y < state.size; y++) {
    for (let x = 0; x < state.size; x++) {
      const nearHighway = Math.abs(x - MAP.highwayX) <= g.highwayClearance;
      const dist = Math.hypot(x - start.x, y - start.y);
      const landBias = Math.max(0, 1 - dist / g.startLandRadius) * g.startLandBias;
      const water = fbm(x / g.waterScale, y / g.waterScale, seed) + landBias;
      if (water < g.waterThreshold && !nearHighway) {
        state.setTerrain(x, y, Terrain.Water);
        continue;
      }
      const forest = fbm(x / g.forestScale, y / g.forestScale, seed + 7777, 3);
      const isForest = forest > g.forestThreshold && Math.abs(x - MAP.highwayX) > 0;
      state.setTerrain(x, y, isForest ? Terrain.Forest : Terrain.Grass);
    }
  }
  // La autopista cruza el mapa de borde a borde: es la conexión con el exterior.
  for (let y = 0; y < state.size; y++) state.setRoad(MAP.highwayX, y, Road.Highway);
  for (const [sx, sy] of MAP.initialSectors) state.unlockSector(sx, sy);
  state.takeChanges();
}
