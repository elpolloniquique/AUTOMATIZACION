import axios from 'axios';
import sharp from 'sharp';
import { GoogleGenAI, Modality } from '@google/genai';
import { config } from '../../config/index.js';
import { composeGalleryImage, uploadComposedImage, addBrandOverlay } from './galleryImageComposer.js';

export type AiEditSource = 'gemini' | 'openai' | 'composer';

export interface AiEditOptions {
  photoUrl: string;
  prompt: string;
  title?: string;
  price?: string;
  brandColor?: string;
  skipBrandOverlay?: boolean;
}

export interface AiEditResult {
  url: string;
  source: AiEditSource;
  warning?: string;
}

/** Claves Google AI Studio: AIzaSy (clásica) o AQ. (auth key nueva, 2026) */
export function isValidGeminiKey(key: string): boolean {
  const k = key.trim();
  if (k.startsWith('AIza') && k.length >= 30) return true;
  if (k.startsWith('AQ.') && k.length >= 20) return true;
  return false;
}

/** Modelos con generación/edición de imagen (GA en Google AI Studio, 2026). */
const GEMINI_IMAGE_MODELS = [
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-image',
];

interface ParsedGeminiError {
  status?: number;
  message: string;
  nonRetryable: boolean;
}

function parseGeminiApiError(err: unknown): ParsedGeminiError {
  const fallback = err instanceof Error ? err.message : String(err);

  if (err && typeof err === 'object' && 'status' in err) {
    const status = Number((err as { status: number }).status);
    const message = formatGeminiErrorForUser(status, fallback);
    return {
      status,
      message,
      nonRetryable: status === 401 || status === 403 || status === 429,
    };
  }

  try {
    const parsed = JSON.parse(fallback) as { error?: { code?: number; message?: string } };
    const status = parsed.error?.code;
    const raw = parsed.error?.message ?? fallback;
    return {
      status,
      message: formatGeminiErrorForUser(status, raw),
      nonRetryable: status === 401 || status === 403 || status === 429,
    };
  } catch {
    return { message: fallback.slice(0, 200), nonRetryable: false };
  }
}

function formatGeminiErrorForUser(status: number | undefined, raw: string): string {
  if (status === 429) {
    return 'Cuota gratuita de Gemini agotada. Espera unas horas o revisa límites en aistudio.google.com → Usage';
  }
  if (status === 404) {
    return 'Modelo de imagen no disponible con tu clave. Verifica GEMINI_API_KEY en aistudio.google.com';
  }
  if (status === 403 || status === 401) {
    return 'Clave Gemini sin permiso. Genera una nueva en aistudio.google.com/app/apikey';
  }
  return raw.replace(/\s+/g, ' ').slice(0, 180);
}

