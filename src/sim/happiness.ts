import type { CityState } from '../core/cityState';
import { Road, ServiceType, Terrain, Zone } from '../core/types';
import { ECONOMY, FIRE, HAPPINESS } from '../data/config';
import { capacityOf } from './capacity';
import { BoxSum } from './landValue';
import type { ServiceSim } from './services';

/** Desglose del ánimo de una casilla, para mostrarlo en la interfaz. */
export interface HappinessParts {
  services: number;
  economy: number;
  environment: number;
  safety: number;
  total: number;
}

/**
 * Ánimo de la gente (0 a 100) en cada casilla residencial, por barrio y en toda la ciudad.
 * Suma y resta según servicios, impuestos y empleo, entorno y seguridad.
 */
export class HappinessSim {
  private industry: BoxSum | null = null;
  private nature: BoxSum | null = null;
  private fires: BoxSum | null = null;

  constructor(
    private readonly state: CityState,
    private readonly services: ServiceSim,
  ) {}

  update(): void {
    const st = this.state;
    const n = st.size;
    this.industry = new BoxSum(n, (i) => (st.zones[i] === Zone.Industrial && st.buildingLevel[i]! > 0 ? 1 : 0));
    this.nature = new BoxSum(n, (i) => (st.terrain[i] === Terrain.Water || st.terrain[i] === Terrain.Forest ? 1 : 0));
    this.fires = new BoxSum(n, (i) => (st.fire[i]! > 0 ? 1 : 0));

    const spp = st.sectorsPerSide;
    const sum = new Float64Array(spp * spp);
    const weight = new Float64Array(spp * spp);
    let citySum = 0;
    let cityWeight = 0;
    for (let i = 0; i < n * n; i++) {
      if (st.zones[i] !== Zone.Residential) continue;
      const x = i % n;
      const y = (i - x) / n;
      const h = this.partsAt(x, y).total;
      st.happiness[i] = h;
      const residents = capacityOf(Zone.Residential, st.buildingLevel[i]!);
      if (residents === 0) continue;
      const s = Math.floor(y / st.sectorSize) * spp + Math.floor(x / st.sectorSize);
      sum[s]! += h * residents;
      weight[s]! += residents;
      citySum += h * residents;
      cityWeight += residents;
    }
    for (let s = 0; s < spp * spp; s++) st.sectorHappiness[s] = weight[s]! > 0 ? sum[s]! / weight[s]! : 50;
    st.stats.happiness = cityWeight > 0 ? citySum / cityWeight : HAPPINESS.base;
  }

  /** Factores del ánimo en una casilla. Requiere haber llamado a update() en el día. */
  partsAt(x: number, y: number): HappinessParts {
    const st = this.state;
    const H = HAPPINESS;
    const i = st.index(x, y);
    const sv = this.services;
    const covered = (t: ServiceType): boolean => sv.coverage[t]![i] === 1;
    const built = st.buildingLevel[i]! > 0;

    // Servicios: sin luz o sin agua resta (solo si ya hay edificio); salud y educación suman.
    let services = 0;
    if (built && sv.supplied[ServiceType.Power]![i] !== 1) services += H.noPower;
    if (built && sv.supplied[ServiceType.Water]![i] !== 1) services += H.noWater;
    if (covered(ServiceType.Hospital)) services += H.hospital;
    if (covered(ServiceType.School)) services += H.school;
    if (covered(ServiceType.University)) services += H.university;

    // Impuestos y empleo.
    const economy =
      (st.taxRates.residential - ECONOMY.defaultTaxRate) * H.perTaxPoint + st.stats.unemployment * H.unemployment;

    // Entorno: parques y naturaleza suman; industria y autopista restan.
    let environment = 0;
    if (covered(ServiceType.Park)) environment += H.park;
    if ((this.nature?.average(x, y, 2) ?? 0) > 0) environment += H.waterOrForest;
    environment += Math.min(1, (this.industry?.average(x, y, H.industryRadius) ?? 0) * 6) * H.industryNearby;
    if (this.nearHighway(x, y)) environment += H.highwayNoise;

    // Seguridad: policía y bomberos suman; en barrios grandes sin policía hay delincuencia.
    let safety = 0;
    if (covered(ServiceType.Police)) safety += H.police;
    else {
      const sector = st.sectorOf(x, y);
      if (st.sectorPopulation[sector.y * st.sectorsPerSide + sector.x]! > H.crimePopulation) safety += H.crime;
    }
    if (covered(ServiceType.Fire)) safety += H.fire;
    if ((this.fires?.average(x, y, FIRE.happinessRadius) ?? 0) > 0) safety += FIRE.happinessPenalty;

    const total = Math.max(0, Math.min(100, H.base + services + economy + environment + safety));
    return { services, economy, environment, safety, total };
  }

  private nearHighway(x: number, y: number): boolean {
    const st = this.state;
    const d = HAPPINESS.highwayNoiseDistance;
    for (let dy = -d; dy <= d; dy++) {
      for (let dx = -d; dx <= d; dx++) {
        if (st.inBounds(x + dx, y + dy) && st.getRoad(x + dx, y + dy) === Road.Highway) return true;
      }
    }
    return false;
  }
}
