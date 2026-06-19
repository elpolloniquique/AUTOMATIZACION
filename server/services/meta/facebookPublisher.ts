import axios from 'axios';
import { config } from '../../config/index.js';
import { createPostLog, sanitizeForLog } from '../../utils/logger.js';

const GRAPH_BASE = `https://graph.facebook.com/${config.meta.graphVersion}`;

export interface FacebookPublishParams {
  postId: string;
  pageId: string;
  accessToken: string;
  message: string;
  imageUrl: string;
}

export interface PublishResult {
  success: boolean;
  externalPostId?: string;
  error?: string;
}

export async function publishToFacebook(params: FacebookPublishParams): Promise<PublishResult> {
  const { postId, pageId, accessToken, message, imageUrl } = params;

  try {
    // Paso 1: Publicar foto con caption
    const response = await axios.post(
      `${GRAPH_BASE}/${pageId}/photos`,
      null,
      {
        params: {
          url: imageUrl,
          caption: message,
          access_token: accessToken,
        },
        timeout: 20000,
      }
    );

    const externalPostId = response.data?.id || response.data?.post_id;

    await createPostLog({
      postId,
      platform: 'facebook',
      action: 'publish',
      status: 'success',
      requestPayload: sanitizeForLog({ pageId, message: message.slice(0, 100), imageUrl }),
      responsePayload: sanitizeForLog(response.data),
    });

    return { success: true, externalPostId };
  } catch (err: unknown) {
    const errorMessage = extractAxiosError(err);
    await createPostLog({
      postId,
      platform: 'facebook',
      action: 'publish',
      status: 'failed',
      requestPayload: sanitizeForLog({ pageId }),
      errorMessage,
    });
    return { success: false, error: errorMessage };
  }
}

export async function testFacebookConnection(pageId: string, accessToken: string): Promise<{ ok: boolean; name?: string; error?: string }> {
  try {
    const { data } = await axios.get(`${GRAPH_BASE}/${pageId}`, {
      params: { fields: 'name,id', access_token: accessToken },
      timeout: 15000,
    });
    return { ok: true, name: data.name };
  } catch (err: unknown) {
    return { ok: false, error: extractAxiosError(err) };
  }
}

function extractAxiosError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const apiError = err.response?.data?.error;
    if (apiError?.message) return apiError.message;
    return err.message;
  }
  return err instanceof Error ? err.message : 'Error desconocido';
}

export async function publishWithRetry(params: FacebookPublishParams, maxRetries = 1): Promise<PublishResult> {
  let lastResult: PublishResult = { success: false, error: 'Sin intentos' };
  for (let i = 0; i <= maxRetries; i++) {
    lastResult = await publishToFacebook(params);
    if (lastResult.success) return lastResult;
    if (i < maxRetries) await new Promise((r) => setTimeout(r, 800));
  }
  return lastResult;
}
