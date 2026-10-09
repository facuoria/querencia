export const Terrain = {
  Grass: 0,
  Water: 1,
  Forest: 2,
} as const;
export type Terrain = (typeof Terrain)[keyof typeof Terrain];

export interface TileCoord {
  x: number;
  y: number;
}