export async function editGalleryImageWithAi(options: AiEditOptions): Promise<AiEditResult> {
  const errors: string[] = [];
  const geminiValid = Boolean(config.gemini.apiKey?.trim() && isValidGeminiKey(config.gemini.apiKey));

  if (config.gemini.apiKey) {
    if (!geminiValid) {
      errors.push(
        'GEMINI_API_KEY inválida: cópiala desde aistudio.google.com (formato AIzaSy... o AQ....)'
      );
    } else {
      try {
        const url = await tryGeminiEdit(options);
        return { url, source: 'gemini' };
      } catch (err) {
        const { message } = parseGeminiApiError(err);
        errors.push(message);
        console.warn('[Gallery AI] Gemini falló:', message);
      }
    }
  }

  // Si Gemini está configurado, no intentar OpenAI (evita errores de billing confusos)
  if (!geminiValid && config.openai.apiKey?.startsWith('sk-')) {
    try {
      const url = await tryOpenAiEdit(options);
      return { url, source: 'openai' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const short = msg.includes('billing') ? 'OpenAI sin crédito disponible' : msg.slice(0, 180);
      errors.push(short);
      console.warn('[Gallery AI] OpenAI falló:', msg);
    }
  }

  const buffer = await composeGalleryImage(options);
  const url = await uploadComposedImage(buffer);
  return {
    url,
    source: 'composer',
    warning: errors.length
      ? `${errors[0]}. Se usó compositor básico (sin IA).`
      : 'Sin API de IA configurada. Se usó compositor básico.',
  };
}

export function getActiveAiProvider(): AiEditSource | null {
  if (config.gemini.apiKey && isValidGeminiKey(config.gemini.apiKey)) return 'gemini';
  if (config.openai.apiKey?.startsWith('sk-')) return 'openai';
  if (config.gemini.apiKey) return null; // key presente pero inválida
  return null;
}

export function isAdvancedAiConfigured(): boolean {
  return getActiveAiProvider() !== null;
}

export function getAiConfigStatus(): {
  gemini_key_set: boolean;
  gemini_key_valid: boolean;
  openai_key_set: boolean;
  active_provider: AiEditSource | null;
  hint?: string;
} {
  const geminiSet = Boolean(config.gemini.apiKey?.trim());
  const geminiValid = geminiSet && isValidGeminiKey(config.gemini.apiKey);
  const openaiSet = Boolean(config.openai.apiKey?.startsWith('sk-'));

  let hint: string | undefined;
  if (geminiSet && !geminiValid) {
    hint = 'Tu GEMINI_API_KEY no es válida. Cópiala desde aistudio.google.com → Detalles de la clave → Copiar clave';
  } else if (!geminiValid && !openaiSet) {
    hint = 'Agrega GEMINI_API_KEY gratis en Vercel (aistudio.google.com/app/apikey)';
  }

  return {
    gemini_key_set: geminiSet,
    gemini_key_valid: geminiValid,
    openai_key_set: openaiSet,
    active_provider: getActiveAiProvider(),
    hint,
  };
}

/** @deprecated */
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

function buildGeminiEditPrompt(userPrompt: string): string {
  return `Eres un editor de imágenes profesional (como Gemini en chat). Edita la imagen según las instrucciones del usuario.

INSTRUCCIONES DEL USUARIO (síguelas al pie de la letra):
${userPrompt}

Reglas:
- Aplica exactamente lo que pide el usuario (cambiar fondo, poner en mesa, eliminar fondo, fondo blanco, mejorar luz, etc.).
- Mantén la comida lo más natural y apetitosa posible salvo que el usuario pida cambiarla.
- Resultado: fotografía realista lista para Instagram/Facebook de pollería.
- NO agregues texto, logos ni marcas de agua en la imagen.`;
}

async function tryGeminiEdit(options: AiEditOptions): Promise<string> {
  const { base64 } = await downloadAndPrepareImage(options.photoUrl);
  const editPrompt = buildGeminiEditPrompt(options.prompt);
  const apiKey = config.gemini.apiKey.trim();

  let lastError = 'Sin respuesta de Gemini';

  // SDK oficial — soporta claves AIza y AQ.
  const ai = new GoogleGenAI({ apiKey });

  for (const model of GEMINI_IMAGE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{
          role: 'user',
          parts: [
            { text: editPrompt },
            { inlineData: { mimeType: 'image/jpeg', data: base64 } },
          ],
        }],
        config: {
          responseModalities: [Modality.IMAGE],
          imageConfig: { aspectRatio: '1:1' },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      const imagePart = parts.find((p) => p.inlineData?.data);
      const imageB64 = imagePart?.inlineData?.data;

      if (!imageB64) {
        const textPart = parts.find((p) => p.text)?.text;
        lastError = textPart
          ? textPart.slice(0, 250)
          : 'Gemini no devolvió imagen. Intenta un prompt más corto.';
        continue;
      }

      return await finalizeGeminiImage(imageB64, options);
    } catch (err) {
      const parsed = parseGeminiApiError(err);
      lastError = parsed.message;
      console.warn(`[Gemini SDK] ${model}:`, lastError);
      if (parsed.nonRetryable) throw new Error(parsed.message);
    }
  }

  throw new Error(lastError);
}

async function finalizeGeminiImage(imageB64: string, options: AiEditOptions): Promise<string> {
  let result = await sharp(Buffer.from(imageB64, 'base64'))
    .resize(1080, 1080, { fit: 'cover' })
    .png()
    .toBuffer();

  if (!options.skipBrandOverlay) {
    result = await addBrandOverlay(result, {
      title: options.title,
      price: options.price,
      brandColor: options.brandColor,
    });
  }

  return uploadComposedImage(result);
}

async function tryOpenAiEdit(options: AiEditOptions): Promise<string> {
  const { buffer: imageBuffer } = await downloadAndPrepareImage(options.photoUrl);
  const pngBuffer = await sharp(imageBuffer).png().toBuffer();

  const fullPrompt = `Editor de imágenes profesional. Aplica exactamente: ${options.prompt}
Mantén la comida natural. Sin texto ni logos.`;

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

  if (!options.skipBrandOverlay) {
    result = await addBrandOverlay(result, {
      title: options.title,
      price: options.price,
      brandColor: options.brandColor,
    });
  }

  return uploadComposedImage(result);
}
