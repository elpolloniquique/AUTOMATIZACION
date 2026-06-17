import { access, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium as playwrightChromium } from 'playwright-core';
import sharp from 'sharp';
import { getSupabaseAdmin } from '../../utils/supabase.js';
import { config } from '../../config/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function getTemplatesDir(): Promise<string> {
  const candidates = [
    join(__dirname, '../../../templates/social-posts/html'),
    join(process.cwd(), 'templates/social-posts/html'),
    join('/var/task', 'templates/social-posts/html'),
  ];
  for (const dir of candidates) {
    try {
      await access(join(dir, 'oferta-familiar.html'));
      return dir;
    } catch {
      continue;
    }
  }
  throw new Error('Plantillas HTML no encontradas. Verifica templates/social-posts/html');
}

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

export async function renderPostImage(params: RenderPostImageParams): Promise<string> {
  if (!params.offerTitle?.trim()) {
    throw new Error('Escribe un título antes de generar la imagen');
  }

  const html = await loadTemplate(params.templateSlug);
  const filledHtml = fillTemplate(html, {
    branchName: params.branchName,
    offerTitle: params.offerTitle,
    price: params.price || 'Consulta precios',
    productImageUrl: params.productImageUrl || '',
    logoUrl: params.logoUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect fill="%23c50000" width="80" height="80"/><text x="40" y="50" text-anchor="middle" fill="white" font-size="24">EP</text></svg>',
    cta: params.cta || 'Pide ahora por WhatsApp',
    brandColor: params.brandColor || '#c50000',
  });

  const pngBuffer = await renderHtmlToPng(filledHtml);
  const optimized = await sharp(pngBuffer).png({ quality: 90 }).toBuffer();
  const publicUrl = await uploadToStorage(optimized, params.postId);

  return publicUrl;
}

async function loadTemplate(slug: string): Promise<string> {
  const templatesDir = await getTemplatesDir();
  const templatePath = join(templatesDir, `${slug}.html`);
  try {
    return await readFile(templatePath, 'utf-8');
  } catch {
    try {
      return await readFile(join(templatesDir, 'oferta-familiar.html'), 'utf-8');
    } catch {
      throw new Error(
        'No se encontraron plantillas HTML. En local ejecuta desde la carpeta AUTOMATIZACION. En Vercel, haz redeploy.'
      );
    }
  }
}

function fillTemplate(html: string, vars: Record<string, string>): string {
  let result = html;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    // Eliminar bloques condicionales {{#key}}...{{/key}} si hay valor, o quitar bloque si vacío
    const blockRegex = new RegExp(`\\{\\{#${key}\\}\\}[\\s\\S]*?\\{\\{/${key}\\}\\}`, 'g');
    if (value) {
      result = result.replace(blockRegex, (match) =>
        match.replace(`{{#${key}}}`, '').replace(`{{/${key}}}`, '')
      );
    } else {
      result = result.replace(blockRegex, '');
    }
  }
  return result;
}

async function launchBrowser() {
  const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL_ENV;

  if (isVercel) {
    const chromiumPack = (await import('@sparticuz/chromium')).default;
    chromiumPack.setGraphicsMode = false;

    const executablePath = await chromiumPack.executablePath();
    process.env.LD_LIBRARY_PATH = dirname(executablePath);

    return playwrightChromium.launch({
      args: [...chromiumPack.args, '--no-sandbox', '--disable-setuid-sandbox'],
      executablePath,
      headless: true,
    });
  }

  // Local: usar playwright completo si está instalado
  try {
    const { chromium } = await import('playwright');
    return chromium.launch({ headless: true });
  } catch {
    return playwrightChromium.launch({ headless: true });
  }
}

async function renderHtmlToPng(html: string): Promise<Buffer> {
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1080, height: 1080 });
    await page.setContent(html, { waitUntil: 'load', timeout: 15000 });
    const screenshot = await page.screenshot({ type: 'png' });
    return Buffer.from(screenshot);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL_ENV;
    if (
      !isVercel &&
      (msg.includes('Executable doesn') || msg.includes('browserType.launch'))
    ) {
      throw new Error(
        'Playwright no instalado. En tu PC ejecuta: npx playwright install chromium'
      );
    }
    throw new Error(`Error renderizando imagen: ${msg}`);
  } finally {
    await browser?.close().catch(() => {});
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
    if (error.message.includes('Bucket not found')) {
      throw new Error('Bucket "social-posts" no existe en Supabase Storage. Créalo como público.');
    }
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
