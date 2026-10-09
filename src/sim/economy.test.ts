import { describe, expect, it } from 'vitest';
import { CityState } from '../core/cityState';
import { generateMap, startCenter } from '../core/mapGen';
import { ServiceType, Terrain, Zone } from '../core/types';
import { ECONOMY, MAP, TIME } from '../data/config';
import { buildRoad, buildService, demolish, lPath, planDemolish, planRoad, planService } from './construction';
import { projectMonth } from './economy';
import { GrowthSim } from './growth';

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Barrio ya construido: calles cada 3 filas, casas de nivel 2, comercio e industria para dar empleo,
 * luz, agua y un hospital.
 */
function builtCity(): { state: CityState; hospital: { x: number; y: number } } {
  const state = new CityState();
  generateMap(state);
  state.terrain.fill(Terrain.Grass);
  state.money = 1e6;
  const y0 = Math.floor(startCenter(state).y) - 9;
  const x0 = MAP.highwayX + 1;
  for (let k = 0; k < 7; k++) {
    const y = y0 + k * 3;
    buildRoad(state, planRoad(state, lPath({ x: MAP.highwayX, y }, { x: x0 + 13, y })));
  }
  for (let k = 0; k < 6; k++) {
    for (const dy of [1, 2]) {
      const y = y0 + k * 3 + dy;
      for (let x = x0; x <= x0 + 13; x++) {
        const zone = k < 4 ? Zone.Residential : k === 4 ? Zone.Commercial : Zone.Industrial;
        state.setZone(x, y, zone);
        state.setLevel(x, y, 2);
      }
    }
  }
  for (const [dy, type] of [
    [0, ServiceType.Power],
    [1, ServiceType.Power],
    [2, ServiceType.Water],
    [3, ServiceType.Water],
  ] as const) {
    buildService(state, planService(state, { x: MAP.highwayX - 1, y: y0 + dy }, type), type);
  }
  const hospital = { x: MAP.highwayX - 1, y: y0 + 6 };
  buildService(state, planService(state, hospital, ServiceType.Hospital), ServiceType.Hospital);
  return { state, hospital };
}

function runDays(state: CityState, sim: GrowthSim, days: number): void {
  for (let i = 0; i < days; i++) {
    state.day++;
    sim.dailyTick();
  }
}

describe('economía y ánimo', () => {
  it('subir los impuestos baja el ánimo y la población', () => {
    const base = builtCity();
    const sim = new GrowthSim(base.state, seeded(1));
    sim.refresh();
    const happyBefore = base.state.stats.happiness;

    const taxed = builtCity();
    taxed.state.taxRates.residential = ECONOMY.maxTaxRate;
    const simTaxed = new GrowthSim(taxed.state, seeded(1));
    simTaxed.refresh();
    expect(taxed.state.stats.happiness).toBeLessThan(happyBefore);

    runDays(base.state, sim, 120);
    runDays(taxed.state, simTaxed, 120);
    expect(taxed.state.stats.population).toBeLessThan(base.state.stats.population);
  });

  it('sacar un servicio baja el ánimo', () => {
    const { state, hospital } = builtCity();
    const sim = new GrowthSim(state, seeded(2));
    sim.refresh();
    const before = state.stats.happiness;
    demolish(state, planDemolish(state, [hospital]));
    sim.refresh();
    expect(state.stats.happiness).toBeLessThan(before);
  });

  it('a fin de mes se cobra el balance del presupuesto', () => {
    const { state } = builtCity();
    const sim = new GrowthSim(state, seeded(3));
    sim.refresh();
    const projected = projectMonth(state).balance;
    expect(projected).not.toBe(0);
    const before = state.money;
    // Mismo estado justo antes del cierre: el balance cobrado es el estimado de ese momento.
    state.day = TIME.daysPerMonth;
    const expected = projectMonth(state).balance;
    sim.dailyTick();
    expect(state.lastMonth?.balance).toBeCloseTo(expected);
    expect(state.money).toBeCloseTo(before + expected);
  });

  it('con varios meses en negativo los servicios cubren menos', () => {
    const { state } = builtCity();
    const sim = new GrowthSim(state, seeded(4));
    sim.refresh();
    const r = sim.services.radiusOf(ServiceType.Hospital, 1);
    state.money = -1e6;
    state.monthsNegative = ECONOMY.monthsNegativeBeforeCuts;
    sim.refresh();
    expect(sim.services.radiusOf(ServiceType.Hospital, 1)).toBeLessThan(r);
  });
});
