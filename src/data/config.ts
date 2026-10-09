// Números de configuración del juego. Todo lo ajustable vive acá.

export const MAP = {
  size: 128,
  sectorSize: 16,
  /**
   * Sectores desbloqueados al empezar, en coordenadas de sector.
   * Es un bloque de 2 x 2 pegado al borde inferior izquierdo (y máximo), junto a la autopista.
   */
  initialSectors: [
    [3, 6],
    [4, 6],
    [3, 7],
    [4, 7],
  ] as ReadonlyArray<readonly [number, number]>,
  /** Columna x por la que pasa la autopista, de borde a borde a lo largo del eje y. */
  highwayX: 64,
  seed: 1234,
} as const;

export const TERRAIN_GEN = {
  waterScale: 26,
  waterThreshold: 0.33,
  /** Cuánto se reduce el agua cerca de la zona inicial para que el arranque tenga tierra firme. */
  startLandBias: 0.22,
  startLandRadius: 28,
  /** Casillas a cada lado de la autopista que siempre son tierra. */
  highwayClearance: 2,
  forestScale: 9,
  forestThreshold: 0.6,
} as const;

/** Tamaño de la cara superior de una casilla. Coincide con los sprites de Kenney (132 x 66). */
export const ISO = {
  tileWidth: 132,
  tileHeight: 66,
} as const;

export const CAMERA = {
  minZoom: 0.1,
  maxZoom: 1.5,
  initialZoom: 0.55,
  wheelZoomStep: 1.12,
  /** Píxeles de pantalla por segundo al mover con el teclado. */
  keyPanSpeed: 900,
} as const;

export const ECONOMY = {
  initialMoney: 20000,
} as const;

export const COSTS = {
  /** Por casilla de calle nueva. */
  road: 10,
  /** Extra por talar un bosque al construir encima. */
  clearForest: 5,
  /** Por casilla demolida (calle o bosque). */
  demolish: 2,
} as const;

export const TIME = {
  /** Milisegundos reales que dura un día de juego a velocidad x1. */
  msPerDay: 1500,
  daysPerMonth: 30,
  monthsPerYear: 12,
  /** Multiplicadores de velocidad disponibles (el índice 0 es la pausa). */
  speeds: [0, 1, 2, 3],
  initialSpeed: 1,
} as const;

export const COLORS = {
  background: 0x1b2430,
  gridLine: 0x000000,
  gridLineAlpha: 0.12,
  /** Tinte que oscurece los sectores bloqueados. */
  lockedTint: 0x8c8c8c,
  unlockedBorder: 0xfff3c4,
  hoverValid: 0xffffff,
  hoverLocked: 0xff5a4f,
  previewBuild: 0x4fd16b,
  previewExisting: 0xcfd8e3,
  previewInvalid: 0xff5a4f,
  previewDemolish: 0xffa23a,
  treeTints: [0xffffff, 0xe3eed6, 0xc9dbb6, 0xf2f7d8],
} as const;
