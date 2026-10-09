import type { CityState, MonthReport } from '../core/cityState';
import { Road, ServiceType, Zone } from '../core/types';
import { ECONOMY } from '../data/config';
import { SERVICES } from '../data/services';
import { capacityOf } from './capacity';

/** Calcula ingresos y gastos de un mes con el estado actual de la ciudad (sin cobrar nada). */
export function projectMonth(state: CityState): MonthReport {
  const income = { residential: 0, commercial: 0, industrial: 0 };
  let roads = 0;
  let serviceUpkeep = 0;
  for (let i = 0; i < state.zones.length; i++) {
    if (state.roads[i] === Road.Street) roads++;
    const service = state.service[i] as ServiceType;
    if (service !== ServiceType.None) {
      const factor = ECONOMY.upkeepByLevel[state.serviceLevel[i]! - 1] ?? 1;
      serviceUpkeep += SERVICES[service].upkeep * factor;
    }
    const level = state.buildingLevel[i]!;
    if (level === 0) continue;
    const zone = state.zones[i]!;
    const units = capacityOf(zone, level);
    if (zone === Zone.Residential) income.residential += units;
    else if (zone === Zone.Commercial) income.commercial += units;
    else if (zone === Zone.Industrial) income.industrial += units;
  }
  const t = state.taxRates;
  const b = ECONOMY.taxBase;
  income.residential *= (b.residential * t.residential) / 100;
  income.commercial *= (b.commercial * t.commercial) / 100;
  income.industrial *= (b.industrial * t.industrial) / 100;
  const roadUpkeep = roads * ECONOMY.roadUpkeep;
  const balance = income.residential + income.commercial + income.industrial - roadUpkeep - serviceUpkeep;
  return { income, roadUpkeep, serviceUpkeep, balance };
}

/** Cierre de mes: se cobra el balance y se lleva la cuenta de los meses en negativo. */
export function closeMonth(state: CityState): MonthReport {
  const report = projectMonth(state);
  state.money += report.balance;
  state.lastMonth = report;
  state.monthsNegative = state.money < 0 ? state.monthsNegative + 1 : 0;
  return report;
}

/** Con varios meses en negativo, los servicios rinden menos hasta recuperar el saldo. */
export function servicesCut(state: CityState): boolean {
  return state.monthsNegative >= ECONOMY.monthsNegativeBeforeCuts;
}
