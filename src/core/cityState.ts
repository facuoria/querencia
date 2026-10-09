import { ECONOMY, MAP } from '../data/config';
import { Road, Terrain, Zone, type TileCoord } from './types';

export interface Demand {
  residential: number;
  commercial: number;
  industrial: number;
}

/** Totales que calcula la simulación una vez por día. */
export interface CityStats {
  population: number;
  commercialJobs: number;
  industrialJobs: number;
  demand: Demand;
}

/** Estado único de la ciudad. La simulación y las herramientas lo modifican; el dibujo y la interfaz solo lo leen. */
export class CityState {
  readonly size: number;
  readonly sectorSize: number;
  readonly sectorsPerSide: number;
  readonly terrain: Uint8Array;
  readonly roads: Uint8Array;
  readonly zones: Uint8Array;
  /** Nivel del edificio de cada casilla zonificada: 0 = lote vacío, 1 a 3 = edificio. */
  readonly buildingLevel: Uint8Array;
  readonly unlockedSectors: Uint8Array;
  /** Habitantes de cada sector (barrio). */
  readonly sectorPopulation: Float64Array;
  money: number = ECONOMY.initialMoney;
  /** Días de juego transcurridos desde el inicio. */
  day = 0;
  /** Sube cada vez que cambia la red de calles, para recalcular conexiones. */
  roadsVersion = 0;
  stats: CityStats = {
    population: 0,
    commercialJobs: 0,
    industrialJobs: 0,
    demand: { residential: 0, commercial: 0, industrial: 0 },
  };
  /** Índices de casillas modificadas desde la última vez que el dibujo las leyó. */
  private readonly changed = new Set<number>();

  constructor(size = MAP.size, sectorSize = MAP.sectorSize) {
    this.size = size;
    this.sectorSize = sectorSize;
    this.sectorsPerSide = size / sectorSize;
    const n = size * size;
    this.terrain = new Uint8Array(n);
    this.roads = new Uint8Array(n);
    this.zones = new Uint8Array(n);
    this.buildingLevel = new Uint8Array(n);
    this.unlockedSectors = new Uint8Array(this.sectorsPerSide * this.sectorsPerSide);
    this.sectorPopulation = new Float64Array(this.sectorsPerSide * this.sectorsPerSide);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }

  index(x: number, y: number): number {
    return y * this.size + x;
  }

  getTerrain(x: number, y: number): Terrain {
    return this.terrain[y * this.size + x] as Terrain;
  }

  setTerrain(x: number, y: number, t: Terrain): void {
    this.terrain[y * this.size + x] = t;
    this.markChanged(x, y);
  }

  getRoad(x: number, y: number): Road {
    return this.roads[y * this.size + x] as Road;
  }

  setRoad(x: number, y: number, r: Road): void {
    this.roads[y * this.size + x] = r;
    this.roadsVersion++;
    // Los vecinos cambian de forma (curvas, cruces), así que también se marcan.
    this.markChanged(x, y);
    this.markChanged(x - 1, y);
    this.markChanged(x + 1, y);
    this.markChanged(x, y - 1);
    this.markChanged(x, y + 1);
  }

  getZone(x: number, y: number): Zone {
    return this.zones[y * this.size + x] as Zone;
  }

  /** Cambia la zona de una casilla. Si había un edificio, se pierde. */
  setZone(x: number, y: number, z: Zone): void {
    const i = y * this.size + x;
    this.zones[i] = z;
    this.buildingLevel[i] = 0;
    this.markChanged(x, y);
  }

  getLevel(x: number, y: number): number {
    return this.buildingLevel[y * this.size + x]!;
  }

  setLevel(x: number, y: number, level: number): void {
    this.buildingLevel[y * this.size + x] = level;
    this.markChanged(x, y);
  }

  /** Devuelve y vacía la lista de casillas modificadas. */
  takeChanges(): number[] {
    const out = [...this.changed];
    this.changed.clear();
    return out;
  }

  sectorOf(x: number, y: number): TileCoord {
    return { x: Math.floor(x / this.sectorSize), y: Math.floor(y / this.sectorSize) };
  }

  isSectorUnlocked(sx: number, sy: number): boolean {
    return this.unlockedSectors[sy * this.sectorsPerSide + sx] === 1;
  }

  unlockSector(sx: number, sy: number): void {
    this.unlockedSectors[sy * this.sectorsPerSide + sx] = 1;
  }

  isTileUnlocked(x: number, y: number): boolean {
    const s = this.sectorOf(x, y);
    return this.isSectorUnlocked(s.x, s.y);
  }

  private markChanged(x: number, y: number): void {
    if (this.inBounds(x, y)) this.changed.add(y * this.size + x);
  }
}
