import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import axios from 'axios';
import { defaultFrameConfig, type FrameConfig } from './frameConfigService.js';
import { fitTextToWidth, measureTextWidth, textToSvgPath } from './frameTextRenderer.js';
import { getDeliveryIcon, getGlobeIcon, getWhatsappIcon } from './frameIconAssets.js';

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
  frameConfig?: FrameConfig;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '').slice(0, 6);
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

/** Solo hex valido para SVG (evita errores libxml en Vercel) */
function safeHexColor(hex: string): string {
  const clean = hex.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(clean)) return clean;
  return FRAME.defaultAccent;
}

/** SVG ASCII seguro — sin caracteres Unicode que rompen librsvg en Linux/Vercel */
function svgBuffer(body: string): Buffer {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${body}`;
  return Buffer.from(xml, 'utf8');
}


async function rasterizeSvg(body: string, width: number, height: number): Promise<Buffer> {
  return sharp(svgBuffer(body), { density: 144 })
    .resize(width, height, { fit: 'fill' })
    .png()
    .toBuffer();
}

export async function extractSmartAccentColor(photoBuffers: Buffer[], brandFallback = FRAME.defaultAccent): Promise<string> {
  if (photoBuffers.length === 0) return safeHexColor(brandFallback);

  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;

  for (const buf of photoBuffers) {
    try {
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
    } catch {
      continue;
    }
  }

  if (count === 0) return safeHexColor(brandFallback);

  let r = rSum / count;
  let g = gSum / count;
  let b = bSum / count;

  const max = Math.max(r, g, b);
  if (max > 0) {
    r = Math.min(255, r * (255 / max) * 0.95);
    g = Math.min(255, g * (255 / max) * 0.75);
    b = Math.min(255, b * (255 / max) * 0.55);
  }

  let extracted = rgbToHex(r, g, b);
  extracted = darkenHex(extracted, 0.62);
  let accent = blendHex(safeHexColor(brandFallback), extracted, 0.42);

  const { r: ar, g: ag, b: ab } = hexToRgb(accent);
  if (luminance(ar, ag, ab) > 0.38) accent = darkenHex(accent, 0.72);
  if (luminance(hexToRgb(accent).r, hexToRgb(accent).g, hexToRgb(accent).b) > 0.32) {
    accent = blendHex(accent, safeHexColor(brandFallback), 0.55);
  }

  return safeHexColor(accent);
}

function buildCornerHeaderSvg(accent: string, cornerSize: number): string {
  const { size } = FRAME;
  const color = safeHexColor(accent);
  return `
    <svg width="${size}" height="${cornerSize}" xmlns="http://www.w3.org/2000/svg">
      <polygon points="0,0 ${cornerSize},0 0,${cornerSize}" fill="${color}"/>
    </svg>`;
}

async function buildFooterHf01(
  smartAccent: string,
  cfg: FrameConfig,
  hasFooterLogo: boolean,
): Promise<Buffer> {
  const { size } = FRAME;
  const footerH = cfg.footerHeight;
  const bgColor = cfg.footerAdaptiveColor
    ? safeHexColor(smartAccent)
    : safeHexColor(cfg.footerBgColor || smartAccent);
  const fontFamily = cfg.footerFontFamily;
  const iconSize = cfg.footerIconSize;
  const rowCenter = Math.round(footerH / 2);
  const textBaseline = rowCenter + Math.round(iconSize * 0.18);

  const bgRgb = hexToRgb(bgColor);
  const composites: sharp.OverlayOptions[] = [];

  const leftPad = hasFooterLogo && cfg.showFooterLogo ? 68 : 20;

  if (cfg.showWhatsapp) {
    const waIcon = await getWhatsappIcon(iconSize);
    composites.push({
      input: waIcon,
      top: rowCenter - Math.round(iconSize / 2),
      left: leftPad,
    });

    const waColor = safeHexColor(cfg.whatsappTextColor || cfg.textColor);
    const phoneFit = await fitTextToWidth(cfg.whatsappDisplay, 250, cfg.whatsappFontSize, fontFamily);
    const phonePath = await textToSvgPath(phoneFit.text, {
      x: leftPad + iconSize + 14,
      y: textBaseline,
      fontSize: phoneFit.fontSize,
      fontFamily,
    });
    const waTextSvg = `<svg width="${size}" height="${footerH}" xmlns="http://www.w3.org/2000/svg"><path d="${phonePath}" fill="${waColor}"/></svg>`;
    composites.push({ input: await rasterizeSvg(waTextSvg, size, footerH), top: 0, left: 0 });
  }

  if (cfg.showCta) {
    const pillW = 340;
    const pillH = 68;
    const pillX = Math.round(size / 2 - pillW / 2);
    const pillY = rowCenter - Math.round(pillH / 2);
    const ctaColor = safeHexColor(cfg.ctaTextColor || smartAccent);
    const ctaBg = safeHexColor(cfg.ctaBgColor);

    const deliveryIcon = await getDeliveryIcon(Math.round(iconSize * 0.82));
    composites.push({
      input: deliveryIcon,
      top: pillY + Math.round((pillH - iconSize * 0.82) / 2),
      left: pillX + 16,
    });

    const ctaFit = await fitTextToWidth(cfg.ctaText, pillW - 90, cfg.ctaFontSize, fontFamily);
    const ctaPath = await textToSvgPath(ctaFit.text, {
      x: pillX + pillW / 2 + 12,
      y: pillY + Math.round(pillH * 0.72),
      fontSize: ctaFit.fontSize,
      anchor: 'middle',
      fontFamily,
    });

    const ctaSvg = `<svg width="${size}" height="${footerH}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${ctaBg}"/>
      <path d="${ctaPath}" fill="${ctaColor}"/>
    </svg>`;
    composites.push({ input: await rasterizeSvg(ctaSvg, size, footerH), top: 0, left: 0 });
  }

  if (cfg.showWebsite) {
    const webColor = safeHexColor(cfg.websiteTextColor || cfg.textColor);
    const webFit = await fitTextToWidth(cfg.websiteDisplay, 220, cfg.websiteFontSize, fontFamily);
    const textW = await measureTextWidth(webFit.text, webFit.fontSize, fontFamily);
    const webIcon = await getGlobeIcon(iconSize);
    const blockW = iconSize + 14 + textW;
    const blockX = size - blockW - 20;

    composites.push({
      input: webIcon,
      top: rowCenter - Math.round(iconSize / 2),
      left: blockX,
    });

    const webPath = await textToSvgPath(webFit.text, {
      x: blockX + iconSize + 14,
      y: textBaseline,
      fontSize: webFit.fontSize,
      fontFamily,
    });
    const webTextSvg = `<svg width="${size}" height="${footerH}" xmlns="http://www.w3.org/2000/svg"><path d="${webPath}" fill="${webColor}"/></svg>`;
    composites.push({ input: await rasterizeSvg(webTextSvg, size, footerH), top: 0, left: 0 });
  }

  return sharp({
    create: { width: size, height: footerH, channels: 3, background: bgRgb },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

function buildBottomFadeSvg(accent: string, width: number, height: number): string {
  const color = safeHexColor(accent);
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${color}" stop-opacity="0"/>
          <stop offset="1" stop-color="${color}" stop-opacity="0.35"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#fade)"/>
    </svg>`;
}

