import { access, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium as playwrightChromium } from 'playwright-core';
import sharp from 'sharp';
import { getSupabaseAdmin } from '../../utils/supabase.js';
import { config } from '../../config/index.js';
import { pollonImageTemplateVars } from '../../constants/pollonBrand.js';

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

  // Fotos de galería: Sharp (estable en Vercel, sin Chromium)
  if (params.productImageUrl?.trim()) {
    const { composeMultiGalleryCollage, uploadComposedImage } = await import('../gallery/galleryImageComposer.js');
    const buffer = await composeMultiGalleryCollage({
      photoUrls: [params.productImageUrl],
      title: params.offerTitle,
      price: params.price,
      brandColor: params.brandColor,
    });
    return uploadComposedImage(buffer, params.postId);
  }

  try {
    const html = await loadTemplate(params.templateSlug);
    const filledHtml = fillTemplate(html, {
      branchName: params.branchName,
      offerTitle: params.offerTitle,
      price: params.price || 'Consulta precios',
      productImageUrl: '',
      logoUrl: params.logoUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect fill="%23c50000" width="80" height="80"/><text x="40" y="50" text-anchor="middle" fill="white" font-size="24">EP</text></svg>',
      cta: params.cta || '📱 Haz tu pedido por WhatsApp',
      brandColor: params.brandColor || '#c50000',
      ...pollonImageTemplateVars(),
    });

    const pngBuffer = await renderHtmlToPng(filledHtml);
    const optimized = await sharp(pngBuffer).png({ quality: 90 }).toBuffer();
    return uploadToStorage(optimized, params.postId);
  } catch (err) {
    console.warn('[renderPostImage] Playwright falló, usando plantilla Sharp:', err);
    const fallback = await renderSharpTemplate(params);
    return uploadToStorage(fallback, params.postId);
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Plantilla gráfica sin navegador — fallback cuando Playwright no está disponible */
async function renderSharpTemplate(params: RenderPostImageParams): Promise<Buffer> {
  const size = 1080;
  const brand = params.brandColor || '#c50000';
  const title = escapeXml(params.offerTitle.slice(0, 50));
  const price = escapeXml(params.price || '');
  const branch = escapeXml(params.branchName.slice(0, 40));

  const svg = Buffer.from(`
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0d0d0d"/>
          <stop offset="60%" stop-color="#1a0000"/>
          <stop offset="100%" stop-color="${brand}"/>
        </linearGradient>
        <linearGradient id="bar" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${brand}"/>
          <stop offset="100%" stop-color="#8b0000"/>
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#bg)"/>
      <rect width="${size}" height="100" fill="url(#bar)"/>
      <text x="36" y="42" fill="#fff" font-family="Arial,sans-serif" font-size="28" font-weight="800">EL POLLÓN</text>
      <text x="36" y="72" fill="#ffcc00" font-family="Arial,sans-serif" font-size="16" font-weight="700">${branch}</text>
      <text x="540" y="420" text-anchor="middle" fill="#f5a623" font-family="Arial,sans-serif" font-size="28" font-weight="900" letter-spacing="4">OFERTA</text>
      <text x="540" y="520" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="52" font-weight="900">${title}</text>
      ${price ? `<text x="540" y="620" text-anchor="middle" fill="#ffcc00" font-family="Arial,sans-serif" font-size="72" font-weight="900">${price}</text>` : ''}
      <rect x="240" y="880" width="600" height="50" rx="25" fill="#25d366"/>
      <text x="540" y="913" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="20" font-weight="800">WhatsApp +56 9 8692 5310 · el-pollon.cl</text>
    </svg>
  `);

  return sharp(svg).png().toBuffer();
}

async function loadTemplate(slug: string): Promise<string> {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('post_templates')
      .select('html_content')
      .eq('html_template', slug)
      .eq('is_active', true)
      .not('html_content', 'is', null)
      .limit(1)
      .maybeSingle();

    if (data?.html_content?.trim()) {
      return data.html_content;
    }
  } catch {
    // fallback a archivos HTML
  }

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

export async function listHtmlTemplateSlugs(): Promise<string[]> {
  try {
    const templatesDir = await getTemplatesDir();
    const { readdir } = await import('fs/promises');
    const files = await readdir(templatesDir);
    return files.filter((f) => f.endsWith('.html')).map((f) => f.replace('.html', ''));
  } catch {
    return AVAILABLE_TEMPLATES.map((t) => t.slug);
  }
}
