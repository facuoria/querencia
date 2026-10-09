import type { CityState } from '../core/cityState';
import { ServiceType, Zone } from '../core/types';
import { CONSUMPTION, SERVICE_LIST, SERVICE_RULES, SERVICES } from '../data/services';
import type { RoadNetwork } from './network';

export const UTILITIES = [ServiceType.Power, ServiceType.Water, ServiceType.Gas] as const;
export type Utility = (typeof UTILITIES)[number];

/** Radio en el que las plantas bajan el valor del suelo (ruido y humo). */
const UTILITY_NUISANCE_RADIUS = 4;

export interface UtilityStatus {
  capacity: number;
  /** Lo que piden los edificios dentro del radio de alguna planta. */
  consumption: number;
  /** Lo que efectivamente se entrega (no más que la capacidad). */
  served: number;
}

const CONSUMPTION_BY_ZONE: Record<number, readonly number[]> = {
  [Zone.Residential]: CONSUMPTION.residential,
  [Zone.Commercial]: CONSUMPTION.commercial,
  [Zone.Industrial]: CONSUMPTION.industrial,
};

export function consumptionOf(zone: number, level: number): number {
  return CONSUMPTION_BY_ZONE[zone]?.[level] ?? 0;
}

/**
 * Cobertura de cada servicio y reparto de luz, agua y gas.
 * Un servicio funciona solo si tiene una calle conectada a la autopista cerca.
 */
export class ServiceSim {
  /** 1 si la casilla está dentro del radio de un servicio de ese tipo que funciona. */
  readonly coverage: Record<number, Uint8Array> = {};
  /** 1 si el edificio de la casilla recibe ese suministro. */
  readonly supplied: Record<number, Uint8Array> = {};
  readonly utilities: Record<number, UtilityStatus> = {};
  /** Suma de servicios al valor del suelo, por casilla. */
  readonly landBonus: Float32Array;
  /** Distancia a la planta más cercana de cada tipo, para repartir primero a los de cerca. */
  private readonly plantDistance: Record<number, Float32Array> = {};

  constructor(
    private readonly state: CityState,
    private readonly network: RoadNetwork,
  ) {
    const n = state.size * state.size;
    for (const def of SERVICE_LIST) this.coverage[def.type] = new Uint8Array(n);
    for (const u of UTILITIES) {
      this.supplied[u] = new Uint8Array(n);
      this.plantDistance[u] = new Float32Array(n);
      this.utilities[u] = { capacity: 0, consumption: 0, served: 0 };
    }
    this.landBonus = new Float32Array(n);
  }

  /** Un servicio funciona si tiene acceso a una calle conectada. */
  isWorking(x: number, y: number): boolean {
    return this.network.hasAccess(x, y);
  }

  radiusOf(type: ServiceType, level: number): number {
    if (type === ServiceType.None) return 0;
    return SERVICES[type].radius[level - 1] ?? 0;
  }

  /** Lo que queda libre de un suministro. */
  spare(u: Utility): number {
    const s = this.utilities[u]!;
    return s.capacity - s.served;
  }

  /** Un lote vacío puede construir si tiene luz y agua cerca y queda capacidad para un edificio nuevo. */
  canBuild(i: number, zone: Zone): boolean {
    return SERVICE_RULES.requiredToBuild.every(
      (u) => this.coverage[u]![i] === 1 && this.spare(u as Utility) >= consumptionOf(zone, 1),
    );
  }

  /** Para el nivel 3 hace falta, además, gas con capacidad libre. */
  canReachLevel3(i: number, zone: Zone): boolean {
    return SERVICE_RULES.requiredForLevel3.every(
      (u) =>
        this.coverage[u]![i] === 1 &&
        this.spare(u as Utility) >= consumptionOf(zone, 3) - consumptionOf(zone, 2),
    );
  }

  /** El edificio recibe luz y agua. */
  hasBasicSupply(i: number): boolean {
    return SERVICE_RULES.requiredToBuild.every((u) => this.supplied[u]![i] === 1);
  }

  /** Anota el consumo de un edificio nuevo o mejorado, para no pasarse de la capacidad en el mismo día. */
  reserve(i: number, zone: Zone, fromLevel: number, toLevel: number): void {
    const extra = consumptionOf(zone, toLevel) - consumptionOf(zone, fromLevel);
    for (const u of UTILITIES) {
      if (this.coverage[u]![i] !== 1) continue;
      const status = this.utilities[u]!;
      status.consumption += extra;
      if (status.capacity - status.served >= extra) {
        status.served += extra;
        this.supplied[u]![i] = 1;
      }
    }
  }

  update(): void {
    const st = this.state;
    const n = st.size;
    for (const def of SERVICE_LIST) this.coverage[def.type]!.fill(0);
    for (const u of UTILITIES) {
      this.plantDistance[u]!.fill(Infinity);
      this.utilities[u] = { capacity: 0, consumption: 0, served: 0 };
    }
    this.landBonus.fill(0);

    for (let i = 0; i < st.service.length; i++) {
      const type = st.service[i] as ServiceType;
      if (type === ServiceType.None) continue;
      const x = i % n;
      const y = (i - x) / n;
      if (!this.isWorking(x, y)) continue;
      const def = SERVICES[type];
      const level = st.serviceLevel[i]!;
      const r = def.radius[level - 1] ?? 0;
      const cov = this.coverage[type]!;
      const dist = def.utility ? this.plantDistance[type] : undefined;
      if (def.utility) this.utilities[type]!.capacity += def.capacity?.[level - 1] ?? 0;
      const bonusRadius = def.utility ? UTILITY_NUISANCE_RADIUS : r;
      const reach = Math.max(r, bonusRadius);
      for (let ty = Math.max(0, y - reach); ty <= Math.min(n - 1, y + reach); ty++) {
        for (let tx = Math.max(0, x - reach); tx <= Math.min(n - 1, x + reach); tx++) {
          const d = Math.hypot(tx - x, ty - y);
          const j = ty * n + tx;
          if (d <= r) {
            cov[j] = 1;
            if (dist && d < dist[j]!) dist[j] = d;
          }
          if (d <= bonusRadius && def.landValueBonus !== 0) this.landBonus[j]! += def.landValueBonus;
        }
      }
    }
    for (let j = 0; j < this.landBonus.length; j++) {
      this.landBonus[j] = Math.min(SERVICE_RULES.maxLandValueBonus, this.landBonus[j]!);
    }
    for (const u of UTILITIES) this.distribute(u);
  }

  /** Reparte un suministro: primero a los edificios más cerca de una planta, hasta agotar la capacidad. */
  private distribute(u: Utility): void {
    const st = this.state;
    const sup = this.supplied[u]!;
    const dist = this.plantDistance[u]!;
    const cov = this.coverage[u]!;
    sup.fill(0);
    const wanting: number[] = [];
    let consumption = 0;
    for (let i = 0; i < st.buildingLevel.length; i++) {
      const level = st.buildingLevel[i]!;
      if (level === 0 || cov[i] !== 1) continue;
      wanting.push(i);
      consumption += consumptionOf(st.zones[i]!, level);
    }
    wanting.sort((a, b) => dist[a]! - dist[b]!);
    const status = this.utilities[u]!;
    let left = status.capacity;
    for (const i of wanting) {
      const need = consumptionOf(st.zones[i]!, st.buildingLevel[i]!);
      if (need > left) continue;
      left -= need;
      sup[i] = 1;
    }
    status.consumption = consumption;
    status.served = status.capacity - left;
  }
}
