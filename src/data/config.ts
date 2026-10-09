// Números de configuración del juego. Todo lo ajustable vive acá.

export const MAP = {
  size: 128,
  sectorSize: 16,
  /** Sectores desbloqueados al empezar, en coordenadas de sector (bloque central de 2 x 2). */
  initialSectors: [
    [3, 3],
    [4, 3],
    [3, 4],
    [4, 4],
  ] as ReadonlyArray<readonly [number, number]>,
  seed: 1234,
} as const;

export const TERRAIN_GEN = {
  waterScale: 26,
  waterThreshold: 0.33,
  /** Cuánto se reduce el agua cerca del centro para que el arranque tenga tierra firme. */
  centerLandBias: 0.22,
  centerLandRadius: 28,
  forestScale: 9,
  forestThreshold: 0.6,
} as const;

export const ISO = {
  tileWidth: 64,
  tileHeight: 32,
} as const;

export const CAMERA = {
  minZoom: 0.2,
  maxZoom: 3,
  initialZoom: 1,
  wheelZoomStep: 1.12,
  /** Píxeles de pantalla por segundo al mover con el teclado. */
  keyPanSpeed: 900,
} as const;

export const COLORS = {
  background: 0x1b2430,
  grass: [0x6fae4f, 0x69a84a, 0x74b453],
  water: [0x3a7cc2, 0x3f83c9],
  forestGround: [0x5c9842, 0x58933f],
  treeFoliage: [0x2f6b2c, 0x387a31, 0x2a6127],
  treeTrunk: 0x6b4a2b,
  gridLine: 0x000000,
  gridLineAlpha: 0.08,
  lockedDarken: 0.5,
  lockedBorder: 0x10161d,
  hoverValid: 0xffffff,
  hoverLocked: 0xff5a4f,
} as const;
