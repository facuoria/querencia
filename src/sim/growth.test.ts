import { describe, expect, it } from 'vitest';
import { CityState } from '../core/cityState';
import { generateMap, startCenter } from '../core/mapGen';
import { Road, ServiceType, Terrain, Zone } from '../core/types';
import { MAP } from '../data/config';
import {
  applyZone,
  buildRoad,
  buildService,
  demolish,
  lPath,
  planDemolish,
  planRoad,
  planService,
  planZone,
  rectArea,
} from './construction';
import { GrowthSim } from './growth';

/** Generador pseudoaleatorio fijo, para que las pruebas den siempre lo mismo. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Mapa plano sin agua ni bosque, para que las pruebas no dependan del terreno. */
function flatCity(): CityState {
  const state = new CityState();
  generateMap(state);
  state.terrain.fill(Terrain.Grass);
  // Todo desbloqueado, como si la ciudad ya hubiera pasado todos los hitos.
  state.maxPopulation = 1e6;
  state.takeChanges();
  return state;
}

/** Planta eléctrica y pozo de agua junto a la autopista, a la altura y. */
function addUtilities(state: CityState, y: number): void {
  for (const [dy, type] of [
    [0, ServiceType.Power],
    [1, ServiceType.Water],
  ] as const) {
    const p = { x: MAP.highwayX - 1, y: y + dy };
    expect(buildService(state, planService(state, p, type), type)).toBeNull();
  }
}

function run(sim: GrowthSim, days: number): void {
  for (let i = 0; i < days; i++) sim.dailyTick();
}

describe('crecimiento de zonas', () => {
  it('una zona con calle conectada a la autopista se puebla sola', () => {
    const state = flatCity();
    const c = startCenter(state);
    const y = Math.floor(c.y);
    // Calle desde la autopista hacia la derecha y zona residencial a su lado.
    expect(buildRoad(state, planRoad(state, lPath({ x: MAP.highwayX, y }, { x: MAP.highwayX + 12, y })))).toBeNull();
    const area = rectArea({ x: MAP.highwayX + 1, y: y + 1 }, { x: MAP.highwayX + 12, y: y + 2 });
    expect(applyZone(state, planZone(state, area, Zone.Residential), Zone.Residential)).toBeNull();
    addUtilities(state, y);

    const sim = new GrowthSim(state, seeded(1));
    run(sim, 60);
    expect(state.stats.population).toBeGreaterThan(0);
  });

  it('una zona sin calle conectada no crece', () => {
    const state = flatCity();
    const c = startCenter(state);
    const x = MAP.highwayX + 5;
    const y = Math.floor(c.y);
    // Calle suelta, sin tocar la autopista.
    buildRoad(state, planRoad(state, lPath({ x, y }, { x: x + 8, y })));
    const area = rectArea({ x, y: y + 1 }, { x: x + 8, y: y + 2 });
    applyZone(state, planZone(state, area, Zone.Residential), Zone.Residential);
    addUtilities(state, y);

    const sim = new GrowthSim(state, seeded(2));
    run(sim, 60);
    expect(state.stats.population).toBe(0);
    expect(state.getRoad(x, y)).toBe(Road.Street);
  });

  it('con residencial, comercial e industrial la ciudad sigue creciendo', () => {
    const state = flatCity();
    const c = startCenter(state);
    const y0 = Math.floor(c.y) - 10;
    // Cuadrícula de calles cada 4 casillas a la derecha de la autopista.
    for (let k = 0; k < 6; k++) {
      const y = y0 + k * 4;
      buildRoad(state, planRoad(state, lPath({ x: MAP.highwayX, y }, { x: MAP.highwayX + 14, y })));
    }
    const zones = [Zone.Residential, Zone.Residential, Zone.Commercial, Zone.Industrial, Zone.Residential];
    zones.forEach((zone, k) => {
      const y = y0 + k * 4;
      const area = rectArea({ x: MAP.highwayX + 1, y: y + 1 }, { x: MAP.highwayX + 14, y: y + 3 });
      applyZone(state, planZone(state, area, zone), zone);
    });
    addUtilities(state, y0 + 2);

    const sim = new GrowthSim(state, seeded(3));
    run(sim, 120);
    const early = state.stats.population;
    run(sim, 240);
    expect(early).toBeGreaterThan(0);
    expect(state.stats.population).toBeGreaterThan(early);
    expect(state.stats.commercialJobs + state.stats.industrialJobs).toBeGreaterThan(0);
  });
});

