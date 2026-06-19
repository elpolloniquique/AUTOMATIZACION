import axios from 'axios';
import sharp from 'sharp';
import { config } from '../../config/index.js';
import { composePollonGalleryFrame } from './pollonGalleryFrame.js';
import { resolveFrameConfig } from './frameConfigService.js';

interface SceneStyle {
  wallTop: string;
  wallBottom: string;
  table: string;
  tableEdge: string;
  light: string;
  label: string;
}

function detectScene(prompt: string): SceneStyle {
  const p = prompt.toLowerCase();

  if (/mesa|tabla|restaurante|comedor|madera/.test(p)) {
    return {
      wallTop: '#2a1810',
      wallBottom: '#1a0f08',
      table: '#6b4423',
      tableEdge: '#4a2f18',
      light: '#ffcc88',
      label: 'RESTAURANTE EL POLLÓN',
    };
  }
  if (/delivery|domicilio|envio|envío|puerta|casa/.test(p)) {
    return {
      wallTop: '#0a3d32',
      wallBottom: '#051f1a',
      table: '#1a5c4a',
      tableEdge: '#0d3d32',
      light: '#7dffb3',
      label: 'DELIVERY A DOMICILIO',
    };
  }
  if (/familia|familiar|hogar|reunion/.test(p)) {
    return {
      wallTop: '#4a1010',
      wallBottom: '#1a0505',
      table: '#8b4513',
      tableEdge: '#5c2e0a',
      light: '#ffcc00',
      label: 'OFERTA FAMILIAR',
    };
  }
  return {
    wallTop: '#1a1a1a',
    wallBottom: '#0a0a0a',
    table: '#3d2817',
    tableEdge: '#2a1a0f',
    light: '#f5a623',
    label: 'EL POLLÓN',
  };
}

async function downloadImage(url: string): Promise<Buffer> {
  const { data } = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    maxContentLength: 15 * 1024 * 1024,
  });
  return Buffer.from(data);
}

