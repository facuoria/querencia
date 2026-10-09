import type { CityState } from '../core/cityState';
import { Terrain, Zone } from '../core/types';
import { HAPPINESS, LAND_VALUE } from '../data/config';

/** Suma de una grilla en un cuadrado de radio r, con tabla de sumas acumuladas. */
export class BoxSum {
  private readonly sums: Float64Array;

  constructor(private readonly n: number, values: (i: number) => number) {
    const w = n + 1;
    this.sums = new Float64Array(w * w);
    for (let y = 0; y < n; y++) {
      let row = 0;
      for (let x = 0; x < n; x++) {
        row += values(y * n + x);
        this.sums[(y + 1) * w + (x + 1)] = this.sums[y * w + (x + 1)]! + row;
      }
    }
  }

  /** Promedio en el cuadrado de radio r alrededor de (x, y), recortado al mapa. */
  average(x: number, y: number, r: number): number {
    const w = this.n + 1;
    const x0 = Math.max(0, x - r);
    const y0 = Math.max(0, y - r);
    const x1 = Math.min(this.n, x + r + 1);
    const y1 = Math.min(this.n, y + r + 1);
    const s = this.sums;
    const total = s[y1 * w + x1]! - s[y0 * w + x1]! - s[y1 * w + x0]! + s[y0 * w + x0]!;
    return total / ((x1 - x0) * (y1 - y0));
  }
}

/**
 * Valor del suelo de 0 a 1 por casilla. Sube cerca del agua, el bosque, los servicios y los buenos barrios;
 * baja cerca de la industria y las plantas.
 */
export function computeLandValue(
  state: CityState,
  out: Float32Array,
  serviceBonus?: Float32Array,
  happiness?: Float32Array,
): void {
  const n = state.size;
  const lv = LAND_VALUE;
  const water = new BoxSum(n, (i) => (state.terrain[i] === Terrain.Water ? 1 : 0));
  const forest = new BoxSum(n, (i) => (state.terrain[i] === Terrain.Forest ? 1 : 0));
  const industry = new BoxSum(n, (i) => (state.zones[i] === Zone.Industrial && state.buildingLevel[i]! > 0 ? 1 : 0));
  const levels = new BoxSum(n, (i) =>
    state.zones[i] !== Zone.Industrial ? state.buildingLevel[i]! / 3 : 0,
  );

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      let v = lv.base;
      v += Math.min(1, water.average(x, y, lv.waterRadius) * 4) * lv.waterBonus;
      v += Math.min(1, forest.average(x, y, lv.forestRadius) * 3) * lv.forestBonus;
      v += Math.min(1, levels.average(x, y, lv.neighborhoodRadius) * 2) * lv.neighborhoodBonus;
      v += serviceBonus?.[i] ?? 0;
      if (happiness && state.zones[i] === Zone.Residential) {
        v += ((happiness[i]! - 50) / 50) * HAPPINESS.landValueEffect;
      }
      if (state.zones[i] !== Zone.Industrial) {
        v -= Math.min(1, industry.average(x, y, lv.industryRadius) * 4) * lv.industryPenalty;
      }
      out[i] = Math.max(0, Math.min(1, v));
    }
  }
}
