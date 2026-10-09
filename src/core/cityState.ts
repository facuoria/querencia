import { ECONOMY, MAP } from '../data/config';
import { Road, Terrain, type TileCoord } from './types';

/** Estado único de la ciudad. La simulación y las herramientas lo modifican; el dibujo y la interfaz solo lo leen. */
export class CityState {
  readonly size: number;
  readonly sectorSize: number;
  readonly sectorsPerSide: number;
  readonly terrain: Uint8Array;
  readonly roads: Uint8Array;
  readonly unlockedSectors: Uint8Array;
  money: number = ECONOMY.initialMoney;
  /** Días de juego transcurridos desde el inicio. */
  day = 0;
  /** Índices de casillas modificadas desde la última vez que el dibujo las leyó. */
  private readonly changed = new Set<number>();

  constructor(size = MAP.size, sectorSize = MAP.sectorSize) {
    this.size = size;
    this.sectorSize = sectorSize;
    this.sectorsPerSide = size / sectorSize;
    this.terrain = new Uint8Array(size * size);
    this.roads = new Uint8Array(size * size);
    this.unlockedSectors = new Uint8Array(this.sectorsPerSide * this.sectorsPerSide);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
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
    // Los vecinos cambian de forma (curvas, cruces), así que también se marcan.
    this.markChanged(x, y);
    this.markChanged(x - 1, y);
    this.markChanged(x + 1, y);
    this.markChanged(x, y - 1);
    this.markChanged(x, y + 1);
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
