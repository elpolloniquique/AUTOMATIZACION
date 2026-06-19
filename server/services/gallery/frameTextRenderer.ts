import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import opentype from 'opentype.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_NAME = 'Roboto-Bold.ttf';

let fontCache: opentype.Font | null = null;

function getFontSearchPaths(): string[] {
  const cwd = process.cwd();
  return [
    join(cwd, 'api/fonts', FONT_NAME),
    join(cwd, 'templates/fonts', FONT_NAME),
    '/var/task/api/fonts/' + FONT_NAME,
    '/var/task/templates/fonts/' + FONT_NAME,
    join(__dirname, '../../../api/fonts', FONT_NAME),
    join(__dirname, '../../../templates/fonts', FONT_NAME),
    join(__dirname, '../../assets/fonts', FONT_NAME),
    join(__dirname, '../../../../templates/fonts', FONT_NAME),
    join(__dirname, '../../../../api/fonts', FONT_NAME),
  ];
}

async function loadFontFromDisk(): Promise<opentype.Font | null> {
  for (const p of getFontSearchPaths()) {
    try {
      if (!existsSync(p)) continue;
      const buf = await readFile(p);
      return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    } catch {
      continue;
    }
  }
  return null;
}

async function loadFontFromRemote(): Promise<opentype.Font> {
  const urls = [
    'https://github.com/googlefonts/roboto-2/raw/main/src/hinted/Roboto-Bold.ttf',
    'https://raw.githubusercontent.com/googlefonts/roboto-2/main/src/hinted/Roboto-Bold.ttf',
  ];
  for (const url of urls) {
    try {
      const { data } = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 20000,
        maxContentLength: 2 * 1024 * 1024,
      });
      return opentype.parse(data);
    } catch {
      continue;
    }
  }
  throw new Error('No se pudo cargar la fuente para el footer. Intenta de nuevo en unos segundos.');
}

async function loadFont(): Promise<opentype.Font> {
  if (fontCache) return fontCache;
  const fromDisk = await loadFontFromDisk();
  if (fromDisk) {
    fontCache = fromDisk;
    return fontCache;
  }
  fontCache = await loadFontFromRemote();
  return fontCache;
}

export interface TextPathOptions {
  x: number;
  y: number;
  fontSize: number;
  anchor?: 'start' | 'middle' | 'end';
}

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
