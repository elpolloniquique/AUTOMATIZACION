import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const FONTS = [
  {
    name: 'Roboto-Bold.ttf',
    url: 'https://github.com/googlefonts/roboto-2/raw/main/src/hinted/Roboto-Bold.ttf',
  },
  {
    name: 'Roboto-Black.ttf',
    url: 'https://github.com/googlefonts/roboto-2/raw/main/src/hinted/Roboto-Black.ttf',
  },
];

function isValidTtfBuffer(buf) {
  return buf.length > 4 && buf[0] === 0 && buf[1] === 1 && buf[2] === 0 && buf[3] === 0;
}

async function ensureSourceFont({ name, url }) {
  const src = join(root, 'templates/fonts', name);
  if (existsSync(src)) {
    const head = readFileSync(src).subarray(0, 4);
    if (isValidTtfBuffer(head)) return src;
  }
  mkdirSync(dirname(src), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar ${name}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!isValidTtfBuffer(buf)) throw new Error(`Descarga inválida de ${name}`);
  writeFileSync(src, buf);
  console.log(`[copy-font] Descargada fuente válida en ${src}`);
  return src;
}

mkdirSync(join(root, 'api/fonts'), { recursive: true });
mkdirSync(join(root, 'dist/server/assets/fonts'), { recursive: true });

for (const font of FONTS) {
  const src = await ensureSourceFont(font);
  for (const destDir of ['api/fonts', 'dist/server/assets/fonts']) {
    const dest = join(root, destDir, font.name);
    copyFileSync(src, dest);
    console.log(`[copy-font] ${dest}`);
  }
}
