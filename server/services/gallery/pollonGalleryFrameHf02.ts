import sharp from 'sharp';
import type { FrameConfig } from './frameConfigService.js';
import { fitTextToWidth, measureTextWidth, textToSvgPath } from './frameTextRenderer.js';
import {
  getGlobeOnRedCircle,
  getLocationPinIcon,
  getPhoneOnRedCircle,
  getYellowLightningBolt,
} from './frameIconAssets.js';
import { prepareCircularHeaderLogo, type FrameComposeInput } from './pollonGalleryFrame.js';

const FRAME_SIZE = 1080;
const RASTER_DPI = 216;

export const HF02 = {
  headerH: 220,
  defaultYellow: '#F2B705',
  defaultRed: '#C40000',
  logoBadgeSize: 168,
  ctaOverlap: 34,
  cornerSize: 118,
  boltW: 36,
  boltH: 72,
} as const;

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
  return sharp(Buffer.from(xml, 'utf8'), { density: RASTER_DPI })
    .resize(width, height, { fit: 'fill' })
    .png()
    .toBuffer();
}

/** Footer amarillo inteligente — extrae tonos calidos dorados de la foto */
export async function extractSmartYellowFooter(photoBuffers: Buffer[], fallback: string = HF02.defaultYellow): Promise<string> {
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
        if (g < r * 0.75 || g < b) continue;
        if (r + g + b < 100 || r + g + b > 700) continue;
        rSum += r;
        gSum += g;
        bSum += b;
        count++;
      }
    } catch { continue; }
  }

  if (count === 0) return safeHex(fallback, HF02.defaultYellow);
  let r = rSum / count;
  let g = gSum / count;
  let b = bSum / count;
  g = Math.min(255, g * 1.12);
  r = Math.min(255, r * 1.05);
  b = Math.min(255, b * 0.45);
  return safeHex(blendHex(HF02.defaultYellow, rgbToHex(r, g, b), 0.4), HF02.defaultYellow);
}

function buildCornerTrianglesSvg(size: number, headerH: number, yellow: string): string {
  const c = HF02.cornerSize;
  return `<svg width="${size}" height="${headerH}" xmlns="http://www.w3.org/2000/svg">
    <polygon points="0,0 ${c},0 0,${c}" fill="${yellow}"/>
    <polygon points="${size},0 ${size - c},0 ${size},${c}" fill="${yellow}"/>
  </svg>`;
}

