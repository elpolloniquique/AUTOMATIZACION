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
  skipBrandOverlay?: boolean;
}

export interface AiEditResult {
  url: string;
  source: AiEditSource;
  warning?: string;
}

/** Claves válidas de Google AI Studio empiezan con AIzaSy */
export function isValidGeminiKey(key: string): boolean {
  const k = key.trim();
  return k.startsWith('AIza') && k.length >= 30;
}

const GEMINI_IMAGE_MODELS = [
  'gemini-2.5-flash-image',
  'gemini-2.0-flash-preview-image-generation',
  'gemini-2.0-flash-exp-image-generation',
];

export async function editGalleryImageWithAi(options: AiEditOptions): Promise<AiEditResult> {
  const errors: string[] = [];

  if (config.gemini.apiKey) {
    if (!isValidGeminiKey(config.gemini.apiKey)) {
      errors.push(
        'GEMINI_API_KEY inválida: debe empezar con AIzaSy (cópiala desde aistudio.google.com/app/apikey)'
      );
    } else {
      try {
        const url = await tryGeminiEdit(options);
        return { url, source: 'gemini' };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Gemini: ${msg}`);
        console.warn('[Gallery AI] Gemini falló:', msg);
      }
    }
  }

  if (config.openai.apiKey?.startsWith('sk-')) {
    try {
      const url = await tryOpenAiEdit(options);
      return { url, source: 'openai' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`OpenAI: ${msg}`);
      console.warn('[Gallery AI] OpenAI falló:', msg);
    }
  }

  const buffer = await composeGalleryImage(options);
  const url = await uploadComposedImage(buffer);
  return {
    url,
    source: 'composer',
    warning: errors.length
      ? `IA no disponible (${errors.join(' | ')}). Se usó compositor básico.`
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
    hint = 'Tu GEMINI_API_KEY no es válida. Ve a aistudio.google.com/app/apikey y crea una que empiece con AIzaSy';
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

  let lastError = 'Sin respuesta de Gemini';

  for (const model of GEMINI_IMAGE_MODELS) {
    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          contents: [{
            role: 'user',
            parts: [
              { text: editPrompt },
              { inlineData: { mimeType: 'image/jpeg', data: base64 } },
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
          validateStatus: () => true,
        }
      );

      if (response.status !== 200) {
        const errBody = typeof response.data === 'object'
          ? JSON.stringify(response.data).slice(0, 400)
          : String(response.data).slice(0, 400);
        lastError = `${model} HTTP ${response.status}: ${errBody}`;
        continue;
      }

      const parts = response.data?.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find((p: { inlineData?: { data?: string } }) => p.inlineData?.data);
      const imageB64 = imagePart?.inlineData?.data;

      if (!imageB64) {
        const textPart = parts.find((p: { text?: string }) => p.text)?.text;
        lastError = textPart
          ? `${model}: ${textPart.slice(0, 200)}`
          : `${model}: sin imagen en respuesta`;
        continue;
      }

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
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[Gemini] ${model}:`, lastError);
    }
  }

  throw new Error(lastError);
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
