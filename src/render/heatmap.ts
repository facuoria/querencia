import { Graphics } from 'pixi.js';
import type { CityState } from '../core/cityState';
import { ServiceType, Zone } from '../core/types';
import type { GrowthSim } from '../sim/growth';
import { UTILITIES } from '../sim/services';
import { tileDiamond } from './iso';

/** Qué muestra el mapa de calor: un servicio, el valor del suelo o nada. */
export type HeatmapMode = ServiceType | 'landValue' | 'happiness' | null;

const COVERED = 0x3fcf5a;
const UNSUPPLIED = 0xffa23a;
const MISSING = 0xe5483b;

/** Colorea las casillas desbloqueadas según la cobertura de un servicio, el valor del suelo o el ánimo. */
export class Heatmap {
  readonly graphics = new Graphics();
  mode: HeatmapMode = null;

  constructor(
    private readonly state: CityState,
    private readonly growth: GrowthSim,
  ) {}

  setMode(mode: HeatmapMode): void {
    this.mode = mode;
    this.redraw();
  }

  redraw(): void {
    const g = this.graphics;
    g.clear();
    const mode = this.mode;
    if (mode === null || mode === ServiceType.None) return;
    const st = this.state;
    const n = st.size;
    const sv = this.growth.services;
    const isUtility = (UTILITIES as readonly number[]).includes(mode as number);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (!st.isTileUnlocked(x, y)) continue;
        const i = y * n + x;
        let color: number;
        if (mode === 'landValue') {
          color = mix(MISSING, COVERED, this.growth.landValue[i]!);
        } else if (mode === 'happiness') {
          if (st.zones[i] !== Zone.Residential) continue;
          color = mix(MISSING, COVERED, st.happiness[i]! / 100);
        } else if (sv.coverage[mode]![i] !== 1) {
          color = MISSING;
        } else if (isUtility && st.buildingLevel[i]! > 0 && sv.supplied[mode]![i] !== 1) {
          color = UNSUPPLIED;
        } else {
          color = COVERED;
        }
        g.poly(tileDiamond(x, y)).fill({ color, alpha: 0.38 });
      }
    }
  }
}

function mix(a: number, b: number, t: number): number {
  const ch = (c: number, shift: number): number => (c >> shift) & 0xff;
  const lerp = (shift: number): number => Math.round(ch(a, shift) + (ch(b, shift) - ch(a, shift)) * t);
  return (lerp(16) << 16) | (lerp(8) << 8) | lerp(0);
}