async function buildDefaultLogoPng(size: number): Promise<Buffer> {
  const epPath = await textToSvgPath('EP', { x: size / 2, y: size / 2 + 8, fontSize: Math.round(size * 0.22), anchor: 'middle' });
  const namePath = await textToSvgPath('El Pollon', { x: size / 2, y: size / 2 + 36, fontSize: Math.round(size * 0.09), anchor: 'middle' });
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="#ffffff"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 10}" fill="#c50000"/>
      <path d="${epPath}" fill="#f5a623"/>
      <path d="${namePath}" fill="#ffffff"/>
    </svg>`;
  return rasterizeSvg(svg, size, size);
}

async function loadLogoFromFile(): Promise<Buffer | null> {
  const paths = [
    join(__dirname, '../../../templates/social-posts/assets/logo-placeholder.svg'),
    join(process.cwd(), 'templates/social-posts/assets/logo-placeholder.svg'),
  ];
  for (const p of paths) {
    try {
      const raw = await readFile(p);
      return sharp(raw).png().toBuffer();
    } catch {
      continue;
    }
  }
  return null;
}

async function loadLogoRaster(logoUrl?: string): Promise<Buffer | null> {
  if (logoUrl?.startsWith('http')) {
    try {
      const cleanUrl = logoUrl.split('?')[0];
      const { data } = await axios.get(cleanUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        maxContentLength: 5 * 1024 * 1024,
      });
      return await sharp(Buffer.from(data)).rotate().png().toBuffer();
    } catch {
      return null;
    }
  }
  return null;
}

async function prepareLogoBadge(raster: Buffer, badgeSize: number): Promise<Buffer> {
  const inner = badgeSize - 14;
  let photo: Buffer;
  try {
    photo = await sharp(raster)
      .resize(inner, inner, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();
  } catch {
    photo = await buildDefaultLogoPng(inner);
  }

  const maskSvg = `
    <svg width="${inner}" height="${inner}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${inner / 2}" cy="${inner / 2}" r="${inner / 2}" fill="#ffffff"/>
    </svg>`;

  const masked = await sharp(photo)
    .composite([{ input: await rasterizeSvg(maskSvg, inner, inner), blend: 'dest-in' }])
    .png()
    .toBuffer();

  const ringSvg = `
    <svg width="${badgeSize}" height="${badgeSize}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${badgeSize / 2}" cy="${badgeSize / 2}" r="${badgeSize / 2 - 3}" fill="#ffffff"/>
      <circle cx="${badgeSize / 2}" cy="${badgeSize / 2}" r="${badgeSize / 2 - 6}" fill="none" stroke="#ffffff" stroke-width="5"/>
    </svg>`;

  const ring = await rasterizeSvg(ringSvg, badgeSize, badgeSize);

  return sharp(ring)
    .composite([{ input: masked, top: 7, left: 7 }])
    .png()
    .toBuffer();
}

async function prepareCircularLogo(logoUrl?: string): Promise<Buffer> {
  let raster = await loadLogoRaster(logoUrl);
  if (!raster) raster = await loadLogoFromFile();
  if (!raster) raster = await buildDefaultLogoPng(FRAME.logoSize);
  return prepareLogoBadge(raster, FRAME.logoSize);
}

async function prepareFooterLogo(logoUrl?: string): Promise<Buffer | null> {
  let raster = await loadLogoRaster(logoUrl);
  if (!raster) return null;
  return prepareLogoBadge(raster, 52);
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

export async function composePollonGalleryFrame(input: FrameComposeInput): Promise<Buffer> {
  const cfg = input.frameConfig || defaultFrameConfig();
  const { size } = FRAME;
  const footerH = cfg.footerHeight;
  const contentH = size - footerH;
  const gap = 8;
  const photos = input.photoBuffers.slice(0, 4);
  if (photos.length === 0) throw new Error('Se requiere al menos una foto');

  const brandFallback = cfg.accentColor || input.brandColor || FRAME.defaultAccent;
  const accent = await extractSmartAccentColor(photos, brandFallback);

  const cells = computePhotoGrid(photos.length, size, contentH, gap);
  const photoComposites: sharp.OverlayOptions[] = [];

  for (let i = 0; i < photos.length; i++) {
    const cell = cells[i];
    let tile: Buffer;
    try {
      tile = await sharp(photos[i])
        .rotate()
        .resize(cell.w, cell.h, { fit: 'cover', position: 'centre' })
        .png()
        .toBuffer();
    } catch {
      throw new Error(`No se pudo procesar la foto ${i + 1}. Verifica que sea JPG o PNG valido.`);
    }
    photoComposites.push({ input: tile, top: cell.y, left: cell.x });
  }

  const contentLayer = await sharp({
    create: { width: size, height: contentH, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite(photoComposites)
    .png()
    .toBuffer();

  const fadeH = 48;
  const showFooterLogo = cfg.showFooterLogo;
  const [logo, footerLogo] = await Promise.all([
    cfg.showHeaderLogo ? prepareCircularLogo(input.logoUrl) : Promise.resolve(null),
    showFooterLogo ? prepareFooterLogo(input.logoUrl) : Promise.resolve(null),
  ]);

  const footer = await buildFooterHf01(accent, cfg, Boolean(footerLogo));
  const cornerSize = cfg.headerStyle === 'minimal' ? 0 : cfg.cornerSize;

  const [corner, fade] = await Promise.all([
    cornerSize > 0
      ? rasterizeSvg(buildCornerHeaderSvg(accent, cornerSize), size, cornerSize)
      : Promise.resolve(null),
    rasterizeSvg(buildBottomFadeSvg(accent, size, fadeH), size, fadeH),
  ]);

  const composites: sharp.OverlayOptions[] = [
    { input: contentLayer, top: 0, left: 0 },
    { input: fade, top: contentH - fadeH, left: 0 },
    { input: footer, top: contentH, left: 0 },
  ];

  if (corner) composites.push({ input: corner, top: 0, left: 0 });
  if (logo) composites.push({ input: logo, top: FRAME.logoY, left: FRAME.logoX });

  if (footerLogo) {
    composites.push({
      input: footerLogo,
      top: contentH + Math.round((footerH - 52) / 2),
      left: 8,
    });
  }

  return sharp({
    create: { width: size, height: size, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite(composites)
    .png({ quality: 94 })
    .toBuffer();
}

/** Preview del header/footer para la UI de configuracion */
export async function composeFramePreview(cfg: FrameConfig, brandColor?: string, logoUrl?: string): Promise<Buffer> {
  const size = FRAME.size;
  const footerH = cfg.footerHeight;
  const previewH = 400;
  const contentH = previewH - footerH;

  const warmPlaceholder = await sharp({
    create: { width: size, height: contentH, channels: 3, background: { r: 180, g: 120, b: 70 } },
  })
    .png()
    .toBuffer();

  const smartAccent = await extractSmartAccentColor(
    [warmPlaceholder],
    cfg.accentColor || brandColor || FRAME.defaultAccent,
  );

  const footerLogo = cfg.showFooterLogo ? await prepareFooterLogo(logoUrl) : null;
  const footer = await buildFooterHf01(smartAccent, cfg, Boolean(footerLogo));
  const cornerSize = cfg.headerStyle === 'minimal' ? 0 : Math.min(cfg.cornerSize, 200);

  const [corner] = await Promise.all([
    cornerSize > 0
      ? rasterizeSvg(buildCornerHeaderSvg(smartAccent, cornerSize), size, cornerSize)
      : Promise.resolve(null),
  ]);

  const composites: sharp.OverlayOptions[] = [
    { input: warmPlaceholder, top: 0, left: 0 },
    { input: footer, top: contentH, left: 0 },
  ];
  if (corner) composites.push({ input: corner, top: 0, left: 0 });
  if (cfg.showHeaderLogo) {
    const logo = await prepareCircularLogo(logoUrl);
    composites.push({ input: logo, top: 20, left: 24 });
  }
  if (footerLogo) {
    composites.push({
      input: footerLogo,
      top: contentH + Math.round((footerH - 52) / 2),
      left: 8,
    });
  }

  return sharp({
    create: { width: size, height: previewH, channels: 3, background: { r: 30, g: 30, b: 30 } },
  })
    .composite(composites)
    .resize(540, Math.round(previewH / 2))
    .png()
    .toBuffer();
}
