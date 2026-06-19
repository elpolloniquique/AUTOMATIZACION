import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import axios from 'axios';
import { POLLON_BRAND } from '../../constants/pollonBrand.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const FRAME = {
  size: 1080,
  footerH: 118,
  cornerSize: 300,
  logoSize: 188,
  logoX: 36,
  logoY: 28,
  defaultAccent: '#c50000' as string,
} as const;

export interface FrameComposeInput {
  photoBuffers: Buffer[];
  brandColor?: string;
  logoUrl?: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16) || 197,
    g: parseInt(h.slice(2, 4), 16) || 0,
    b: parseInt(h.slice(4, 6), 16) || 0,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

function luminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function blendHex(a: string, b: string, t: number): string {
  const c1 = hexToRgb(a);
  const c2 = hexToRgb(b);
  return rgbToHex(
    c1.r * (1 - t) + c2.r * t,
    c1.g * (1 - t) + c2.g * t,
    c1.b * (1 - t) + c2.b * t,
  );
}

function darkenHex(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * factor, g * factor, b * factor);
}

/** Extrae color dominante de la comida y lo adapta para header/footer */
export async function extractSmartAccentColor(photoBuffers: Buffer[], brandFallback = FRAME.defaultAccent): Promise<string> {
  if (photoBuffers.length === 0) return brandFallback;

  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;

  for (const buf of photoBuffers) {
    const { data } = await sharp(buf)
      .resize(100, 100, { fit: 'cover' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    for (let i = 0; i < data.length; i += 3) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const bright = (r + g + b) / 3;
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      if (bright > 235 || bright < 25 || sat < 18) continue;
      rSum += r;
      gSum += g;
      bSum += b;
      count++;
    }
  }

  if (count === 0) return brandFallback;

  let r = rSum / count;
  let g = gSum / count;
  let b = bSum / count;

  // Potenciar saturación hacia tonos cálidos (marca pollería)
  const max = Math.max(r, g, b);
  if (max > 0) {
    r = Math.min(255, r * (255 / max) * 0.95);
    g = Math.min(255, g * (255 / max) * 0.75);
    b = Math.min(255, b * (255 / max) * 0.55);
  }

  let extracted = rgbToHex(r, g, b);
  extracted = darkenHex(extracted, 0.62);
  let accent = blendHex(brandFallback, extracted, 0.42);

  // Asegurar contraste con texto blanco
  const { r: ar, g: ag, b: ab } = hexToRgb(accent);
  if (luminance(ar, ag, ab) > 0.38) {
    accent = darkenHex(accent, 0.72);
  }
  if (luminance(hexToRgb(accent).r, hexToRgb(accent).g, hexToRgb(accent).b) > 0.32) {
    accent = blendHex(accent, brandFallback, 0.55);
  }

  return accent;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildCornerHeaderSvg(accent: string): Buffer {
  const { size, cornerSize } = FRAME;
  return Buffer.from(`
    <svg width="${size}" height="${cornerSize}" xmlns="http://www.w3.org/2000/svg">
      <polygon points="0,0 ${cornerSize},0 0,${cornerSize}" fill="${accent}"/>
    </svg>
  `);
}

function buildFooterSvg(accent: string): Buffer {
  const { size, footerH } = FRAME;
  const phone = escapeXml('+56 9 86925310');
  const web = escapeXml(POLLON_BRAND.websiteDisplay);

  return Buffer.from(`
    <svg width="${size}" height="${footerH}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${footerH}" fill="${accent}"/>
      <g transform="translate(20, ${Math.round(footerH / 2 - 20)})">
        <circle cx="20" cy="20" r="20" fill="#25D366"/>
        <path fill="#fff" d="M20 10c-5.5 0-10 4.5-10 10 0 1.8.5 3.5 1.4 5l-1.3 4.7 4.8-1.3c1.4.8 3 1.3 4.7 1.3 5.5 0 10-4.5 10-10s-4.5-10-10-10zm5.5 14.2c-.3.8-1.4 1.5-2 1.6-.5.1-1.1.2-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.2-.2-1.1-1.5-1.1-2.9 0-1.4.7-2.1 1-2.4.3-.3.6-.4.9-.4h.7c.2 0 .4-.1.7.5.3.6 1 2.4 1 2.6.1.2.1.4 0 .6l-.3.5c-.1.1-.2.2-.1.4.1.2.5 1 1.1 1.5.7.7 1.4 1 1.6 1.1.2.1.4.1.5-.1.2-.2.6-.7.8-.9.2-.2.4-.2.6-.1.3.1 1.7.8 2 1 .3.1.5.2.6.3.1.1.1.7-.2 1.5z"/>
        <text x="50" y="27" fill="#fff" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="700">${phone}</text>
      </g>
      <g transform="translate(${Math.round(size / 2 - 152)}, ${Math.round(footerH / 2 - 30)})">
        <rect width="304" height="60" rx="30" fill="#fff"/>
        <g transform="translate(18, 14)">
          <circle cx="16" cy="16" r="16" fill="${accent}"/>
          <path fill="#fff" d="M10 22h1.5l.8-2.5h3.4l.8 2.5H18l-2.5-8h-3L10 22zm3.5-9.5c1 0 1.8.8 1.8 1.8h-3.6c0-1 .8-1.8 1.8-1.8z"/>
          <circle cx="22" cy="22" r="3" fill="#fff"/>
          <circle cx="10" cy="22" r="3" fill="#fff"/>
        </g>
        <text x="168" y="38" text-anchor="middle" fill="${accent}" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="900">¡PIDE AHORA!</text>
      </g>
      <g transform="translate(${size - 290}, ${Math.round(footerH / 2 - 20)})">
        <circle cx="20" cy="20" r="18" fill="#4A7FD6"/>
        <circle cx="20" cy="20" r="11" fill="none" stroke="#fff" stroke-width="2"/>
        <ellipse cx="20" cy="20" rx="11" ry="11" fill="none" stroke="#fff" stroke-width="1.5"/>
        <line x1="20" y1="9" x2="20" y2="12" stroke="#fff" stroke-width="2"/>
        <line x1="20" y1="28" x2="20" y2="31" stroke="#fff" stroke-width="2"/>
        <line x1="9" y1="20" x2="12" y2="20" stroke="#fff" stroke-width="2"/>
        <line x1="28" y1="20" x2="31" y2="20" stroke="#fff" stroke-width="2"/>
        <text x="48" y="27" fill="#fff" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="600">${web}</text>
      </g>
    </svg>
  `);
}

function buildBottomFadeSvg(accent: string, width: number, height: number): Buffer {
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fade" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0"/>
          <stop offset="100%" stop-color="${accent}" stop-opacity="0.35"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#fade)"/>
    </svg>
  `);
}

async function loadDefaultLogoSvg(): Promise<Buffer> {
  const paths = [
    join(__dirname, '../../../templates/social-posts/assets/logo-placeholder.svg'),
    join(process.cwd(), 'templates/social-posts/assets/logo-placeholder.svg'),
  ];
  for (const p of paths) {
    try {
      return await readFile(p);
    } catch {
      continue;
    }
  }
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <circle cx="100" cy="100" r="96" fill="#fff" stroke="#c50000" stroke-width="8"/>
      <circle cx="100" cy="100" r="82" fill="#c50000"/>
      <text x="100" y="95" text-anchor="middle" fill="#f5a623" font-size="42" font-weight="bold" font-family="Arial">EP</text>
      <text x="100" y="128" text-anchor="middle" fill="#fff" font-size="15" font-family="Arial">El Pollón</text>
    </svg>
  `);
}

async function prepareCircularLogo(logoUrl?: string): Promise<Buffer> {
  const { logoSize } = FRAME;
  let source: Buffer;

  if (logoUrl?.startsWith('http')) {
    try {
      const { data } = await axios.get(logoUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        maxContentLength: 5 * 1024 * 1024,
      });
      source = Buffer.from(data);
    } catch {
      source = await loadDefaultLogoSvg();
    }
  } else {
    source = await loadDefaultLogoSvg();
  }

  const inner = logoSize - 14;
  const photo = await sharp(source)
    .resize(inner, inner, { fit: 'cover' })
    .png()
    .toBuffer();

  const circleMask = Buffer.from(`
    <svg width="${inner}" height="${inner}">
      <circle cx="${inner / 2}" cy="${inner / 2}" r="${inner / 2}" fill="#fff"/>
    </svg>
  `);

  const masked = await sharp(photo)
    .composite([{ input: circleMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const ring = Buffer.from(`
    <svg width="${logoSize}" height="${logoSize}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${logoSize / 2}" cy="${logoSize / 2}" r="${logoSize / 2 - 3}" fill="#fff"/>
      <circle cx="${logoSize / 2}" cy="${logoSize / 2}" r="${logoSize / 2 - 6}" fill="none" stroke="#fff" stroke-width="5"/>
    </svg>
  `);

  return sharp(ring)
    .composite([{ input: masked, top: 7, left: 7 }])
    .png()
    .toBuffer();
}

function computePhotoGrid(count: number, areaW: number, areaH: number, gap: number) {
  const cells: Array<{ w: number; h: number; x: number; y: number }> = [];
  if (count === 1) {
    cells.push({ w: areaW, h: areaH, x: 0, y: 0 });
  } else if (count === 2) {
    const w = Math.floor((areaW - gap) / 2);
    cells.push({ w, h: areaH, x: 0, y: 0 }, { w, h: areaH, x: w + gap, y: 0 });
  } else if (count === 3) {
    const topH = Math.floor((areaH - gap) / 2);
    const bottomH = areaH - topH - gap;
    const topW = Math.floor((areaW - gap) / 2);
    cells.push(
      { w: topW, h: topH, x: 0, y: 0 },
      { w: topW, h: topH, x: topW + gap, y: 0 },
      { w: areaW, h: bottomH, x: 0, y: topH + gap },
    );
  } else {
    const w = Math.floor((areaW - gap) / 2);
    const h = Math.floor((areaH - gap) / 2);
    cells.push(
      { w, h, x: 0, y: 0 },
      { w, h, x: w + gap, y: 0 },
      { w, h, x: 0, y: h + gap },
      { w, h, x: w + gap, y: h + gap },
    );
  }
  return cells;
}

/** Plantilla El Pollón: esquina + logo + foto + footer inteligente */
export async function composePollonGalleryFrame(input: FrameComposeInput): Promise<Buffer> {
  const { size, footerH } = FRAME;
  const contentH = size - footerH;
  const gap = 8;
  const photos = input.photoBuffers.slice(0, 4);
  if (photos.length === 0) throw new Error('Se requiere al menos una foto');

  const brandFallback = input.brandColor || FRAME.defaultAccent;
  const accent = await extractSmartAccentColor(photos, brandFallback);

  const cells = computePhotoGrid(photos.length, size, contentH, gap);
  const photoComposites: sharp.OverlayOptions[] = [];

  for (let i = 0; i < photos.length; i++) {
    const cell = cells[i];
    const tile = await sharp(photos[i])
      .rotate()
      .resize(cell.w, cell.h, { fit: 'cover', position: 'centre' })
      .png()
      .toBuffer();
    photoComposites.push({ input: tile, top: cell.y, left: cell.x });
  }

  const contentLayer = await sharp({
    create: { width: size, height: contentH, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite(photoComposites)
    .png()
    .toBuffer();

  const fadeH = 48;
  const logo = await prepareCircularLogo(input.logoUrl);
  const footer = buildFooterSvg(accent);
  const corner = buildCornerHeaderSvg(accent);
  const fade = buildBottomFadeSvg(accent, size, fadeH);

  return sharp({
    create: { width: size, height: size, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([
      { input: contentLayer, top: 0, left: 0 },
      { input: fade, top: contentH - fadeH, left: 0 },
      { input: footer, top: contentH, left: 0 },
      { input: corner, top: 0, left: 0 },
      { input: logo, top: FRAME.logoY, left: FRAME.logoX },
    ])
    .png({ quality: 94 })
    .toBuffer();
}
