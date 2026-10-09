// Qué sprite de Kenney se usa para cada cosa. Los números son los de los archivos originales
// (por ejemplo cityTiles_089.png). Ver public/assets/kenney/.

export const ATLASES = {
  terrain: 'assets/kenney/terrain/landscapeTiles_sheet.json',
  roads: 'assets/kenney/roads/cityTiles_sheet.json',
  details: 'assets/kenney/roads/cityDetails_sheet.json',
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
