// Textos visibles para el jugador.

export const TEXTS = {
  title: 'Ciudad',
  terrain: {
    grass: 'Pasto',
    water: 'Agua',
    forest: 'Bosque',
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
  help: [
    'Arrastrar con clic derecho o central: mover el mapa',
    'Flechas o WASD: mover el mapa',
    'Rueda del mouse: zoom',
    'Inicio: volver al centro',
  ],
} as const;
