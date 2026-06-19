import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import opentype from 'opentype.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export type FooterFontFamily = 'Roboto-Bold' | 'Roboto-Black';

const FONT_FILES: Record<FooterFontFamily, string> = {
  'Roboto-Bold': 'Roboto-Bold.ttf',
  'Roboto-Black': 'Roboto-Black.ttf',
};

const FONT_URLS: Record<FooterFontFamily, string> = {
  'Roboto-Bold': 'https://github.com/googlefonts/roboto-2/raw/main/src/hinted/Roboto-Bold.ttf',
  'Roboto-Black': 'https://github.com/googlefonts/roboto-2/raw/main/src/hinted/Roboto-Black.ttf',
};

const fontCaches = new Map<FooterFontFamily, opentype.Font>();

function getFontSearchPaths(fileName: string): string[] {
  const cwd = process.cwd();
  return [
    join(cwd, 'api/fonts', fileName),
    join(cwd, 'templates/fonts', fileName),
    '/var/task/api/fonts/' + fileName,
    '/var/task/templates/fonts/' + fileName,
    join(__dirname, '../../../api/fonts', fileName),
    join(__dirname, '../../../templates/fonts', fileName),
    join(__dirname, '../../assets/fonts', fileName),
    join(__dirname, '../../../../templates/fonts', fileName),
    join(__dirname, '../../../../api/fonts', fileName),
  ];
}

async function loadFontFromDisk(fileName: string): Promise<opentype.Font | null> {
  for (const p of getFontSearchPaths(fileName)) {
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

async function loadFontFromRemote(family: FooterFontFamily): Promise<opentype.Font> {
  const url = FONT_URLS[family];
  const { data } = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 20000,
    maxContentLength: 2 * 1024 * 1024,
  });
  return opentype.parse(data);
}

export async function loadFooterFont(family: FooterFontFamily = 'Roboto-Black'): Promise<opentype.Font> {
  const cached = fontCaches.get(family);
  if (cached) return cached;

  const fileName = FONT_FILES[family];
  const fromDisk = await loadFontFromDisk(fileName);
  const font = fromDisk || await loadFontFromRemote(family);
  fontCaches.set(family, font);
  return font;
}

export interface TextPathOptions {
  x: number;
  y: number;
  fontSize: number;
  anchor?: 'start' | 'middle' | 'end';
  fontFamily?: FooterFontFamily;
}

export async function textToSvgPath(text: string, options: TextPathOptions): Promise<string> {
  const clean = text.replace(/[^\x20-\x7E]/g, '').trim() || ' ';
  const font = await loadFooterFont(options.fontFamily || 'Roboto-Black');
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
  fontFamily: FooterFontFamily = 'Roboto-Black',
): Promise<{ text: string; fontSize: number }> {
  const font = await loadFooterFont(fontFamily);
  let size = fontSize;
  let trimmed = text.replace(/[^\x20-\x7E]/g, '').trim();

  while (size > 14 && font.getAdvanceWidth(trimmed, size) > maxWidth) {
    size -= 1;
  }

  while (trimmed.length > 3 && font.getAdvanceWidth(trimmed, size) > maxWidth) {
    trimmed = `${trimmed.slice(0, -4)}...`;
  }

  return { text: trimmed, fontSize: size };
}

export async function measureTextWidth(
  text: string,
  fontSize: number,
  fontFamily: FooterFontFamily = 'Roboto-Black',
): Promise<number> {
  const font = await loadFooterFont(fontFamily);
  return font.getAdvanceWidth(text.replace(/[^\x20-\x7E]/g, '').trim(), fontSize);
}
