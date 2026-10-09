// Convierte una hoja de sprites de Kenney (XML de Starling) al formato JSON de PixiJS
// y copia la imagen al destino.
// Uso: node scripts/kenney-atlas.mjs <hoja.xml> <hoja.png> <carpeta_destino>

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const [xmlPath, pngPath, outDir] = process.argv.slice(2);
if (!xmlPath || !pngPath || !outDir) {
  console.error('Uso: node scripts/kenney-atlas.mjs <hoja.xml> <hoja.png> <carpeta_destino>');
  process.exit(1);
}

const png = readFileSync(pngPath);
const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);

const frames = {};
const re = /<SubTexture\s+name="([^"]+)"\s+x="(\d+)"\s+y="(\d+)"\s+width="(\d+)"\s+height="(\d+)"/g;
for (const m of readFileSync(xmlPath, 'utf8').matchAll(re)) {
  const [, name, x, y, w, h] = m;
  const fw = Number(w);
  const fh = Number(h);
  frames[name] = {
    frame: { x: Number(x), y: Number(y), w: fw, h: fh },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: fw, h: fh },
    sourceSize: { w: fw, h: fh },
  };
}

const imageName = basename(pngPath);
mkdirSync(outDir, { recursive: true });
copyFileSync(pngPath, join(outDir, imageName));
const jsonName = imageName.replace(/\.png$/, '.json');
writeFileSync(
  join(outDir, jsonName),
  JSON.stringify({ frames, meta: { image: imageName, size: { w: width, h: height }, scale: '1' } }, null, 1),
);
console.log(`${jsonName}: ${Object.keys(frames).length} sprites (${width}x${height})`);
