/**
 * Genera preview local de HF02 para verificar renderizado.
 * Uso: node scripts/test-hf02-frame.mjs
 */
import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { defaultFrameConfig, templateRowToConfig } from '../dist/server/services/gallery/frameConfigService.js';
import { composePollonGalleryFrameHf02 } from '../dist/server/services/gallery/pollonGalleryFrameHf02.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, '../tmp-hf02-preview.png');

const cfg = defaultFrameConfig('hf02');
const placeholder = await sharp({
  create: { width: 800, height: 600, channels: 3, background: { r: 200, g: 140, b: 80 } },
})
  .jpeg()
  .toBuffer();

const buf = await composePollonGalleryFrameHf02({
  photoBuffers: [placeholder],
  frameConfig: cfg,
});

await writeFile(out, buf);
console.log('OK ->', out, `(${buf.length} bytes)`);
