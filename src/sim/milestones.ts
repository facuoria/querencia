import type { CityState } from '../core/cityState';
import { ServiceType, Zone } from '../core/types';
import { MILESTONES } from '../data/config';

/** Hito (índice en MILESTONES) desde el que se puede usar cada zona. */
const ZONE_MILESTONE: Record<number, number> = {
  [Zone.Residential]: 0,
  [Zone.Commercial]: 0,
  [Zone.Industrial]: 1,
};

/** Hito desde el que se puede construir cada servicio. */
const SERVICE_MILESTONE: Record<number, number> = {
  [ServiceType.Power]: 0,
  [ServiceType.Water]: 0,
  [ServiceType.Gas]: 1,
  [ServiceType.Fire]: 1,
  [ServiceType.Police]: 1,
  [ServiceType.School]: 2,
  [ServiceType.Park]: 2,
  [ServiceType.Hospital]: 2,
  [ServiceType.University]: 3,
};

/** Hito desde el que los edificios pueden llegar a nivel 3. */
const BUILDING_LEVEL3_MILESTONE = 3;
/** Hito desde el que los servicios se pueden mejorar a nivel 3. */
const SERVICE_LEVEL3_MILESTONE = 4;

/** Hito alcanzado según la población máxima que tuvo la ciudad (los desbloqueos no se pierden). */
export function currentMilestone(state: CityState): number {
  let m = 0;
  MILESTONES.forEach((ms, i) => {
    if (state.maxPopulation >= ms.population) m = i;
  });
  return m;
}

export function zoneMilestone(zone: Zone): number {
  return ZONE_MILESTONE[zone] ?? 0;
}

export function serviceMilestone(type: ServiceType): number {
  return SERVICE_MILESTONE[type] ?? 0;
}

export function isZoneUnlocked(state: CityState, zone: Zone): boolean {
  return currentMilestone(state) >= zoneMilestone(zone);
}

export function isServiceUnlocked(state: CityState, type: ServiceType): boolean {
  return currentMilestone(state) >= serviceMilestone(type);
}

export function maxBuildingLevel(state: CityState): number {
  return currentMilestone(state) >= BUILDING_LEVEL3_MILESTONE ? 3 : 2;
}

export function maxServiceLevel(state: CityState): number {
  return currentMilestone(state) >= SERVICE_LEVEL3_MILESTONE ? 3 : 2;
}

/** Población que hace falta para un hito. */
export function milestonePopulation(index: number): number {
  return MILESTONES[index]?.population ?? 0;
}

/** Hito necesario para mejorar un servicio a un nivel. */
export function serviceLevelMilestone(level: number): number {
  return level >= 3 ? SERVICE_LEVEL3_MILESTONE : 0;
}

export interface Unlocks {
  zones: Zone[];
  services: ServiceType[];
  buildingLevel3: boolean;
  serviceLevel3: boolean;
}

/** Lo que desbloquea un hito. */
export function unlocksOf(milestone: number): Unlocks {
  const zones = Object.entries(ZONE_MILESTONE)
    .filter(([, m]) => m === milestone)
    .map(([z]) => Number(z) as Zone);
  const services = Object.entries(SERVICE_MILESTONE)
    .filter(([, m]) => m === milestone)
    .map(([t]) => Number(t) as ServiceType);
  return {
    zones,
    services,
    buildingLevel3: milestone === BUILDING_LEVEL3_MILESTONE,
    serviceLevel3: milestone === SERVICE_LEVEL3_MILESTONE,
  };
}
