import axios from 'axios';
import sharp from 'sharp';
import { config } from '../../config/index.js';

interface SceneStyle {
  top: string;
  bottom: string;
  accent: string;
  label: string;
}

function detectScene(prompt: string): SceneStyle {
  const p = prompt.toLowerCase();

  if (/mesa|tabla|restaurante|comedor|madera/.test(p)) {
    return {
      top: '#3d2817',
      bottom: '#1a0f08',
      accent: '#8b5a2b',
      label: 'mesa de restaurante',
    };
  }
  if (/delivery|domicilio|envio|envío|puerta|casa/.test(p)) {
    return {
      top: '#0d4d3d',
      bottom: '#062a22',
      accent: '#25d366',
      label: 'delivery a domicilio',
    };
  }
  if (/familia|familiar|hogar|reunion/.test(p)) {
    return {
      top: '#6b0f0f',
      bottom: '#2a0505',
      accent: '#f5a623',
      label: 'ambiente familiar',
    };
  }
  if (/promo|oferta|fiesta|celebr/.test(p)) {
    return {
      top: '#8b0000',
      bottom: '#1a1a1a',
      accent: '#ffcc00',
      label: 'promoción especial',
    };
  }
  return {
    top: '#2a2a2a',
    bottom: '#0d0d0d',
    accent: '#c50000',
    label: 'presentación premium',
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

function buildSceneSvg(width: number, height: number, scene: SceneStyle): Buffer {
  const tableY = height * 0.72;
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:${scene.top}"/>
          <stop offset="100%" style="stop-color:${scene.bottom}"/>
        </linearGradient>
        <radialGradient id="spot" cx="50%" cy="40%" r="60%">
          <stop offset="0%" style="stop-color:${scene.accent};stop-opacity:0.25"/>
          <stop offset="100%" style="stop-color:${scene.bottom};stop-opacity:0"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <rect width="100%" height="100%" fill="url(#spot)"/>
      <ellipse cx="${width / 2}" cy="${tableY}" rx="${width * 0.42}" ry="${height * 0.08}" fill="#000" opacity="0.35"/>
      <rect x="0" y="${tableY - 20}" width="${width}" height="${height - tableY + 40}" fill="${scene.accent}" opacity="0.15"/>
      <rect x="0" y="${height - 8}" width="${width}" height="8" fill="${scene.accent}" opacity="0.6"/>
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

export async function composeGalleryImage(options: ComposeOptions): Promise<Buffer> {
  const size = 1080;
  const scene = detectScene(options.prompt);
  const photo = await downloadImage(options.photoUrl);

  const food = await sharp(photo)
    .resize(780, 580, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();

  const foodMeta = await sharp(food).metadata();
  const foodW = foodMeta.width || 780;
  const foodH = foodMeta.height || 580;

  const shadowSvg = Buffer.from(`
    <svg width="${foodW + 40}" height="${foodH + 40}">
      <ellipse cx="${(foodW + 40) / 2}" cy="${foodH + 25}" rx="${foodW * 0.45}" ry="28" fill="black" opacity="0.4"/>
    </svg>
  `);

  const foodWithShadow = await sharp(shadowSvg)
    .composite([{ input: food, top: 10, left: 20 }])
    .png()
    .toBuffer();

  const sceneBg = buildSceneSvg(size, size, scene);
  const topOffset = Math.round(size * 0.22);
  const leftOffset = Math.round((size - foodW - 40) / 2);

  const brandColor = options.brandColor || '#c50000';
  const title = (options.title || '').slice(0, 60);
  const price = options.price || '';

  const overlaySvg = Buffer.from(`
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${size}" height="120" fill="${brandColor}" opacity="0.92"/>
      <text x="40" y="52" fill="#fff" font-family="Arial,sans-serif" font-size="28" font-weight="800">EL POLLÓN</text>
      <text x="40" y="88" fill="#ffcc00" font-family="Arial,sans-serif" font-size="22" font-weight="700">${scene.label.toUpperCase()}</text>
      ${title ? `<text x="40" y="${size - 130}" fill="#fff" font-family="Arial,sans-serif" font-size="36" font-weight="900">${escapeXml(title)}</text>` : ''}
      ${price ? `<text x="40" y="${size - 80}" fill="#ffcc00" font-family="Arial,sans-serif" font-size="48" font-weight="900">${escapeXml(price)}</text>` : ''}
      <rect x="40" y="${size - 55}" width="420" height="36" rx="18" fill="#25d366"/>
      <text x="60" y="${size - 30}" fill="#fff" font-family="Arial,sans-serif" font-size="18" font-weight="800">📱 WhatsApp · www.el-pollon.cl</text>
    </svg>
  `);

  return sharp(sceneBg)
    .composite([
      { input: foodWithShadow, top: topOffset, left: leftOffset },
      { input: overlaySvg, top: 0, left: 0 },
    ])
    .png({ quality: 92 })
    .toBuffer();
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
