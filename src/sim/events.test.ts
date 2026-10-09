import { describe, expect, it } from 'vitest';
import { CityState } from '../core/cityState';
import { generateMap } from '../core/mapGen';
import { ServiceType, Terrain, Zone } from '../core/types';
import { FIRE, MAP, SECTORS } from '../data/config';
import { planService, planZone, rectArea } from './construction';
import { FireSim } from './fire';
import { GrowthSim } from './growth';
import { currentMilestone, isZoneUnlocked } from './milestones';
import { buySector, canBuySector, sectorCost } from './sectors';

function newCity(): CityState {
  const state = new CityState();
  generateMap(state);
  state.terrain.fill(Terrain.Grass);
  state.takeChanges();
  return state;
}

describe('hitos', () => {
  it('la industria se desbloquea a los 500 habitantes y no se vuelve a bloquear', () => {
    const state = newCity();
    const area = rectArea({ x: 70, y: 110 }, { x: 72, y: 111 });
    expect(isZoneUnlocked(state, Zone.Industrial)).toBe(false);
    expect(planZone(state, area, Zone.Industrial).error).not.toBeNull();
    expect(planService(state, { x: 70, y: 110 }, ServiceType.Gas).error).not.toBeNull();

    state.maxPopulation = 500;
    expect(currentMilestone(state)).toBe(1);
    expect(planZone(state, area, Zone.Industrial).error).toBeNull();
    expect(planService(state, { x: 70, y: 110 }, ServiceType.Gas).error).toBeNull();
    // La universidad todavía no.
    expect(planService(state, { x: 70, y: 110 }, ServiceType.University).error).not.toBeNull();
  });
});

describe('sectores', () => {
  it('solo se compran sectores vecinos y cada uno cuesta más', () => {
    const state = newCity();
    state.money = 1e6;
    const [sx, sy] = MAP.initialSectors[0]!;
    expect(canBuySector(state, sx, sy)).toBe(false);
    expect(canBuySector(state, 0, 0)).toBe(false);
    const first = sectorCost(state);
    expect(first).toBe(SECTORS.baseCost);
    expect(buySector(state, sx - 1, sy)).toBeNull();
    expect(state.isSectorUnlocked(sx - 1, sy)).toBe(true);
    expect(state.money).toBe(1e6 - first);
    expect(sectorCost(state)).toBeGreaterThan(first);
    expect(buySector(state, 0, 0)).not.toBeNull();
  });
});

/** Generador fijo que siempre devuelve el mismo número. */
const always = (v: number) => () => v;

describe('incendios y apagones', () => {
  it('sin bomberos, un incendio se propaga y termina destruyendo el edificio', () => {
    const state = newCity();
    for (let x = 70; x <= 72; x++) {
      state.setZone(x, 110, Zone.Residential);
      state.setLevel(x, 110, 1);
    }
    state.setFire(71, 110, 1);
    const sim = new GrowthSim(state);
    sim.services.update();
    const fire = new FireSim(state, sim.services, always(0));
    fire.dailyTick();
    expect(state.getFire(70, 110)).toBeGreaterThan(0);
    for (let d = 0; d <= FIRE.burnDays; d++) fire.dailyTick();
    expect(state.getLevel(71, 110)).toBe(0);
  });

  it('con bomberos cerca, el incendio se apaga', () => {
    const state = newCity();
    state.maxPopulation = 1e6;
    state.setZone(70, 110, Zone.Residential);
    state.setLevel(70, 110, 1);
    state.setService(MAP.highwayX - 1, 110, ServiceType.Fire, 1);
    state.setFire(70, 110, 1);
    const sim = new GrowthSim(state);
    sim.refresh();
    const fire = new FireSim(state, sim.services, always(0.1));
    fire.dailyTick();
    expect(state.getFire(70, 110)).toBe(0);
    expect(state.getLevel(70, 110)).toBe(1);
  });

  it('si la demanda eléctrica supera la capacidad hay edificios sin luz', () => {
    const state = newCity();
    state.maxPopulation = 1e6;
    state.setService(MAP.highwayX - 1, 110, ServiceType.Power, 1);
    for (let y = 100; y <= 120; y++) {
      for (let x = MAP.highwayX + 1; x <= MAP.highwayX + 12; x++) {
        state.setZone(x, y, Zone.Industrial);
        state.setLevel(x, y, 3);
      }
    }
    const sim = new GrowthSim(state);
    sim.refresh();
    expect(sim.blackoutCount()).toBeGreaterThan(0);
  });
});