async function buildHeaderHf02(yellow: string, cfg: FrameConfig, logoUrl?: string): Promise<Buffer> {
  const size = FRAME_SIZE;
  const headerH = HF02.headerH;
  const accent = safeHex(cfg.accentColor || yellow, yellow);

  const composites: sharp.OverlayOptions[] = [];

  const base = await sharp({
    create: { width: size, height: headerH, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).png().toBuffer();
  composites.push({ input: base, top: 0, left: 0 });

  const corners = await rasterizeSvg(buildCornerTrianglesSvg(size, headerH, accent), size, headerH);
  composites.push({ input: corners, top: 0, left: 0 });

  if (cfg.showHeaderLogo) {
    const logo = await prepareCircularHeaderLogo(logoUrl, HF02.logoBadgeSize);
    const meta = await sharp(logo).metadata();
    const lw = meta.width || HF02.logoBadgeSize;
    const lh = meta.height || HF02.logoBadgeSize;
    const logoLeft = Math.round((size - lw) / 2);
    const logoTop = Math.round((headerH - lh) / 2 + 4);

    const bolt = await getYellowLightningBolt(HF02.boltW, HF02.boltH, accent);
    composites.push({
      input: bolt,
      top: Math.round(logoTop + (lh - HF02.boltH) / 2),
      left: Math.max(12, logoLeft - HF02.boltW - 18),
    });

    composites.push({ input: logo, top: logoTop, left: logoLeft });
  }

  return sharp({
    create: { width: size, height: headerH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

type FooterSlot = 'web' | 'address' | 'phone';

async function renderFooterSlot(
  slot: FooterSlot,
  cfg: FrameConfig,
  sectionX: number,
  sectionW: number,
  canvasH: number,
  rowY: number,
  textBaseline: number,
  iconSize: number,
  redIcon: string,
): Promise<sharp.OverlayOptions[]> {
  const fontFamily = cfg.footerFontFamily;
  const out: sharp.OverlayOptions[] = [];

  if (slot === 'web' && cfg.showWebsite) {
    const icon = await getGlobeOnRedCircle(iconSize, redIcon);
    const fit = await fitTextToWidth(cfg.websiteDisplay, sectionW - iconSize - 20, cfg.websiteFontSize, fontFamily);
    const textW = await measureTextWidth(fit.text, fit.fontSize, fontFamily);
    const blockW = iconSize + 10 + textW;
    const startX = Math.round(sectionX + (sectionW - blockW) / 2);
    out.push({ input: icon, top: rowY, left: startX });
    const path = await textToSvgPath(fit.text, {
      x: startX + iconSize + 10,
      y: textBaseline,
      fontSize: fit.fontSize,
      fontFamily,
    });
    const color = safeHex(cfg.websiteTextColor || cfg.textColor || '#000000', '#000000');
    out.push({ input: await rasterizeSvg(`<svg width="${FRAME_SIZE}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg"><path d="${path}" fill="${color}"/></svg>`, FRAME_SIZE, canvasH), top: 0, left: 0 });
    return out;
  }

  if (slot === 'address' && cfg.showAddress) {
    const icon = await getLocationPinIcon(iconSize, redIcon);
    const fit = await fitTextToWidth(cfg.addressDisplay, sectionW - iconSize - 16, cfg.addressFontSize, fontFamily);
    const textW = await measureTextWidth(fit.text, fit.fontSize, fontFamily);
    const blockW = iconSize + 8 + textW;
    const startX = Math.round(sectionX + (sectionW - blockW) / 2);
    out.push({ input: icon, top: rowY, left: startX });
    const path = await textToSvgPath(fit.text, {
      x: startX + iconSize + 8,
      y: textBaseline,
      fontSize: fit.fontSize,
      fontFamily,
    });
    const color = safeHex(cfg.addressTextColor || cfg.textColor || '#000000', '#000000');
    out.push({ input: await rasterizeSvg(`<svg width="${FRAME_SIZE}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg"><path d="${path}" fill="${color}"/></svg>`, FRAME_SIZE, canvasH), top: 0, left: 0 });
    return out;
  }

  if (slot === 'phone' && cfg.showWhatsapp) {
    const icon = await getPhoneOnRedCircle(iconSize, redIcon);
    const fit = await fitTextToWidth(cfg.whatsappDisplay, sectionW - iconSize - 16, cfg.whatsappFontSize, fontFamily);
    const textW = await measureTextWidth(fit.text, fit.fontSize, fontFamily);
    const blockW = iconSize + 10 + textW;
    const startX = Math.round(sectionX + (sectionW - blockW) / 2);
    out.push({ input: icon, top: rowY, left: startX });
    const path = await textToSvgPath(fit.text, {
      x: startX + iconSize + 10,
      y: textBaseline,
      fontSize: fit.fontSize,
      fontFamily,
    });
    const color = safeHex(cfg.whatsappTextColor || cfg.textColor || '#000000', '#000000');
    out.push({ input: await rasterizeSvg(`<svg width="${FRAME_SIZE}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg"><path d="${path}" fill="${color}"/></svg>`, FRAME_SIZE, canvasH), top: 0, left: 0 });
  }

  return out;
}

async function buildFooterHf02(yellowColor: string, cfg: FrameConfig): Promise<Buffer> {
  const size = FRAME_SIZE;
  const footerH = cfg.footerHeight;
  const canvasH = footerH + HF02.ctaOverlap;
  const yellow = safeHex(cfg.footerAdaptiveColor ? yellowColor : (cfg.footerBgColor || yellowColor), HF02.defaultYellow);
  const redIcon = safeHex(cfg.whatsappIconColor || cfg.accentColor || HF02.defaultRed, HF02.defaultRed);
  const ctaBg = safeHex(cfg.ctaBgColor || HF02.defaultRed, HF02.defaultRed);
  const ctaTextColor = safeHex(cfg.ctaTextColor || '#ffffff', '#ffffff');
  const fontFamily = cfg.footerFontFamily;
  const iconSize = Math.round(cfg.footerIconSize);
  const rowY = HF02.ctaOverlap + Math.round((footerH - iconSize) / 2);
  const textBaseline = rowY + Math.round(iconSize * 0.74);

  const composites: sharp.OverlayOptions[] = [];

  const barSvg = `<svg width="${size}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="${HF02.ctaOverlap}" width="${size}" height="${footerH}" fill="${yellow}"/>
  </svg>`;
  composites.push({ input: await rasterizeSvg(barSvg, size, canvasH), top: 0, left: 0 });

  if (cfg.showCta) {
    const pillW = 380;
    const pillH = 60;
    const pillX = Math.round(size / 2 - pillW / 2);
    const ctaLabel = cfg.ctaText.replace(/[^\x20-\x7E¡!]/g, '').slice(0, 24).toUpperCase();
    const ctaFit = await fitTextToWidth(ctaLabel, pillW - 28, cfg.ctaFontSize + 2, fontFamily);
    const ctaPath = await textToSvgPath(ctaFit.text, {
      x: pillX + pillW / 2,
      y: Math.round(pillH * 0.72),
      fontSize: ctaFit.fontSize,
      anchor: 'middle',
      fontFamily,
    });
    const ctaSvg = `<svg width="${size}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${pillX}" y="0" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${ctaBg}"/>
      <path d="${ctaPath}" fill="${ctaTextColor}"/>
    </svg>`;
    composites.push({ input: await rasterizeSvg(ctaSvg, size, canvasH), top: 0, left: 0 });
  }

  const slots: FooterSlot[] = [];
  if (cfg.showWebsite) slots.push('web');
  if (cfg.showAddress) slots.push('address');
  if (cfg.showWhatsapp) slots.push('phone');

  const sectionW = size / Math.max(slots.length, 1);
  for (let i = 0; i < slots.length; i++) {
    const slotComposites = await renderFooterSlot(
      slots[i],
      cfg,
      i * sectionW,
      sectionW,
      canvasH,
      rowY,
      textBaseline,
      iconSize,
      redIcon,
    );
    composites.push(...slotComposites);
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

  const yellow = await extractSmartYellowFooter(photos, cfg.footerBgColor || HF02.defaultYellow);

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

  const [header, footer] = await Promise.all([
    buildHeaderHf02(yellow, cfg, input.logoUrl),
    buildFooterHf02(yellow, cfg),
  ]);

  const footerTop = size - footerH - HF02.ctaOverlap;

  return sharp({
    create: { width: size, height: size, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([
      { input: header, top: 0, left: 0 },
      { input: contentLayer, top: headerH, left: 0 },
      { input: footer, top: footerTop, left: 0 },
    ])
    .png({ quality: 96 })
    .toBuffer();
}

export async function composeFramePreviewHf02(cfg: FrameConfig, logoUrl?: string): Promise<Buffer> {
  const size = FRAME_SIZE;
  const headerH = HF02.headerH;
  const footerH = cfg.footerHeight;
  const previewH = 420;
  const contentH = previewH - headerH - footerH;

  const placeholder = await sharp({
    create: { width: size, height: Math.max(contentH, 100), channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).png().toBuffer();

  const yellow = await extractSmartYellowFooter([placeholder], cfg.footerBgColor || HF02.defaultYellow);
  const [header, footer] = await Promise.all([
    buildHeaderHf02(yellow, cfg, logoUrl),
    buildFooterHf02(yellow, cfg),
  ]);
  const footerTop = previewH - footerH - HF02.ctaOverlap;

  return sharp({
    create: { width: size, height: previewH, channels: 3, background: { r: 245, g: 245, b: 245 } },
  })
    .composite([
      { input: header, top: 0, left: 0 },
      { input: placeholder, top: headerH, left: 0 },
      { input: footer, top: footerTop, left: 0 },
    ])
    .resize(540, Math.round(previewH / 2))
    .png()
    .toBuffer();
}

/** @deprecated use extractSmartYellowFooter */
export const extractSmartOrangeFooter = extractSmartYellowFooter;