async function prepareFoodImage(photo: Buffer): Promise<{ buffer: Buffer; width: number; height: number }> {
  let processed = sharp(photo).rotate();

  try {
    processed = sharp(await processed.trim({ threshold: 18 }).toBuffer());
  } catch {
    // trim puede fallar si no hay bordes uniformes
  }

  const buffer = await processed
    .resize(820, 620, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();

  const meta = await sharp(buffer).metadata();
  return { buffer, width: meta.width || 820, height: meta.height || 620 };
}

function buildSceneSvg(width: number, height: number, scene: SceneStyle): Buffer {
  const tableY = height * 0.58;
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="wall" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${scene.wallTop}"/>
          <stop offset="100%" stop-color="${scene.wallBottom}"/>
        </linearGradient>
        <linearGradient id="table" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${scene.table}"/>
          <stop offset="100%" stop-color="${scene.tableEdge}"/>
        </linearGradient>
        <radialGradient id="light" cx="50%" cy="25%" r="55%">
          <stop offset="0%" stop-color="${scene.light}" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="${scene.wallBottom}" stop-opacity="0"/>
        </radialGradient>
        <filter id="blur"><feGaussianBlur stdDeviation="2"/></filter>
      </defs>
      <rect width="100%" height="100%" fill="url(#wall)"/>
      <rect width="100%" height="100%" fill="url(#light)"/>
      <rect x="0" y="${tableY}" width="${width}" height="${height - tableY}" fill="url(#table)"/>
      <rect x="0" y="${tableY}" width="${width}" height="6" fill="${scene.table}" opacity="0.6"/>
      <ellipse cx="${width / 2}" cy="${tableY + 8}" rx="${width * 0.38}" ry="18" fill="#000" opacity="0.25" filter="url(#blur)"/>
    </svg>
  `;
  return Buffer.from(svg);
}

export interface ComposeOptions {
  photoUrl: string;
  prompt: string;
  title?: string;
  price?: string;
  brandColor?: string;
}

export interface BrandOverlayOptions {
  title?: string;
  price?: string;
  brandColor?: string;
  sceneLabel?: string;
}

export interface MultiCollageOptions {
  photoUrls: string[];
  title?: string;
  price?: string;
  brandColor?: string;
  logoUrl?: string;
  branchId?: string;
  frameTemplateId?: string | null;
}

export async function addBrandOverlay(imageBuffer: Buffer, options: BrandOverlayOptions): Promise<Buffer> {
  const meta = await sharp(imageBuffer).metadata();
  const size = meta.width || 1080;
  const brandColor = options.brandColor || '#c50000';
  const title = escapeXml((options.title || '').slice(0, 55));
  const price = escapeXml(options.price || '');
  const label = escapeXml(options.sceneLabel || 'EL POLLÓN');

  const overlaySvg = Buffer.from(`
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bar" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${brandColor}"/>
          <stop offset="100%" stop-color="#8b0000"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${size}" height="100" fill="url(#bar)" opacity="0.95"/>
      <text x="36" y="42" fill="#fff" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="800">EL POLLÓN</text>
      <text x="36" y="72" fill="#ffcc00" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="700">${label}</text>
      ${title ? `<text x="36" y="${size - 120}" fill="#fff" font-family="Arial,Helvetica,sans-serif" font-size="34" font-weight="900">${title}</text>` : ''}
      ${price ? `<text x="36" y="${size - 70}" fill="#ffcc00" font-family="Arial,Helvetica,sans-serif" font-size="44" font-weight="900">${price}</text>` : ''}
      <rect x="36" y="${size - 52}" width="400" height="34" rx="17" fill="#25d366"/>
      <text x="52" y="${size - 28}" fill="#fff" font-family="Arial,Helvetica,sans-serif" font-size="16" font-weight="800">WhatsApp +56 9 8692 5310 · el-pollon.cl</text>
    </svg>
  `);

  return sharp(imageBuffer)
    .composite([{ input: overlaySvg, top: 0, left: 0 }])
    .png({ quality: 92 })
    .toBuffer();
}

export async function composeGalleryImage(options: ComposeOptions): Promise<Buffer> {
  const size = 1080;
  const scene = detectScene(options.prompt);
  const photo = await downloadImage(options.photoUrl);
  const { buffer: food, width: foodW, height: foodH } = await prepareFoodImage(photo);

  const shadowW = foodW + 60;
  const shadowH = foodH + 50;
  const shadowSvg = Buffer.from(`
    <svg width="${shadowW}" height="${shadowH}">
      <ellipse cx="${shadowW / 2}" cy="${shadowH - 15}" rx="${foodW * 0.42}" ry="22" fill="black" opacity="0.45"/>
    </svg>
  `);

  const foodWithShadow = await sharp({
    create: { width: shadowW, height: shadowH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: shadowSvg, top: 0, left: 0 },
      { input: food, top: 0, left: 30 },
    ])
    .png()
    .toBuffer();

  const sceneBg = buildSceneSvg(size, size, scene);
  const tableY = Math.round(size * 0.58);
  const topOffset = tableY - foodH - 10;
  const leftOffset = Math.round((size - shadowW) / 2);

  const base = await sharp(sceneBg)
    .composite([
      { input: foodWithShadow, top: Math.max(120, topOffset), left: Math.max(0, leftOffset) },
    ])
    .png()
    .toBuffer();

  return addBrandOverlay(base, {
    title: options.title,
    price: options.price,
    brandColor: options.brandColor,
    sceneLabel: scene.label,
  });
}

/** Plantilla El Pollón inteligente — 1 a 4 fotos con header, logo y footer adaptativo */
export async function composeMultiGalleryCollage(options: MultiCollageOptions): Promise<Buffer> {
  const urls = options.photoUrls.slice(0, 4);
  if (urls.length === 0) throw new Error('Se requiere al menos una foto');

  const photoBuffers = await Promise.all(urls.map((url) => downloadImage(url)));
  const frameConfig = await resolveFrameConfig(options.branchId, options.frameTemplateId);

  return composePollonGalleryFrame({
    photoBuffers,
    brandColor: options.brandColor,
    logoUrl: options.logoUrl,
    frameConfig,
  });
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function uploadComposedImage(buffer: Buffer, postId?: string): Promise<string> {
  const { getSupabaseAdmin } = await import('../../utils/supabase.js');
  const supabase = getSupabaseAdmin();
  const fileName = `generated/gallery-${postId || 'temp'}-${Date.now()}.png`;

  const { error } = await supabase.storage
    .from(config.supabase.storageBucket)
    .upload(fileName, buffer, { contentType: 'image/png', upsert: true });

  if (error) throw new Error(`Error subiendo imagen: ${error.message}`);

  const { data } = supabase.storage.from(config.supabase.storageBucket).getPublicUrl(fileName);
  return data.publicUrl;
}
