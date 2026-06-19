import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONT_NAME = 'Roboto-Bold.ttf';
const src = join(root, 'templates/fonts', FONT_NAME);
const targets = [
  join(root, 'api/fonts', FONT_NAME),
  join(root, 'dist/server/assets/fonts', FONT_NAME),
];

const FONT_URL = 'https://github.com/googlefonts/roboto-2/raw/main/src/hinted/Roboto-Bold.ttf';

function isValidTtfBuffer(buf) {
  return buf.length > 4 && buf[0] === 0 && buf[1] === 1 && buf[2] === 0 && buf[3] === 0;
}

async function ensureSourceFont() {
  if (existsSync(src)) {
    const head = readFileSync(src).subarray(0, 4);
    if (isValidTtfBuffer(head)) return;
  }
  mkdirSync(dirname(src), { recursive: true });
  const res = await fetch(FONT_URL);
  if (!res.ok) throw new Error(`No se pudo descargar ${FONT_NAME}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!isValidTtfBuffer(buf)) throw new Error(`Descarga inválida de ${FONT_NAME}`);
  writeFileSync(src, buf);
  console.log(`[copy-font] Descargada fuente válida en ${src}`);
}

await ensureSourceFont();

mkdirSync(join(root, 'api/fonts'), { recursive: true });
mkdirSync(join(root, 'dist/server/assets/fonts'), { recursive: true });

for (const dest of targets) {
  copyFileSync(src, dest);
  console.log(`[copy-font] ${dest}`);
}
