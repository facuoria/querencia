import type { CityState } from '../core/cityState';
import { ServiceType, Zone } from '../core/types';
import { FIRE } from '../data/config';
import type { ServiceSim } from './services';

/**
 * Incendios: aparecen al azar (más seguido donde no llegan los bomberos y en la industria),
 * se propagan a los edificios vecinos y, si nadie los apaga, destruyen el edificio.
 */
export class FireSim {
  constructor(
    private readonly state: CityState,
    private readonly services: ServiceSim,
    private readonly random: () => number,
  ) {}

  /** Cantidad de edificios que están ardiendo. */
  count(): number {
    let n = 0;
    for (const f of this.state.fire) if (f > 0) n++;
    return n;
  }

  /** Avanza un día. Devuelve cuántos incendios nuevos empezaron (sin contar propagación). */
  dailyTick(): number {
    const st = this.state;
    const n = st.size;
    const covered = this.services.coverage[ServiceType.Fire]!;
    const burning: number[] = [];
    for (let i = 0; i < st.fire.length; i++) if (st.fire[i]! > 0) burning.push(i);

    for (const i of burning) {
      const x = i % n;
      const y = (i - x) / n;
      if (covered[i] === 1 && this.random() < FIRE.extinguishChance) {
        st.setFire(x, y, 0);
        continue;
      }
      const days = st.fire[i]! + 1;
      if (days > FIRE.burnDays) {
        st.setLevel(x, y, 0);
        continue;
      }
      st.setFire(x, y, days);
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ] as const) {
        if (!st.inBounds(nx, ny)) continue;
        const j = ny * n + nx;
        if (st.buildingLevel[j] === 0 || st.fire[j]! > 0) continue;
        const chance = FIRE.spreadChance * (covered[j] === 1 ? FIRE.spreadWithStationFactor : 1);
        if (this.random() < chance) st.setFire(nx, ny, 1);
      }
    }

    let started = 0;
    for (let i = 0; i < st.buildingLevel.length; i++) {
      if (st.buildingLevel[i] === 0 || st.fire[i]! > 0) continue;
      let chance = FIRE.igniteChance;
      if (covered[i] !== 1) chance *= FIRE.withoutStationFactor;
      if (st.zones[i] === Zone.Industrial) chance *= FIRE.industrialFactor;
      if (this.random() < chance) {
        const x = i % n;
        st.setFire(x, (i - x) / n, 1);
        started++;
      }
    }
    return started;
  }
}
