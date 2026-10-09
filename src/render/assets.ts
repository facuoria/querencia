import { Assets, Texture } from 'pixi.js';
import { ATLASES } from '../data/sprites';

/** Carga las hojas de sprites. Hay que esperarla antes de crear el dibujo del mapa. */
export async function loadAssets(): Promise<void> {
  await Assets.load(Object.values(ATLASES));
}

export function tex(name: string): Texture {
  return Texture.from(name);
}
