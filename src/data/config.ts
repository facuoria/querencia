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
  /** Tasa de impuestos inicial y límites, en porcentaje. */
  defaultTaxRate: 9,
  minTaxRate: 0,
  maxTaxRate: 20,
  /** Lo que paga por mes cada habitante o empleo con una tasa del 100%. Con 9% se cobra el 9% de esto. */
  taxBase: { residential: 10, commercial: 12, industrial: 10 },
  /** Mantenimiento mensual por casilla de calle. */
  roadUpkeep: 0.5,
  /** El mantenimiento de un servicio se multiplica por esto según su nivel (índice = nivel - 1). */
  upkeepByLevel: [1, 1.6, 2.4],
  /** Meses seguidos en negativo antes de que los servicios rindan menos. */
  monthsNegativeBeforeCuts: 3,
  /** Con recortes, el radio de los servicios se multiplica por esto. */
  cutsRadiusFactor: 0.6,
} as const;

export const HAPPINESS = {
  /** Punto de partida antes de sumar y restar factores. */
  base: 50,
  // Servicios
  noPower: -18,
  noWater: -18,
  hospital: 8,
  school: 6,
  university: 3,
  // Impuestos y empleo
  /** Puntos por cada punto de impuesto residencial por encima (resta) o por debajo (suma) de la tasa inicial. */
  perTaxPoint: -2.5,
  /** Puntos con 100% de desempleo (se escala con la proporción). */
  unemployment: -40,
  // Entorno
  park: 10,
  waterOrForest: 4,
  /** Industria cerca: contaminación y ruido. */
  industryNearby: -14,
  industryRadius: 4,
  /** Junto a la autopista: ruido y tráfico. */
  highwayNoise: -5,
  highwayNoiseDistance: 1,
  // Seguridad
  police: 8,
  fire: 5,
  /** Sin policía, en barrios de más de esta población, aumenta la delincuencia. */
  crimePopulation: 300,
  crime: -10,
  // Efectos
  /** Por debajo de este ánimo la gente se va: los edificios bajan de nivel. */
  leaveBelow: 35,
  /** Probabilidad diaria máxima de bajar de nivel por ánimo bajo (con ánimo 0). */
  leaveChance: 0.04,
  /** Cuánto suma a la demanda residencial el ánimo de la ciudad: (ánimo - 50) / 50 * esto. */
  demandEffect: 0.35,
  /** Cuánto suma al valor del suelo el ánimo de la casilla: (ánimo - 50) / 50 * esto. */
  landValueEffect: 0.12,
  /** Puntos de demanda comercial e industrial por cada punto de impuesto sobre la tasa inicial. */
  businessTaxDemand: -0.05,
} as const;

export const COSTS = {
  /** Por casilla de calle nueva. */
  road: 10,
  /** Extra por talar un bosque al construir encima. */
  clearForest: 5,
  /** Por casilla zonificada. */
  zone: 5,
  /** Parte del costo de construcción que se devuelve al demoler. Talar bosque es gratis. */
  demolishRefund: 0.5,
} as const;

export const GROWTH = {
  /** Multiplicador general de la velocidad de crecimiento. Se calibra jugando. */
  speed: 1,
  /** Distancia máxima (en casillas, sin diagonales) entre un lote y una calle conectada a la autopista. */
  accessDistance: 3,
  /** Intentos de crecimiento por día y por tipo de zona, con demanda máxima. */
  attemptsPerDay: 6,
  /** Probabilidad de que un intento sobre un lote vacío construya un edificio, con demanda máxima. */
  buildChance: 0.6,
  /** Probabilidad de que un intento sobre un edificio lo suba de nivel, con demanda máxima. */
  upgradeChance: 0.25,
  /** Probabilidad diaria de que un edificio sin acceso baje un nivel. */
  decayWithoutAccess: 0.05,
  /** Con demanda por debajo de este valor, los edificios pueden bajar de nivel. */
  decayDemand: -0.4,
  decayChance: 0.02,
  /** Valor del suelo mínimo para cada nivel (índice = nivel). */
  landValueForLevel: [0, 0, 0.3, 0.55],
  /** Población de la ciudad necesaria para que aparezca el nivel 3 (hito "Ciudad"). */
  level3MinPopulation: 10000,
} as const;

/** Habitantes (residencial) o empleos (comercial e industrial) por edificio, según nivel. */
export const CAPACITY = {
  residential: [0, 6, 24, 90],
  commercial: [0, 4, 14, 50],
  industrial: [0, 10, 24, 60],
} as const;

export const DEMAND = {
  /** Parte de los habitantes que trabaja. */
  workerRatio: 0.5,
  /** Empleos disponibles afuera de la ciudad, por la autopista. Arrancan la demanda residencial. */
  externalJobs: 40,
  /** Cuánta gente de más acepta venir aunque no haya empleo para todos (0.15 = 15%). */
  residentialSlack: 0.15,
  /** Empleos comerciales que pide cada habitante. */
  commercialPerResident: 0.2,
  /** Empleos industriales que pide cada habitante. */
  industrialPerResident: 0.32,
  /** Demanda base de comercio e industria cuando la ciudad está vacía. */
  baseCommercial: 6,
  baseIndustrial: 12,
  /** Escala para pasar de diferencia (objetivo - actual) a demanda entre -1 y 1. */
  scaleMin: 30,
  scaleRatio: 0.35,
} as const;

export const LAND_VALUE = {
  base: 0.25,
  /** Bonus por agua y bosque cerca (radio en casillas). */
  waterRadius: 4,
  waterBonus: 0.2,
  forestRadius: 3,
  forestBonus: 0.15,
  /** Penalización por industria cerca, para residencial y comercial. */
  industryRadius: 5,
  industryPenalty: 0.35,
  /** Bonus por estar rodeado de edificios de nivel alto. */
  neighborhoodRadius: 3,
  neighborhoodBonus: 0.3,
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
  previewRadius: 0x7fd3ff,
  zoneResidential: 0x5fd35f,
  zoneCommercial: 0x4f9bff,
  zoneIndustrial: 0xf2c53d,
  zoneAlpha: 0.45,
  treeTints: [0xffffff, 0xe3eed6, 0xc9dbb6, 0xf2f7d8],
} as const;
