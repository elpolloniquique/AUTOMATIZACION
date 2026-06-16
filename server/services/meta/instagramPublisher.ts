import axios from 'axios';
import { config } from '../../config/index.js';
import { createPostLog, sanitizeForLog } from '../../utils/logger.js';
import type { PublishResult } from './facebookPublisher.js';

const GRAPH_BASE = `https://graph.facebook.com/${config.meta.graphVersion}`;

export interface InstagramPublishParams {
  postId: string;
  igAccountId: string;
  accessToken: string;
  caption: string;
  imageUrl: string;
}

export async function publishToInstagram(params: InstagramPublishParams): Promise<PublishResult> {
  const { postId, igAccountId, accessToken, caption, imageUrl } = params;

  try {
    // Validar cuenta Instagram Business
    const accountCheck = await axios.get(`${GRAPH_BASE}/${igAccountId}`, {
      params: { fields: 'id,username', access_token: accessToken },
      timeout: 15000,
    });

    if (!accountCheck.data?.id) {
      throw new Error('Cuenta de Instagram no válida o sin permisos');
    }

    // Paso 1: Crear contenedor de media
    const containerRes = await axios.post(
      `${GRAPH_BASE}/${igAccountId}/media`,
      null,
      {
        params: {
          image_url: imageUrl,
          caption,
          access_token: accessToken,
        },
        timeout: 30000,
      }
    );

    const creationId = containerRes.data?.id;
    if (!creationId) {
      throw new Error('No se pudo crear el contenedor de media de Instagram');
    }

    // Esperar procesamiento del contenedor
    await waitForMediaReady(creationId, accessToken);

    // Paso 2: Publicar media
    const publishRes = await axios.post(
      `${GRAPH_BASE}/${igAccountId}/media_publish`,
      null,
      {
        params: {
          creation_id: creationId,
          access_token: accessToken,
        },
        timeout: 30000,
      }
    );

    const externalPostId = publishRes.data?.id;

    await createPostLog({
      postId,
      platform: 'instagram',
      action: 'publish',
      status: 'success',
      requestPayload: sanitizeForLog({ igAccountId, caption: caption.slice(0, 100) }),
      responsePayload: sanitizeForLog(publishRes.data),
    });

    return { success: true, externalPostId };
  } catch (err: unknown) {
    const errorMessage = extractError(err);
    await createPostLog({
      postId,
      platform: 'instagram',
      action: 'publish',
      status: 'failed',
      errorMessage,
    });
    return { success: false, error: errorMessage };
  }
}

async function waitForMediaReady(creationId: string, accessToken: string, maxAttempts = 10): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const { data } = await axios.get(`${GRAPH_BASE}/${creationId}`, {
      params: { fields: 'status_code', access_token: accessToken },
    });
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') throw new Error('Error al procesar imagen en Instagram');
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error('Timeout esperando procesamiento de media en Instagram');
}

export async function testInstagramConnection(igAccountId: string, accessToken: string) {
  try {
    const { data } = await axios.get(`${GRAPH_BASE}/${igAccountId}`, {
      params: { fields: 'id,username,name', access_token: accessToken },
    });
    return { ok: true, username: data.username, name: data.name };
  } catch (err: unknown) {
    return { ok: false, error: extractError(err) };
  }
}

function extractError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error?.message || err.message;
  }
  return err instanceof Error ? err.message : 'Error desconocido';
}

// Preparado para Reels en el futuro
export async function publishReelToInstagram(_params: InstagramPublishParams & { videoUrl: string }): Promise<PublishResult> {
  return {
    success: false,
    error: 'Publicación de Reels pendiente de implementación. Usa imágenes por ahora.',
  };
}
