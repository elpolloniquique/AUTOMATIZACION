import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import opentype from 'opentype.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let fontCache: opentype.Font | null = null;

const FONT_PATHS = [
  join(__dirname, '../../../templates/fonts/DejaVuSans-Bold.ttf'),
  join(process.cwd(), 'templates/fonts/DejaVuSans-Bold.ttf'),
];

async function loadFont(): Promise<opentype.Font> {
  if (fontCache) return fontCache;
  for (const p of FONT_PATHS) {
    try {
      const buf = await readFile(p);
      fontCache = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
      return fontCache;
    } catch {
      continue;
    }
  }
  throw new Error('Fuente DejaVuSans-Bold.ttf no encontrada en templates/fonts/');
}

export interface TextPathOptions {
  x: number;
  y: number;
  fontSize: number;
  anchor?: 'start' | 'middle' | 'end';
}

/** Convierte texto a path SVG (funciona en Vercel sin fuentes del sistema) */
export async function textToSvgPath(text: string, options: TextPathOptions): Promise<string> {
  const clean = text.replace(/[^\x20-\x7E]/g, '').trim() || ' ';
  const font = await loadFont();
  const { x, y, fontSize, anchor = 'start' } = options;

  let offsetX = x;
  if (anchor === 'middle') {
    offsetX = x - font.getAdvanceWidth(clean, fontSize) / 2;
  } else if (anchor === 'end') {
    offsetX = x - font.getAdvanceWidth(clean, fontSize);
  }

  const path = font.getPath(clean, offsetX, y, fontSize);
  return path.toPathData(2);
}

/** Trunca texto para que quepa en maxWidth px */
export async function fitTextToWidth(
  text: string,
  maxWidth: number,
  fontSize: number,
): Promise<{ text: string; fontSize: number }> {
  const font = await loadFont();
  let size = fontSize;
  let trimmed = text.replace(/[^\x20-\x7E]/g, '').trim();

  while (size > 12 && font.getAdvanceWidth(trimmed, size) > maxWidth) {
    size -= 1;
  }

  while (trimmed.length > 3 && font.getAdvanceWidth(trimmed, size) > maxWidth) {
    trimmed = `${trimmed.slice(0, -4)}...`;
  }

  return { text: trimmed, fontSize: size };
}
