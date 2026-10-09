export const Terrain = {
  Grass: 0,
  Water: 1,
  Forest: 2,
} as const;
export type Terrain = (typeof Terrain)[keyof typeof Terrain];

export const Road = {
  None: 0,
  Street: 1,
  /** Conexión con el exterior. Viene construida y no se puede demoler. */
  Highway: 2,
} as const;
export type Road = (typeof Road)[keyof typeof Road];

export interface TileCoord {
  x: number;
  y: number;
}
