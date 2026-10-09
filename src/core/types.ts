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

export const Zone = {
  None: 0,
  Residential: 1,
  Commercial: 2,
  Industrial: 3,
} as const;
export type Zone = (typeof Zone)[keyof typeof Zone];

export const ServiceType = {
  None: 0,
  Power: 1,
  Water: 2,
  Gas: 3,
  Hospital: 4,
  School: 5,
  University: 6,
  Park: 7,
  Fire: 8,
  Police: 9,
} as const;
export type ServiceType = (typeof ServiceType)[keyof typeof ServiceType];

export interface TileCoord {
  x: number;
  y: number;
}
