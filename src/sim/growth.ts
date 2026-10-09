import type { CityState, Demand } from '../core/cityState';
import { Terrain, Zone } from '../core/types';
import { CAPACITY, DEMAND, GROWTH } from '../data/config';
import { computeLandValue } from './landValue';
import { RoadNetwork } from './network';

/** Cada cuántos días se recalcula el valor del suelo. */
const LAND_VALUE_EVERY_DAYS = 5;

const CAPACITY_BY_ZONE: Record<number, readonly number[]> = {
  [Zone.Residential]: CAPACITY.residential,
  [Zone.Commercial]: CAPACITY.commercial,
  [Zone.Industrial]: CAPACITY.industrial,
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Demanda entre -1 y 1 según cuánto falta (o sobra) para llegar al objetivo. */
function demandFor(target: number, current: number): number {
  return clamp((target - current) / Math.max(DEMAND.scaleMin, target * DEMAND.scaleRatio), -1, 1);
}

/** Capacidad (habitantes o empleos) del edificio de una casilla. */
export function capacityOf(zone: number, level: number): number {
  return CAPACITY_BY_ZONE[zone]?.[level] ?? 0;
}

/**
 * Simulación de zonas: demanda, crecimiento y abandono de edificios.
 * Corre una vez por día de juego.
 */
export class GrowthSim {
  readonly network: RoadNetwork;
  readonly landValue: Float32Array;
  private daysSinceLandValue = LAND_VALUE_EVERY_DAYS;

  constructor(
    private readonly state: CityState,
    private readonly random: () => number = Math.random,
  ) {
    this.network = new RoadNetwork(state);
    this.landValue = new Float32Array(state.size * state.size);
  }

  /** Recalcula conexiones y totales sin avanzar el tiempo (por ejemplo, después de construir). */
  refresh(): void {
    this.network.update();
    this.updateStats();
  }

  dailyTick(): void {
    this.network.update();
    if (++this.daysSinceLandValue >= LAND_VALUE_EVERY_DAYS) {
      this.daysSinceLandValue = 0;
      computeLandValue(this.state, this.landValue);
    }
    this.updateStats();
    this.decay();
    const d = this.state.stats.demand;
    this.grow(Zone.Residential, d.residential);
    this.grow(Zone.Commercial, d.commercial);
    this.grow(Zone.Industrial, d.industrial);
    this.updateStats();
  }

  /** Población, empleos, población por barrio y demanda. */
  updateStats(): void {
    const st = this.state;
    const n = st.size;
    const spp = st.sectorsPerSide;
    st.sectorPopulation.fill(0);
    let pop = 0;
    let cJobs = 0;
    let iJobs = 0;
    for (let i = 0; i < n * n; i++) {
      const level = st.buildingLevel[i]!;
      if (level === 0) continue;
      const zone = st.zones[i]!;
      const cap = capacityOf(zone, level);
      if (zone === Zone.Residential) {
        pop += cap;
        const x = i % n;
        const y = (i - x) / n;
        st.sectorPopulation[Math.floor(y / st.sectorSize) * spp + Math.floor(x / st.sectorSize)]! += cap;
      } else if (zone === Zone.Commercial) cJobs += cap;
      else if (zone === Zone.Industrial) iJobs += cap;
    }
    st.stats.population = pop;
    st.stats.commercialJobs = cJobs;
    st.stats.industrialJobs = iJobs;
    st.stats.demand = this.computeDemand(pop, cJobs, iJobs);
  }

  private computeDemand(pop: number, cJobs: number, iJobs: number): Demand {
    const jobs = cJobs + iJobs + DEMAND.externalJobs;
    return {
      residential: demandFor((jobs / DEMAND.workerRatio) * (1 + DEMAND.residentialSlack), pop),
      commercial: demandFor(pop * DEMAND.commercialPerResident + DEMAND.baseCommercial, cJobs),
      industrial: demandFor(pop * DEMAND.industrialPerResident + DEMAND.baseIndustrial, iJobs),
    };
  }

  private maxLevel(): number {
    return this.state.stats.population >= GROWTH.level3MinPopulation ? 3 : 2;
  }

  /** Intentos de construir o mejorar edificios de un tipo de zona. */
  private grow(zone: Zone, demand: number): void {
    if (demand <= 0) return;
    const st = this.state;
    const candidates: number[] = [];
    for (let i = 0; i < st.zones.length; i++) {
      if (st.zones[i] !== zone) continue;
      const x = i % st.size;
      const y = (i - x) / st.size;
      if (this.network.hasAccess(x, y)) candidates.push(i);
    }
    if (candidates.length === 0) return;

    const attempts = Math.ceil(GROWTH.attemptsPerDay * demand * GROWTH.speed);
    const maxLevel = this.maxLevel();
    for (let a = 0; a < attempts; a++) {
      const i = candidates[Math.floor(this.random() * candidates.length)]!;
      const x = i % st.size;
      const y = (i - x) / st.size;
      const level = st.buildingLevel[i]!;
      if (level === 0) {
        if (this.random() < GROWTH.buildChance * demand) {
          if (st.terrain[i] === Terrain.Forest) st.setTerrain(x, y, Terrain.Grass);
          st.setLevel(x, y, 1);
        }
      } else if (level < maxLevel) {
        const needed = GROWTH.landValueForLevel[level + 1] ?? 1;
        if (this.landValue[i]! >= needed && this.random() < GROWTH.upgradeChance * demand) {
          st.setLevel(x, y, level + 1);
        }
      }
    }
  }

  /** Los edificios sin acceso o con demanda muy baja bajan de nivel de a poco. */
  private decay(): void {
    const st = this.state;
    const d = st.stats.demand;
    const demandOf: Record<number, number> = {
      [Zone.Residential]: d.residential,
      [Zone.Commercial]: d.commercial,
      [Zone.Industrial]: d.industrial,
    };
    for (let i = 0; i < st.buildingLevel.length; i++) {
      const level = st.buildingLevel[i]!;
      if (level === 0) continue;
      const x = i % st.size;
      const y = (i - x) / st.size;
      let chance = 0;
      if (!this.network.hasAccess(x, y)) chance = GROWTH.decayWithoutAccess;
      else if ((demandOf[st.zones[i]!] ?? 0) < GROWTH.decayDemand) chance = GROWTH.decayChance;
      if (chance > 0 && this.random() < chance) st.setLevel(x, y, level - 1);
    }
  }
}
