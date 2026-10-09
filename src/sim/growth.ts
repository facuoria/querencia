import type { CityState, Demand } from '../core/cityState';
import { Terrain, Zone } from '../core/types';
import { DEMAND, ECONOMY, GROWTH, HAPPINESS, TIME } from '../data/config';
import { SERVICE_RULES } from '../data/services';
import { capacityOf } from './capacity';
import { closeMonth, servicesCut } from './economy';
import { HappinessSim } from './happiness';
import { computeLandValue } from './landValue';
import { RoadNetwork } from './network';
import { ServiceSim } from './services';

/** Cada cuántos días se recalcula el valor del suelo. */
const LAND_VALUE_EVERY_DAYS = 5;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Demanda entre -1 y 1 según cuánto falta (o sobra) para llegar al objetivo. */
function demandFor(target: number, current: number): number {
  return clamp((target - current) / Math.max(DEMAND.scaleMin, target * DEMAND.scaleRatio), -1, 1);
}

/**
 * Simulación de la ciudad: conexiones, servicios, ánimo, demanda, crecimiento,
 * abandono de edificios y cierre de mes. Corre una vez por día de juego.
 */
export class GrowthSim {
  readonly network: RoadNetwork;
  readonly services: ServiceSim;
  readonly happiness: HappinessSim;
  readonly landValue: Float32Array;
  private daysSinceLandValue = LAND_VALUE_EVERY_DAYS;

  constructor(
    private readonly state: CityState,
    private readonly random: () => number = Math.random,
  ) {
    this.network = new RoadNetwork(state);
    this.services = new ServiceSim(state, this.network);
    this.happiness = new HappinessSim(state, this.services);
    this.landValue = new Float32Array(state.size * state.size);
  }

  /** Recalcula conexiones y totales sin avanzar el tiempo (por ejemplo, después de construir). */
  refresh(): void {
    this.network.update();
    this.services.cuts = servicesCut(this.state);
    this.services.update();
    this.updateStats();
    this.happiness.update();
    computeLandValue(this.state, this.landValue, this.services.landBonus, this.state.happiness);
    this.updateStats();
  }

  dailyTick(): void {
    const st = this.state;
    if (st.day > 0 && st.day % TIME.daysPerMonth === 0) closeMonth(st);
    this.network.update();
    this.services.cuts = servicesCut(st);
    this.services.update();
    this.updateStats();
    this.happiness.update();
    if (++this.daysSinceLandValue >= LAND_VALUE_EVERY_DAYS) {
      this.daysSinceLandValue = 0;
      computeLandValue(st, this.landValue, this.services.landBonus, st.happiness);
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
    const workers = pop * DEMAND.workerRatio;
    const jobs = cJobs + iJobs + DEMAND.externalJobs;
    st.stats.unemployment = workers > 0 ? Math.max(0, workers - jobs) / workers : 0;
    st.stats.demand = this.computeDemand(pop, cJobs, iJobs);
  }

  private computeDemand(pop: number, cJobs: number, iJobs: number): Demand {
    const st = this.state;
    const jobs = cJobs + iJobs + DEMAND.externalJobs;
    // El ánimo de la ciudad atrae o espanta gente; los impuestos altos espantan comercios e industrias.
    const mood = ((st.stats.happiness - 50) / 50) * HAPPINESS.demandEffect;
    const business = (rate: number): number => (rate - ECONOMY.defaultTaxRate) * HAPPINESS.businessTaxDemand;
    return {
      residential: clamp(demandFor((jobs / DEMAND.workerRatio) * (1 + DEMAND.residentialSlack), pop) + mood, -1, 1),
      commercial: clamp(
        demandFor(pop * DEMAND.commercialPerResident + DEMAND.baseCommercial, cJobs) + business(st.taxRates.commercial),
        -1,
        1,
      ),
      industrial: clamp(
        demandFor(pop * DEMAND.industrialPerResident + DEMAND.baseIndustrial, iJobs) + business(st.taxRates.industrial),
        -1,
        1,
      ),
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
      const sv = this.services;
      // Nadie se muda a un lugar donde la gente está descontenta.
      if (zone === Zone.Residential && st.happiness[i]! < HAPPINESS.leaveBelow) continue;
      if (level === 0) {
        if (sv.canBuild(i, zone) && this.random() < GROWTH.buildChance * demand) {
          if (st.terrain[i] === Terrain.Forest) st.setTerrain(x, y, Terrain.Grass);
          st.setLevel(x, y, 1);
          sv.reserve(i, zone, 0, 1);
        }
      } else if (level < maxLevel && sv.hasBasicSupply(i)) {
        const needed = GROWTH.landValueForLevel[level + 1] ?? 1;
        const gasOk = level + 1 < 3 || sv.canReachLevel3(i, zone);
        if (gasOk && this.landValue[i]! >= needed && this.random() < GROWTH.upgradeChance * demand) {
          st.setLevel(x, y, level + 1);
          sv.reserve(i, zone, level, level + 1);
        }
      }
    }
  }

  /** Los edificios sin acceso, sin luz o agua, con demanda muy baja o con gente descontenta bajan de nivel de a poco. */
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
      else if (!this.services.hasBasicSupply(i)) chance = SERVICE_RULES.decayWithoutSupply;
      else if ((demandOf[st.zones[i]!] ?? 0) < GROWTH.decayDemand) chance = GROWTH.decayChance;
      if (st.zones[i] === Zone.Residential && st.happiness[i]! < HAPPINESS.leaveBelow) {
        const unhappy = (HAPPINESS.leaveBelow - st.happiness[i]!) / HAPPINESS.leaveBelow;
        chance = Math.max(chance, unhappy * HAPPINESS.leaveChance);
      }
      if (chance > 0 && this.random() < chance) st.setLevel(x, y, level - 1);
    }
  }
}
