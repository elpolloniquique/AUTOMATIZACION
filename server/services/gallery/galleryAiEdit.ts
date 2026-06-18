import axios from 'axios';
import sharp from 'sharp';
import { config } from '../../config/index.js';
import { composeGalleryImage, uploadComposedImage } from './galleryImageComposer.js';

export interface AiEditOptions {
  photoUrl: string;
  prompt: string;
  title?: string;
  price?: string;
  brandColor?: string;
}

export async function editGalleryImageWithAi(options: AiEditOptions): Promise<{ url: string; source: 'openai' | 'composer' }> {
  if (config.openai.apiKey) {
    try {
      const url = await tryOpenAiEdit(options);
      return { url, source: 'openai' };
    } catch (err) {
      console.warn('[Gallery AI] OpenAI falló, usando compositor inteligente:', err);
    }
  }

  const buffer = await composeGalleryImage(options);
  const url = await uploadComposedImage(buffer);
  return { url, source: 'composer' };
}

async function tryOpenAiEdit(options: AiEditOptions): Promise<string> {
  const photoRes = await axios.get(options.photoUrl, { responseType: 'arraybuffer', timeout: 30000 });
  const imageBuffer = await sharp(Buffer.from(photoRes.data))
    .resize(1024, 1024, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toBuffer();

  const fullPrompt = `Imagen publicitaria profesional para pollería El Pollón.
MANTÉN el plato EXACTAMENTE igual (mismo pollo, papas, colores). Solo cambia el fondo/entorno.
Pedido: ${options.prompt}
Estilo fotográfico realista para Instagram.`;

  const form = new FormData();
  form.append('model', 'gpt-image-1');
  form.append('prompt', fullPrompt);
  form.append('size', '1024x1024');
  form.append('image', new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' }), 'dish.png');

  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.openai.apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI: ${errText.slice(0, 200)}`);
  }

  const data = await response.json() as { data?: { b64_json?: string }[] };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI no devolvió imagen');

  return uploadComposedImage(Buffer.from(b64, 'base64'));
}