describe('servicios', () => {
  it('sin luz ni agua no se construye nada', () => {
    const state = flatCity();
    const y = Math.floor(startCenter(state).y);
    buildRoad(state, planRoad(state, lPath({ x: MAP.highwayX, y }, { x: MAP.highwayX + 12, y })));
    const area = rectArea({ x: MAP.highwayX + 1, y: y + 1 }, { x: MAP.highwayX + 12, y: y + 2 });
    applyZone(state, planZone(state, area, Zone.Residential), Zone.Residential);
    const sim = new GrowthSim(state, seeded(4));
    run(sim, 60);
    expect(state.stats.population).toBe(0);
  });

  it('construir o quitar una planta cambia la cobertura', () => {
    const state = flatCity();
    const y = Math.floor(startCenter(state).y);
    const sim = new GrowthSim(state, seeded(5));
    const p = { x: MAP.highwayX + 1, y };
    const far = state.index(p.x + 8, p.y);
    sim.refresh();
    expect(sim.services.coverage[ServiceType.Power]![far]).toBe(0);

    buildService(state, planService(state, p, ServiceType.Power), ServiceType.Power);
    sim.refresh();
    expect(sim.services.coverage[ServiceType.Power]![far]).toBe(1);
    expect(sim.services.utilities[ServiceType.Power]!.capacity).toBeGreaterThan(0);

    demolish(state, planDemolish(state, [p]));
    sim.refresh();
    expect(sim.services.coverage[ServiceType.Power]![far]).toBe(0);
    expect(sim.services.utilities[ServiceType.Power]!.capacity).toBe(0);
  });

  it('un servicio sin calle cerca no funciona', () => {
    const state = flatCity();
    const y = Math.floor(startCenter(state).y);
    const p = { x: MAP.highwayX + 10, y };
    buildService(state, planService(state, p, ServiceType.Hospital), ServiceType.Hospital);
    const sim = new GrowthSim(state, seeded(6));
    sim.refresh();
    expect(sim.services.isWorking(p.x, p.y)).toBe(false);
    expect(sim.services.coverage[ServiceType.Hospital]![state.index(p.x, p.y)]).toBe(0);
  });

  it('si el consumo supera la capacidad hay déficit y parte de la ciudad queda sin luz', () => {
    const state = flatCity();
    const y = Math.floor(startCenter(state).y);
    addUtilities(state, y);
    // Edificios ya construidos que piden más luz de la que da una planta.
    for (let yy = y - 8; yy <= y + 8; yy++) {
      for (let x = MAP.highwayX + 1; x <= MAP.highwayX + 12; x++) {
        if (state.getService(x, yy) !== ServiceType.None) continue;
        state.setZone(x, yy, Zone.Industrial);
        state.setLevel(x, yy, 3);
      }
    }
    const sim = new GrowthSim(state, seeded(7));
    sim.refresh();
    const power = sim.services.utilities[ServiceType.Power]!;
    expect(power.consumption).toBeGreaterThan(power.capacity);
    let unsupplied = 0;
    for (let i = 0; i < state.buildingLevel.length; i++) {
      if (state.buildingLevel[i]! > 0 && sim.services.supplied[ServiceType.Power]![i] !== 1) unsupplied++;
    }
    expect(unsupplied).toBeGreaterThan(0);
  });
});
