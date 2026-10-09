import { describe, expect, it } from 'vitest';
import { CityState } from '../core/cityState';
import { generateMap, startCenter } from '../core/mapGen';
import { Road, Terrain, Zone } from '../core/types';
import { MAP } from '../data/config';
import { applyZone, buildRoad, lPath, planRoad, planZone, rectArea } from './construction';
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
  state.takeChanges();
  return state;
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

    const sim = new GrowthSim(state, seeded(3));
    run(sim, 120);
    const early = state.stats.population;
    run(sim, 240);
    expect(early).toBeGreaterThan(0);
    expect(state.stats.population).toBeGreaterThan(early);
    expect(state.stats.commercialJobs + state.stats.industrialJobs).toBeGreaterThan(0);
  });
});
