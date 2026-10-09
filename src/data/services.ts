// Edificios de servicio: costos, radios y capacidades. Todos los números son propuestas para ajustar jugando.

import { ServiceType } from '../core/types';
import { TEXTS } from './texts';

export interface ServiceDef {
  type: Exclude<ServiceType, 0>;
  /** Nombre visible. */
  name: string;
  /** Emoji que se muestra sobre el edificio y en los botones. */
  icon: string;
  cost: number;
  /** Costo de pasar a nivel 2 y a nivel 3. */
  upgradeCost: readonly [number, number];
  /** Radio de cobertura en casillas, por nivel (índice 0 = nivel 1). */
  radius: readonly [number, number, number];
  /** Solo plantas: unidades de suministro por nivel. */
  capacity?: readonly [number, number, number];
  /** Cuánto suma al valor del suelo dentro de su radio. */
  landValueBonus: number;
  /** Plantas de luz, agua o gas. */
  utility: boolean;
  /** Mantenimiento mensual en nivel 1. */
  upkeep: number;
}

export const SERVICES: Record<Exclude<ServiceType, 0>, ServiceDef> = {
  [ServiceType.Power]: {
    type: ServiceType.Power,
    name: TEXTS.services.power,
    upkeep: 120,
    icon: '⚡',
    cost: 3000,
    upgradeCost: [2000, 4000],
    radius: [14, 18, 22],
    capacity: [400, 800, 1400],
    landValueBonus: -0.05,
    utility: true,
  },
  [ServiceType.Water]: {
    type: ServiceType.Water,
    name: TEXTS.services.water,
    upkeep: 60,
    icon: '💧',
    cost: 1500,
    upgradeCost: [1200, 2500],
    radius: [10, 13, 16],
    capacity: [300, 600, 1000],
    landValueBonus: 0,
    utility: true,
  },
  [ServiceType.Gas]: {
    type: ServiceType.Gas,
    name: TEXTS.services.gas,
    upkeep: 150,
    icon: '🔥',
    cost: 4000,
    upgradeCost: [2500, 5000],
    radius: [12, 16, 20],
    capacity: [300, 600, 1000],
    landValueBonus: -0.05,
    utility: true,
  },
  [ServiceType.Hospital]: {
    type: ServiceType.Hospital,
    name: TEXTS.services.hospital,
    upkeep: 250,
    icon: '🏥',
    cost: 5000,
    upgradeCost: [3500, 7000],
    radius: [10, 13, 16],
    landValueBonus: 0.1,
    utility: false,
  },
  [ServiceType.School]: {
    type: ServiceType.School,
    name: TEXTS.services.school,
    upkeep: 150,
    icon: '🏫',
    cost: 3000,
    upgradeCost: [2000, 4000],
    radius: [8, 10, 12],
    landValueBonus: 0.1,
    utility: false,
  },
  [ServiceType.University]: {
    type: ServiceType.University,
    name: TEXTS.services.university,
    upkeep: 400,
    icon: '🎓',
    cost: 8000,
    upgradeCost: [5000, 10000],
    radius: [16, 20, 24],
    landValueBonus: 0.1,
    utility: false,
  },
  [ServiceType.Park]: {
    type: ServiceType.Park,
    name: TEXTS.services.park,
    upkeep: 15,
    icon: '🌳',
    cost: 400,
    upgradeCost: [300, 600],
    radius: [4, 5, 6],
    landValueBonus: 0.2,
    utility: false,
  },
  [ServiceType.Fire]: {
    type: ServiceType.Fire,
    name: TEXTS.services.fire,
    upkeep: 150,
    icon: '🚒',
    cost: 3500,
    upgradeCost: [2500, 5000],
    radius: [10, 13, 16],
    landValueBonus: 0.05,
    utility: false,
  },
  [ServiceType.Police]: {
    type: ServiceType.Police,
    name: TEXTS.services.police,
    upkeep: 150,
    icon: '🚓',
    cost: 3500,
    upgradeCost: [2500, 5000],
    radius: [10, 13, 16],
    landValueBonus: 0.1,
    utility: false,
  },
};

export const SERVICE_LIST = Object.values(SERVICES);

/** Unidades de luz, agua y gas que consume cada edificio, por nivel (índice = nivel). */
export const CONSUMPTION = {
  residential: [0, 1, 3, 9],
  commercial: [0, 2, 5, 14],
  industrial: [0, 4, 8, 16],
} as const;

export const SERVICE_RULES = {
  /** Para construir un edificio nuevo hace falta luz y agua. */
  requiredToBuild: [ServiceType.Power, ServiceType.Water],
  /** Para llegar a nivel 3 hace falta, además, gas. */
  requiredForLevel3: [ServiceType.Gas],
  /** Probabilidad diaria de que un edificio sin luz o sin agua baje un nivel. */
  decayWithoutSupply: 0.01,
  /** Tope del bonus total de servicios al valor del suelo. */
  maxLandValueBonus: 0.45,
} as const;

/** Costo total invertido en un servicio hasta su nivel actual (construcción + mejoras). */
export function investedIn(def: ServiceDef, level: number): number {
  let total = def.cost;
  for (let l = 1; l < level; l++) total += def.upgradeCost[l - 1] ?? 0;
  return total;
}
