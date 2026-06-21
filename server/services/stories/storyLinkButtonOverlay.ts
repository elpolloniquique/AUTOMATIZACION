import sharp from 'sharp';
import { fitTextToWidth, measureTextWidth, textToSvgPath } from '../gallery/frameTextRenderer.js';

const STORY_W = 1080;
const STORY_H = 1920;

export const STORY_LINK_BUTTON_LABELS = [
  'Comprar',
  'Más información',
  'Reservar',
  'Registrarse',
  'Contactar',
  'Ver menú',
  'Pedir ahora',
  'Ordenar',
] as const;

export interface StoryLinkButtonConfig {
  enabled: boolean;
  text: string;
  url: string;
}

export function normalizeStoryLinkUrl(raw?: string | null): string {
  const fallback = 'https://www.el-pollon.cl/';
  if (!raw?.trim()) return fallback;
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url.replace(/^\/\//, '')}`;
  try {
    const parsed = new URL(url);
    return parsed.href;
  } catch {
    return fallback;
  }
}

export function resolveBranchWebsiteUrl(branchWebsite?: string | null): string {
  return normalizeStoryLinkUrl(branchWebsite || undefined);
}

async function rasterizeSvg(body: string, width: number, height: number): Promise<Buffer> {
  return sharp(Buffer.from(body)).png().toBuffer();
}

/** Superpone botón píldora blanco estilo Facebook Stories (parte inferior central) */
export async function applyStoryLinkButtonOverlay(
  imageBuffer: Buffer,
  buttonText: string,
): Promise<Buffer> {
  const label = (buttonText || 'Comprar').trim().slice(0, 30) || 'Comprar';
  const fontFamily = 'Roboto-Bold' as const;
  const fontSize = 42;
  const pillH = 88;
  const minPillW = 280;
  const maxPillW = 720;
  const horizontalPad = 56;

  const fit = await fitTextToWidth(label, maxPillW - horizontalPad, fontSize, fontFamily);
  const textWidth = await measureTextWidth(fit.text, fit.fontSize, fontFamily);
  const pillW = Math.min(maxPillW, Math.max(minPillW, Math.round(textWidth + horizontalPad)));
  const pillX = Math.round((STORY_W - pillW) / 2);
  const pillY = STORY_H - 200;

  const textPath = await textToSvgPath(fit.text, {
    x: STORY_W / 2,
    y: pillY + Math.round(pillH * 0.68),
    fontSize: fit.fontSize,
    anchor: 'middle',
    fontFamily,
  });

  const overlaySvg = `<svg width="${STORY_W}" height="${STORY_H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="btnShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="#000000" flood-opacity="0.18"/>
      </filter>
    </defs>
    <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillH / 2}"
      fill="#FFFFFF" filter="url(#btnShadow)"/>
    <path d="${textPath}" fill="#050505"/>
  </svg>`;

  const overlay = await rasterizeSvg(overlaySvg, STORY_W, STORY_H);

  return sharp(imageBuffer)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toBuffer();
}
