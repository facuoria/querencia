import { describe, expect, it } from 'vitest';
import { CityState } from '../core/cityState';
import { generateMap } from '../core/mapGen';
import { ServiceType, Zone } from '../core/types';
import { deserialize, serialize } from './save';

describe('guardado', () => {
  it('una partida guardada se recupera igual', () => {
    const state = new CityState();
    generateMap(state);
    state.setZone(70, 110, Zone.Residential);
    state.setLevel(70, 110, 2);
    state.setService(60, 110, ServiceType.Hospital, 2);
    state.setFire(70, 110, 3);
    state.money = 12345.5;
    state.day = 417;
    state.taxRates.commercial = 14;
    state.sectorsBought = 2;
    state.maxPopulation = 2500;
    state.unlockSector(5, 6);

    const copy = deserialize(serialize(state));
    expect(copy).not.toBeNull();
    for (const key of ['terrain', 'roads', 'zones', 'buildingLevel', 'service', 'serviceLevel', 'fire', 'unlockedSectors'] as const) {
      expect(Array.from(copy![key])).toEqual(Array.from(state[key]));
    }
    expect(copy!.money).toBe(12345.5);
    expect(copy!.day).toBe(417);
    expect(copy!.taxRates.commercial).toBe(14);
    expect(copy!.sectorsBought).toBe(2);
    expect(copy!.maxPopulation).toBe(2500);
  });

  it('un texto inválido no rompe la carga', () => {
    expect(deserialize('no es json')).toBeNull();
    expect(deserialize(JSON.stringify({ version: 999 }))).toBeNull();
  });
});
