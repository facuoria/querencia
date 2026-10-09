// Qué sprite de Kenney se usa para cada cosa. Los números son los de los archivos originales
// (por ejemplo cityTiles_089.png). Ver public/assets/kenney/.

export const ATLASES = {
  terrain: 'assets/kenney/terrain/landscapeTiles_sheet.json',
  roads: 'assets/kenney/roads/cityTiles_sheet.json',
  details: 'assets/kenney/roads/cityDetails_sheet.json',
  buildings: 'assets/kenney/buildings/buildingTiles_sheet.json',
} as const;

export const SPRITE_ORIGIN = {
  /** Punto del sprite que coincide con la esquina superior del rombo de la casilla. */
  x: 66,
  y: 0,
} as const;

export const TERRAIN_SPRITES = {
  grass: ['landscapeTiles_067.png', 'landscapeTiles_075.png'],
  water: ['landscapeTiles_066.png'],
} as const;

export const TREE_SPRITE = 'cityDetails_010.png';

/**
 * Calles según con qué vecinos se conectan.
 * Bits: 1 = x-1 (borde arriba-izquierda), 2 = y-1 (arriba-derecha),
 *       4 = x+1 (abajo-derecha), 8 = y+1 (abajo-izquierda).
 */
export const ROAD_SPRITES: Record<number, string> = {
  0: 'cityTiles_080.png',
  1: 'cityTiles_111.png',
  2: 'cityTiles_116.png',
  4: 'cityTiles_104.png',
  8: 'cityTiles_110.png',
  5: 'cityTiles_073.png',
  10: 'cityTiles_081.png',
  3: 'cityTiles_121.png',
  6: 'cityTiles_117.png',
  12: 'cityTiles_113.png',
  9: 'cityTiles_118.png',
  7: 'cityTiles_103.png',
  11: 'cityTiles_088.png',
  14: 'cityTiles_095.png',
  13: 'cityTiles_096.png',
  15: 'cityTiles_089.png',
};

/** Tramos rectos de autopista sin cruces: calle con banquinas de pasto. */
export const HIGHWAY_SPRITES: Record<number, string> = {
  5: 'landscapeTiles_074.png',
  10: 'landscapeTiles_082.png',
};

// Edificios: se arman apilando piezas de Isometric Buildings.
// Una base (planta baja con vereda, 132 px) + pisos (99 px) + un techo (99 px).

/** Fila de la base donde cae la esquina superior del rombo de la casilla. */
export const BUILDING_BASE_OFFSET_Y = 26;

const b = (n: number): string => `buildingTiles_${String(n).padStart(3, '0')}.png`;
const list = (...ns: number[]): string[] => ns.map(b);

/** Pisos por color, para que los pisos combinen con la planta baja. */
const FLOORS = {
  brown: list(32, 38, 43, 47),
  yellow: list(39, 44, 48, 51),
  red: list(45, 49, 52, 54),
  beige: list(50, 53, 55, 56),
  glass: list(0, 7, 8, 15, 16, 23, 24, 31),
};

export interface BuildingStyle {
  bases: string[];
  floors: string[];
  roofs: string[];
}

const PITCHED_ROOFS = list(57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 72, 73, 74, 75, 76, 80, 82, 90);
const FLAT_ROOFS = list(79, 86, 87, 94, 95);
const INDUSTRIAL_ROOFS = list(71, 77, 81, 83, 84, 88, 89, 91);

/** Casas por color: base residencial + pisos del mismo color. */
const HOUSES: BuildingStyle[] = [
  { bases: list(14, 21), floors: FLOORS.brown, roofs: PITCHED_ROOFS },
  { bases: list(22, 29), floors: FLOORS.yellow, roofs: PITCHED_ROOFS },
  { bases: list(30, 36), floors: FLOORS.red, roofs: PITCHED_ROOFS },
  { bases: list(37, 42), floors: FLOORS.beige, roofs: PITCHED_ROOFS },
];

export const BUILDING_STYLES = {
  residential: {
    /** Nivel 1: casa de una planta. Nivel 2: dos plantas. Nivel 3: edificio de departamentos. */
    styles: HOUSES,
    floorsByLevel: [0, 0, 1, 4],
    extraFloorsLevel3: 2,
    roofOnGroundFloor: true,
    flatRoofFromLevel: 3,
    flatRoofs: FLAT_ROOFS,
  },
  commercial: {
    styles: [
      {
        bases: list(1, 2, 3, 4, 9, 10, 12, 17, 18, 20, 26, 28, 34, 41),
        floors: FLOORS.glass,
        roofs: FLAT_ROOFS,
      },
    ],
    floorsByLevel: [0, 0, 1, 5],
    extraFloorsLevel3: 3,
    roofOnGroundFloor: false,
    flatRoofFromLevel: 1,
    flatRoofs: FLAT_ROOFS,
  },
  industrial: {
    styles: [
      { bases: list(11, 19, 25, 27, 33, 35, 85, 92, 93), floors: FLOORS.beige, roofs: INDUSTRIAL_ROOFS },
    ],
    floorsByLevel: [0, 0, 1, 2],
    extraFloorsLevel3: 0,
    roofOnGroundFloor: true,
    flatRoofFromLevel: 99,
    flatRoofs: FLAT_ROOFS,
  },
} as const;
