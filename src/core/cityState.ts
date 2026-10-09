import { MAP } from '../data/config';
import { Terrain, type TileCoord } from './types';

/** Estado único de la ciudad. La simulación y las herramientas lo modifican; el dibujo y la interfaz solo lo leen. */
export class CityState {
  readonly size: number;
  readonly sectorSize: number;
  readonly sectorsPerSide: number;
  readonly terrain: Uint8Array;
  readonly unlockedSectors: Uint8Array;

  constructor(size = MAP.size, sectorSize = MAP.sectorSize) {
    this.size = size;
    this.sectorSize = sectorSize;
    this.sectorsPerSide = size / sectorSize;
    this.terrain = new Uint8Array(size * size);
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
}
