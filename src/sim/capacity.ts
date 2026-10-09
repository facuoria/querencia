import { Zone } from '../core/types';
import { CAPACITY } from '../data/config';

const CAPACITY_BY_ZONE: Record<number, readonly number[]> = {
  [Zone.Residential]: CAPACITY.residential,
  [Zone.Commercial]: CAPACITY.commercial,
  [Zone.Industrial]: CAPACITY.industrial,
};

/** Capacidad (habitantes o empleos) del edificio de una casilla. */
export function capacityOf(zone: number, level: number): number {
  return CAPACITY_BY_ZONE[zone]?.[level] ?? 0;
}
