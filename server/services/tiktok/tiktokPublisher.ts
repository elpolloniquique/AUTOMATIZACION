import axios from 'axios';
import { config } from '../../config/index.js';
import { createPostLog, sanitizeForLog } from '../../utils/logger.js';
import type { PublishResult } from '../meta/facebookPublisher.js';

const TIKTOK_AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize';
const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';

export interface TikTokPublishParams {
  postId: string;
  accountId: string;
  accessToken: string;
  caption: string;
  videoUrl?: string;
}

export function getTikTokOAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_key: config.tiktok.clientKey,
    scope: 'video.publish,video.upload,user.info.basic',
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
  });
  return `${TIKTOK_AUTH_URL}?${params.toString()}`;
}

export async function exchangeTikTokCode(code: string, redirectUri: string) {
  if (!config.tiktok.clientKey || !config.tiktok.clientSecret) {
    throw new Error('TikTok API no configurada. Agrega TIKTOK_CLIENT_KEY y TIKTOK_CLIENT_SECRET');
  }

  const { data } = await axios.post(
    TIKTOK_TOKEN_URL,
    new URLSearchParams({
      client_key: config.tiktok.clientKey,
      client_secret: config.tiktok.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  return data;
}

export async function publishToTikTok(params: TikTokPublishParams): Promise<PublishResult> {
  const { postId, caption } = params;

  // TikTok Content Posting API requiere aprobación de la app
  if (!config.tiktok.clientKey || !params.accessToken) {
    await createPostLog({
      postId,
      platform: 'tiktok',
      action: 'publish',
      status: 'manual_required',
      errorMessage: 'TikTok API pendiente de configuración o aprobación',
    });
    return {
      success: false,
      error: 'TikTok requiere configuración manual. La API de publicación está pendiente de aprobación.',
    };
  }

  try {
    // Estructura preparada para direct post cuando la app tenga permisos
    const response = await axios.post(
      'https://open.tiktokapis.com/v2/post/publish/video/init/',
      {
        post_info: {
          title: caption.slice(0, 150),
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: params.videoUrl,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const publishId = response.data?.data?.publish_id;

    await createPostLog({
      postId,
      platform: 'tiktok',
      action: 'publish',
      status: 'success',
      responsePayload: sanitizeForLog(response.data),
    });

    return { success: true, externalPostId: publishId };
  } catch (err: unknown) {
    const errorMessage = extractError(err);
    await createPostLog({
      postId,
      platform: 'tiktok',
      action: 'publish',
      status: 'failed',
      errorMessage,
    });

    return {
      success: false,
      error: `TikTok: ${errorMessage}. Marca como acción manual si la API no está aprobada.`,
    };
  }
}

export function generateTikTokScript(caption: string, postType: string): string {
  return `🎬 GUION TIKTOK - El Pollón

HOOK (0-3s): "¿Antojo de pollo a la brasa en Iquique? 🍗"

DESARROLLO (3-15s):
- Mostrar pollo dorado saliendo del horno
- Close-up del corte jugoso
- Cliente recibiendo delivery

CTA (15-20s): "Pide por WhatsApp - link en bio"

TIPO: ${postType}
CAPTION: ${caption}

#ElPollon #PolloALaBrasa #Iquique #ComidaPeruana #FoodTok`;
}

function extractError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error?.message || err.message;
  }
  return err instanceof Error ? err.message : 'Error desconocido';
}
