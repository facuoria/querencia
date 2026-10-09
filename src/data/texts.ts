// Textos visibles para el jugador.

export const TEXTS = {
  title: 'Ciudad',
  terrain: {
    grass: 'Pasto',
    water: 'Agua',
    forest: 'Bosque',
  },
  road: {
    street: 'Calle',
    highway: 'Autopista',
  },
  hud: {
    tile: 'Casilla',
    terrain: 'Terreno',
    sector: 'Sector',
    locked: 'Bloqueado',
    unlocked: 'Disponible',
    noTile: 'Fuera del mapa',
    zoom: 'Zoom',
    fps: 'FPS',
  },
  tools: {
    select: 'Seleccionar',
    road: 'Carretera',
    demolish: 'Demoler',
  },
  time: {
    pause: 'Pausa',
    year: 'año',
    months: [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ],
  },
  errors: {
    noMoney: 'No alcanza el dinero',
    water: 'No se puede construir sobre el agua',
    locked: 'Ese sector todavía no es tuyo',
    highway: 'La autopista no se puede demoler',
    nothing: 'No hay nada para demoler',
  },
  help: [
    'Arrastrar con clic derecho o central: mover el mapa',
    'Flechas o WASD: mover · Rueda: zoom · Inicio: volver',
    'R: carretera · B: demoler · Esc: soltar herramienta',
    'Espacio: pausa · 1, 2, 3: velocidad',
  ],
} as const;
