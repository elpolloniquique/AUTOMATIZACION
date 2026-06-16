import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { getSupabaseAdmin } from '../../utils/supabase.js';
import { config } from '../../config/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '../../../templates/social-posts/html');

export interface RenderPostImageParams {
  templateSlug: string;
  branchName: string;
  offerTitle: string;
  price?: string;
  productImageUrl?: string;
  logoUrl?: string;
  cta?: string;
  brandColor?: string;
  postId?: string;
}

const TEMPLATE_VARS = ['branchName', 'offerTitle', 'price', 'productImageUrl', 'logoUrl', 'cta', 'brandColor'] as const;

export async function renderPostImage(params: RenderPostImageParams): Promise<string> {
  const html = await loadTemplate(params.templateSlug);
  const filledHtml = fillTemplate(html, {
    branchName: params.branchName,
    offerTitle: params.offerTitle,
    price: params.price || 'Consulta precios',
    productImageUrl: params.productImageUrl || '',
    logoUrl: params.logoUrl || '/templates/assets/logo-placeholder.svg',
    cta: params.cta || 'Pide ahora por WhatsApp',
    brandColor: params.brandColor || '#c50000',
  });

  const pngBuffer = await renderHtmlToPng(filledHtml);
  const optimized = await sharp(pngBuffer).png({ quality: 90 }).toBuffer();
  const publicUrl = await uploadToStorage(optimized, params.postId);

  return publicUrl;
}

async function loadTemplate(slug: string): Promise<string> {
  const templatePath = join(TEMPLATES_DIR, `${slug}.html`);
  try {
    return await readFile(templatePath, 'utf-8');
  } catch {
    return await readFile(join(TEMPLATES_DIR, 'oferta-familiar.html'), 'utf-8');
  }
}

function fillTemplate(html: string, vars: Record<string, string>): string {
  let result = html;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

async function renderHtmlToPng(html: string): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1080, height: 1080 });
    await page.setContent(html, { waitUntil: 'networkidle' });
    const screenshot = await page.screenshot({ type: 'png' });
    return Buffer.from(screenshot);
  } finally {
    await browser.close();
  }
}

async function uploadToStorage(buffer: Buffer, postId?: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const fileName = `generated/${postId || 'temp'}-${Date.now()}.png`;

  const { error } = await supabase.storage
    .from(config.supabase.storageBucket)
    .upload(fileName, buffer, {
      contentType: 'image/png',
      upsert: true,
    });

  if (error) {
    throw new Error(`Error subiendo imagen: ${error.message}`);
  }

  const { data } = supabase.storage.from(config.supabase.storageBucket).getPublicUrl(fileName);
  return data.publicUrl;
}

export const AVAILABLE_TEMPLATES = [
  { slug: 'oferta-familiar', name: 'Oferta Familiar', type: 'oferta' },
  { slug: 'combo-dos', name: 'Combo para Dos', type: 'combo' },
  { slug: 'delivery', name: 'Delivery', type: 'delivery' },
  { slug: 'producto-destacado', name: 'Producto Destacado', type: 'producto_destacado' },
  { slug: 'promo-fin-semana', name: 'Promoción Fin de Semana', type: 'promocion' },
];
