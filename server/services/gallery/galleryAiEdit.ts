import axios from 'axios';
import sharp from 'sharp';
import { config } from '../../config/index.js';
import { composeGalleryImage, uploadComposedImage, addBrandOverlay } from './galleryImageComposer.js';

export type AiEditSource = 'gemini' | 'openai' | 'composer';

export interface AiEditOptions {
  photoUrl: string;
  prompt: string;
  title?: string;
  price?: string;
  brandColor?: string;
}

export interface AiEditResult {
  url: string;
  source: AiEditSource;
}

const GEMINI_MODELS = [
  'gemini-2.0-flash-preview-image-generation',
  'gemini-2.5-flash-image',
  'gemini-2.0-flash-exp-image-generation',
];

export async function editGalleryImageWithAi(options: AiEditOptions): Promise<AiEditResult> {
  if (config.gemini.apiKey) {
    try {
      const url = await tryGeminiEdit(options);
      return { url, source: 'gemini' };
    } catch (err) {
      console.warn('[Gallery AI] Gemini falló:', err instanceof Error ? err.message : err);
    }
  }

  if (config.openai.apiKey) {
    try {
      const url = await tryOpenAiEdit(options);
      return { url, source: 'openai' };
    } catch (err) {
      console.warn('[Gallery AI] OpenAI falló:', err instanceof Error ? err.message : err);
    }
  }

  const buffer = await composeGalleryImage(options);
  const url = await uploadComposedImage(buffer);
  return { url, source: 'composer' };
}

export function getActiveAiProvider(): AiEditSource | null {
  if (config.gemini.apiKey) return 'gemini';
  if (config.openai.apiKey) return 'openai';
  return null;
}

export function isAdvancedAiConfigured(): boolean {
  return Boolean(config.gemini.apiKey || config.openai.apiKey);
}

/** @deprecated use isAdvancedAiConfigured */
export function isOpenAiConfigured(): boolean {
  return isAdvancedAiConfigured();
}

async function downloadAndPrepareImage(url: string): Promise<{ base64: string; buffer: Buffer }> {
  const photoRes = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 45000,
    maxContentLength: 15 * 1024 * 1024,
  });

  const buffer = await sharp(Buffer.from(photoRes.data))
    .resize(1024, 1024, { fit: 'inside', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .jpeg({ quality: 92 })
    .toBuffer();

  return { base64: buffer.toString('base64'), buffer };
}

async function tryGeminiEdit(options: AiEditOptions): Promise<string> {
  const { base64 } = await downloadAndPrepareImage(options.photoUrl);

  const editPrompt = `Eres un fotógrafo gastronómico profesional para la pollería "El Pollón".
Edita esta foto de comida para redes sociales (Instagram/Facebook).

REGLA CRÍTICA: Mantén el plato IDÉNTICO — mismo pollo a la brasa, papas, ensalada, salsas, colores y texturas. No cambies la comida.
Solo modifica el ENTORNO, iluminación y fondo según: ${options.prompt}

Estilo: fotografía realista de restaurante, iluminación cálida, alta calidad comercial.
NO agregues texto, logos ni marcas de agua.`;

  let lastError = 'Sin respuesta de Gemini';

  for (const model of GEMINI_MODELS) {
    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          contents: [{
            parts: [
              { text: editPrompt },
              { inline_data: { mime_type: 'image/jpeg', data: base64 } },
            ],
          }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': config.gemini.apiKey,
          },
          timeout: 120000,
        }
      );

      const parts = response.data?.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find((p: { inlineData?: { data?: string }; inline_data?: { data?: string } }) =>
        p.inlineData?.data || p.inline_data?.data
      );

      const imageB64 = imagePart?.inlineData?.data || imagePart?.inline_data?.data;
      if (!imageB64) {
        lastError = `Modelo ${model}: sin imagen en respuesta`;
        continue;
      }

      let result = await sharp(Buffer.from(imageB64, 'base64'))
        .resize(1080, 1080, { fit: 'cover' })
        .png()
        .toBuffer();

      result = await addBrandOverlay(result, {
        title: options.title,
        price: options.price,
        brandColor: options.brandColor,
      });

      return uploadComposedImage(result);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[Gemini] Modelo ${model} falló:`, lastError);
    }
  }

  throw new Error(lastError);
}

async function tryOpenAiEdit(options: AiEditOptions): Promise<string> {
  const { buffer: imageBuffer } = await downloadAndPrepareImage(options.photoUrl);

  const pngBuffer = await sharp(imageBuffer).png().toBuffer();

  const fullPrompt = `Imagen publicitaria profesional para pollería "El Pollón".
MANTÉN el plato EXACTAMENTE igual. Solo cambia el entorno: ${options.prompt}
Estilo fotográfico realista, sin texto ni logos.`;

  const form = new FormData();
  form.append('model', 'gpt-image-1');
  form.append('prompt', fullPrompt);
  form.append('size', '1024x1024');
  form.append('quality', 'high');
  form.append('input_fidelity', 'high');
  form.append('output_format', 'png');
  form.append('image', new Blob([new Uint8Array(pngBuffer)], { type: 'image/png' }), 'plato.png');

  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.openai.apiKey}` },
    body: form,
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI (${response.status}): ${errText.slice(0, 300)}`);
  }

  const data = await response.json() as { data?: { b64_json?: string }[] };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI no devolvió imagen');

  let result = await sharp(Buffer.from(b64, 'base64'))
    .resize(1080, 1080, { fit: 'cover' })
    .png()
    .toBuffer();

  result = await addBrandOverlay(result, {
    title: options.title,
    price: options.price,
    brandColor: options.brandColor,
  });

  return uploadComposedImage(result);
}
