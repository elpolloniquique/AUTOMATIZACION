import axios from 'axios';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import type { FrameConfig } from './frameConfigService.js';
import { fitTextToWidth, measureTextWidth, textToSvgPath } from './frameTextRenderer.js';
import { getGlobeOnRedCircle, getPhoneOnRedCircle } from './frameIconAssets.js';
import type { FrameComposeInput } from './pollonGalleryFrame.js';

const FRAME_SIZE = 1080;

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

const __dirname = dirname(fileURLToPath(import.meta.url));

export const HF02 = {
  headerH: 200,
  defaultOrange: '#F59E0B',
  defaultRed: '#c50000',
  logoMaxW: 320,
  logoMaxH: 160,
  ctaOverlap: 32,
} as const;

function safeHex(hex: string, fallback: string): string {
  const clean = hex.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(clean) ? clean : fallback;
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '').slice(0, 6);
  return {
    r: parseInt(h.slice(0, 2), 16) || 0,
    g: parseInt(h.slice(2, 4), 16) || 0,
    b: parseInt(h.slice(4, 6), 16) || 0,
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

function blendHex(a: string, b: string, t: number) {
  const c1 = hexToRgb(a);
  const c2 = hexToRgb(b);
  return rgbToHex(c1.r * (1 - t) + c2.r * t, c1.g * (1 - t) + c2.g * t, c1.b * (1 - t) + c2.b * t);
}

async function rasterizeSvg(body: string, width: number, height: number): Promise<Buffer> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${body}`;
  return sharp(Buffer.from(xml, 'utf8'), { density: 144 })
    .resize(width, height, { fit: 'fill' })
    .png()
    .toBuffer();
}

/** Footer naranja inteligente — extrae tonos calidos de la foto */
export async function extractSmartOrangeFooter(photoBuffers: Buffer[], fallback: string = HF02.defaultOrange): Promise<string> {
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;

  for (const buf of photoBuffers) {
    try {
      const { data } = await sharp(buf).resize(80, 80, { fit: 'cover' }).removeAlpha().raw()
        .toBuffer({ resolveWithObject: true });
      for (let i = 0; i < data.length; i += 3) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r < g || r < b * 0.9) continue;
        if (r + g + b < 80 || r + g + b > 720) continue;
        rSum += r;
        gSum += g;
        bSum += b;
        count++;
      }
    } catch { continue; }
  }

  if (count === 0) return safeHex(fallback, HF02.defaultOrange);
  let r = rSum / count;
  let g = gSum / count;
  let b = bSum / count;
  g = Math.min(255, g * 1.05);
  b = Math.min(255, b * 0.55);
  r = Math.min(255, r * 1.08);
  const extracted = rgbToHex(r, g, b);
  return safeHex(blendHex(HF02.defaultOrange, extracted, 0.45), HF02.defaultOrange);
}

async function loadLogoRaster(logoUrl?: string): Promise<Buffer | null> {
  if (!logoUrl?.startsWith('http')) return null;
  try {
    const { data } = await axios.get(logoUrl.split('?')[0], {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxContentLength: 5 * 1024 * 1024,
    });
    return sharp(Buffer.from(data)).rotate().png().toBuffer();
  } catch {
    return null;
  }
}

async function loadLogoFromFile(): Promise<Buffer | null> {
  const paths = [
    join(__dirname, '../../../templates/social-posts/assets/logo-placeholder.svg'),
    join(process.cwd(), 'templates/social-posts/assets/logo-placeholder.svg'),
  ];
  for (const p of paths) {
    try {
      return sharp(await readFile(p)).png().toBuffer();
    } catch { continue; }
  }
  return null;
}

async function prepareCenterHeaderLogo(logoUrl?: string): Promise<Buffer | null> {
  let raster = await loadLogoRaster(logoUrl);
  if (!raster) raster = await loadLogoFromFile();
  if (!raster) return null;
  return sharp(raster)
    .resize(HF02.logoMaxW, HF02.logoMaxH, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();
}

async function buildFooterHf02(orangeColor: string, cfg: FrameConfig): Promise<Buffer> {
  const size = FRAME_SIZE;
  const footerH = cfg.footerHeight;
  const canvasH = footerH + HF02.ctaOverlap;
  const orange = safeHex(cfg.footerAdaptiveColor ? orangeColor : (cfg.footerBgColor || orangeColor), HF02.defaultOrange);
  const redIcon = safeHex(cfg.whatsappIconColor || cfg.accentColor || HF02.defaultRed, HF02.defaultRed);
  const webTextColor = safeHex(cfg.websiteTextColor || cfg.textColor || '#000000', '#000000');
  const phoneTextColor = safeHex(cfg.whatsappTextColor || cfg.textColor || '#000000', '#000000');
  const ctaBg = safeHex(cfg.ctaBgColor || HF02.defaultRed, HF02.defaultRed);
  const ctaTextColor = safeHex(cfg.ctaTextColor || '#ffffff', '#ffffff');
  const fontFamily = cfg.footerFontFamily;
  const iconSize = Math.round(cfg.footerIconSize * 0.88);
  const rowY = HF02.ctaOverlap + Math.round((footerH - iconSize) / 2);
  const textBaseline = rowY + Math.round(iconSize * 0.72);

  const composites: sharp.OverlayOptions[] = [];

  const barSvg = `<svg width="${size}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="${HF02.ctaOverlap}" width="${size}" height="${footerH}" fill="${orange}"/>
  </svg>`;
  composites.push({ input: await rasterizeSvg(barSvg, size, canvasH), top: 0, left: 0 });

  if (cfg.showCta) {
    const pillW = 360;
    const pillH = 58;
    const pillX = Math.round(size / 2 - pillW / 2);
    const pillY = 0;
    const ctaLabel = cfg.ctaText.replace(/[^\x20-\x7E¡!]/g, '').slice(0, 24).toUpperCase();
    const ctaFit = await fitTextToWidth(ctaLabel, pillW - 24, cfg.ctaFontSize, fontFamily);
    const ctaPath = await textToSvgPath(ctaFit.text, {
      x: pillX + pillW / 2,
      y: pillY + Math.round(pillH * 0.72),
      fontSize: ctaFit.fontSize,
      anchor: 'middle',
      fontFamily,
    });
    const ctaSvg = `<svg width="${size}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${ctaBg}"/>
      <path d="${ctaPath}" fill="${ctaTextColor}"/>
    </svg>`;
    composites.push({ input: await rasterizeSvg(ctaSvg, size, canvasH), top: 0, left: 0 });
  }

  if (cfg.showWebsite) {
    const webIcon = await getGlobeOnRedCircle(iconSize, redIcon);
    const leftX = 36;
    composites.push({ input: webIcon, top: rowY, left: leftX });

    const webFit = await fitTextToWidth(cfg.websiteDisplay, 340, cfg.websiteFontSize, fontFamily);
    const webPath = await textToSvgPath(webFit.text, {
      x: leftX + iconSize + 14,
      y: textBaseline,
      fontSize: webFit.fontSize,
      fontFamily,
    });
    const webSvg = `<svg width="${size}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg"><path d="${webPath}" fill="${webTextColor}"/></svg>`;
    composites.push({ input: await rasterizeSvg(webSvg, size, canvasH), top: 0, left: 0 });
  }

  if (cfg.showWhatsapp) {
    const phoneIcon = await getPhoneOnRedCircle(iconSize, redIcon);
    const phoneFit = await fitTextToWidth(cfg.whatsappDisplay, 320, cfg.whatsappFontSize, fontFamily);
    const textW = await measureTextWidth(phoneFit.text, phoneFit.fontSize, fontFamily);
    const blockW = iconSize + 14 + textW;
    const blockX = Math.round(size - blockW - 36);

    composites.push({ input: phoneIcon, top: rowY, left: blockX });

    const phonePath = await textToSvgPath(phoneFit.text, {
      x: blockX + iconSize + 14,
      y: textBaseline,
      fontSize: phoneFit.fontSize,
      fontFamily,
    });
    const phoneSvg = `<svg width="${size}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg"><path d="${phonePath}" fill="${phoneTextColor}"/></svg>`;
    composites.push({ input: await rasterizeSvg(phoneSvg, size, canvasH), top: 0, left: 0 });
  }

  return sharp({
    create: { width: size, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

export async function composePollonGalleryFrameHf02(input: FrameComposeInput): Promise<Buffer> {
  const cfg = input.frameConfig!;
  const size = FRAME_SIZE;
  const headerH = HF02.headerH;
  const footerH = cfg.footerHeight;
  const contentH = size - headerH - footerH;
  const gap = 8;
  const photos = input.photoBuffers.slice(0, 4);

  const orange = await extractSmartOrangeFooter(photos, cfg.footerBgColor || HF02.defaultOrange);

  const cells = computePhotoGrid(photos.length, size, contentH, gap);
  const photoComposites: sharp.OverlayOptions[] = [];
  for (let i = 0; i < photos.length; i++) {
    const cell = cells[i];
    const tile = await sharp(photos[i]).rotate()
      .resize(cell.w, cell.h, { fit: 'cover', position: 'centre' }).png().toBuffer();
    photoComposites.push({ input: tile, top: cell.y, left: cell.x });
  }

  const contentLayer = await sharp({
    create: { width: size, height: contentH, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).composite(photoComposites).png().toBuffer();

  const headerBg = await sharp({
    create: { width: size, height: headerH, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).png().toBuffer();

  const footer = await buildFooterHf02(orange, cfg);
  const logo = cfg.showHeaderLogo ? await prepareCenterHeaderLogo(input.logoUrl) : null;
  const footerTop = size - footerH - HF02.ctaOverlap;

  const composites: sharp.OverlayOptions[] = [
    { input: headerBg, top: 0, left: 0 },
    { input: contentLayer, top: headerH, left: 0 },
    { input: footer, top: footerTop, left: 0 },
  ];

  if (logo) {
    const meta = await sharp(logo).metadata();
    const lw = meta.width || HF02.logoMaxW;
    const lh = meta.height || HF02.logoMaxH;
    composites.push({
      input: logo,
      top: Math.round((headerH - lh) / 2),
      left: Math.round((size - lw) / 2),
    });
  }

  return sharp({
    create: { width: size, height: size, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite(composites)
    .png({ quality: 94 })
    .toBuffer();
}

export async function composeFramePreviewHf02(cfg: FrameConfig, logoUrl?: string): Promise<Buffer> {
  const size = FRAME_SIZE;
  const headerH = HF02.headerH;
  const footerH = cfg.footerHeight;
  const previewH = 400;
  const contentH = previewH - headerH - footerH;

  const placeholder = await sharp({
    create: { width: size, height: Math.max(contentH, 100), channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).png().toBuffer();

  const orange = await extractSmartOrangeFooter([placeholder], cfg.footerBgColor || HF02.defaultOrange);
  const headerBg = await sharp({
    create: { width: size, height: headerH, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).png().toBuffer();

  const footer = await buildFooterHf02(orange, cfg);
  const logo = cfg.showHeaderLogo ? await prepareCenterHeaderLogo(logoUrl) : null;
  const footerTop = previewH - footerH - HF02.ctaOverlap;

  const composites: sharp.OverlayOptions[] = [
    { input: headerBg, top: 0, left: 0 },
    { input: placeholder, top: headerH, left: 0 },
    { input: footer, top: footerTop, left: 0 },
  ];

  if (logo) {
    const meta = await sharp(logo).metadata();
    composites.push({
      input: logo,
      top: Math.round((headerH - (meta.height || 120)) / 2),
      left: Math.round((size - (meta.width || 200)) / 2),
    });
  }

  return sharp({
    create: { width: size, height: previewH, channels: 3, background: { r: 240, g: 240, b: 240 } },
  })
    .composite(composites)
    .resize(540, Math.round(previewH / 2))
    .png()
    .toBuffer();
}
