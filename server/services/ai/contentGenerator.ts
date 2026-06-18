import axios from 'axios';
import { config } from '../../config/index.js';
import { getSupabaseAdmin } from '../../utils/supabase.js';
import { POLLON_BRAND, appendPollonContact } from '../../constants/pollonBrand.js';

export type ContentType = 'facebook' | 'instagram' | 'tiktok' | 'google_business' | 'hashtags' | 'cta' | 'ab_variant';

export interface GenerateContentParams {
  branchId: string;
  postId?: string;
  type: ContentType;
  postType: string;
  branchName: string;
  city: string;
  productName?: string;
  price?: string;
  customPrompt?: string;
}

const POLLON_CONTEXT = `
Eres un experto en marketing digital para pollerías peruanas/chilenas en el norte de Chile.
Marca: El Pollón - Pollo a la brasa, comida peruana, delivery a domicilio, combos familiares.
Ciudades con delivery: ${POLLON_BRAND.deliveryCities}.
Horario: ${POLLON_BRAND.hours}.
WhatsApp: ${POLLON_BRAND.whatsappUrl}
Web para pedidos online: ${POLLON_BRAND.websiteUrl}
Tono: cercano, apetitoso, profesional, con emojis moderados, en español latinoamericano.
SIEMPRE incluye al final el bloque de contacto con WhatsApp, web, ciudades y horario.
`;

const PROMPTS: Record<ContentType, (p: GenerateContentParams) => string> = {
  facebook: (p) => `${POLLON_CONTEXT}
Escribe un post para Facebook de tipo "${p.postType}" para la sucursal ${p.branchName} en ${p.city}.
${p.productName ? `Producto: ${p.productName}` : ''}
${p.price ? `Precio: ${p.price}` : ''}
Incluye emojis, CTA y máximo 300 palabras.`,

  instagram: (p) => `${POLLON_CONTEXT}
Escribe un caption para Instagram de tipo "${p.postType}" para ${p.branchName}, ${p.city}.
Estilo visual y hashtags al final. Máximo 2200 caracteres.
${p.productName ? `Destaca: ${p.productName}` : ''}`,

  tiktok: (p) => `${POLLON_CONTEXT}
Genera ideas de video TikTok para "${p.postType}" en ${p.branchName}.
Incluye: hook (3 seg), guion de 20 seg, texto en pantalla y caption.`,

  google_business: (p) => `${POLLON_CONTEXT}
Escribe una novedad/oferta para Google Business Profile de ${p.branchName}, ${p.city}.
Tipo: ${p.postType}. Formal pero cercano. Máximo 1500 caracteres.`,

  hashtags: (p) => `${POLLON_CONTEXT}
Genera 15 hashtags relevantes para ${p.postType} de pollería en ${p.city}.
Incluye #ElPollon #PolloALaBrasa y hashtags locales.`,

  cta: (p) => `${POLLON_CONTEXT}
Genera 5 llamados a la acción creativos para ${p.postType} de ${p.branchName}.
Enfocados en pedir por WhatsApp o delivery.`,

  ab_variant: (p) => `${POLLON_CONTEXT}
Genera 2 variantes A/B de texto para redes sociales sobre ${p.postType} en ${p.branchName}.
Variante A: enfoque emocional. Variante B: enfoque en oferta/precio.`,
};

// Fallback templates cuando no hay OpenAI
const FALLBACK_TEMPLATES: Record<string, string[]> = {
  oferta: [
    '🔥 ¡OFERTA FAMILIAR en {branch}! Pollo a la brasa recién horneado para toda la familia. {price} ¡No te lo pierdas!',
    '🍗 Fin de semana = El Pollón. Combo familiar con el mejor pollo a la brasa de {city}. ¡El sabor que tu familia merece!',
  ],
  combo: [
    '💑 Combo para dos en {branch}: pollo jugoso + papas doradas + ensalada. El sabor que compartes con quien más quieres. {price}',
  ],
  delivery: [
    '🛵 Delivery rápido en {city}. Tu pollo a la brasa llega caliente a tu puerta. ¡Pide online o por WhatsApp!',
  ],
  promocion: [
    '🎉 ¡Promoción especial en {branch}! Solo por tiempo limitado. Pollo a la brasa con el sabor auténtico peruano que te encanta.',
  ],
  producto_destacado: [
    '⭐ Plato estrella: Pollo a la brasa El Pollón. Crujiente por fuera, jugoso por dentro. {price} en {branch}, {city}.',
  ],
  default: [
    '🍗 El Pollón {branch} te espera con el mejor pollo a la brasa de {city}. ¡Pide delivery o visita nuestra web!',
  ],
};

function applyFallback(params: GenerateContentParams): string {
  const templates = FALLBACK_TEMPLATES[params.postType] || FALLBACK_TEMPLATES.default;
  const template = templates[Math.floor(Math.random() * templates.length)];
  const body = template
    .replace(/{branch}/g, params.branchName)
    .replace(/{city}/g, params.city)
    .replace(/{price}/g, params.price || 'Consulta precios')
    .replace(/{product}/g, params.productName || 'pollo a la brasa');
  return appendPollonContact(body);
}

export async function generateContent(params: GenerateContentParams): Promise<{ result: string; source: 'openai' | 'template' }> {
  const prompt = params.customPrompt || PROMPTS[params.type](params);

  if (config.openai.apiKey) {
    try {
      const result = await callOpenAI(prompt);
      await saveGeneration(params, prompt, result);
      return { result: appendPollonContact(result), source: 'openai' };
    } catch (err) {
      console.warn('[AI] OpenAI falló, usando plantilla:', err);
    }
  }

  const result = applyFallback(params);
  await saveGeneration(params, prompt, result);
  return { result, source: 'template' };
}

async function callOpenAI(prompt: string): Promise<string> {
  const { data } = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres un copywriter experto en marketing gastronómico para redes sociales.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 800,
      temperature: 0.8,
    },
    {
      headers: {
        Authorization: `Bearer ${config.openai.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function saveGeneration(params: GenerateContentParams, prompt: string, result: string) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from('ai_generations').insert({
      branch_id: params.branchId,
      post_id: params.postId || null,
      prompt,
      result,
      type: params.type,
    });
  } catch (err) {
    console.warn('[AI] No se pudo guardar generación:', err);
  }
}
