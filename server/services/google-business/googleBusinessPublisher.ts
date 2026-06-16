import axios from 'axios';
import { config } from '../../config/index.js';
import { createPostLog, sanitizeForLog } from '../../utils/logger.js';
import type { PublishResult } from '../meta/facebookPublisher.js';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GBP_API_BASE = 'https://mybusiness.googleapis.com/v4';

export interface GoogleBusinessPublishParams {
  postId: string;
  locationId: string;
  accessToken: string;
  summary: string;
  imageUrl?: string;
  ctaUrl?: string;
}

export function getGoogleOAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/business.manage',
    access_type: 'offline',
    state,
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string, redirectUri: string) {
  const { data } = await axios.post(GOOGLE_TOKEN_URL, {
    code,
    client_id: config.google.clientId,
    client_secret: config.google.clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  return data;
}

export async function publishToGoogleBusiness(params: GoogleBusinessPublishParams): Promise<PublishResult> {
  const { postId, locationId, accessToken, summary, imageUrl, ctaUrl } = params;

  if (!config.google.clientId || !accessToken) {
    await createPostLog({
      postId,
      platform: 'google_business',
      action: 'publish',
      status: 'manual_required',
      errorMessage: 'Google Business Profile API pendiente de configuración',
    });
    return {
      success: false,
      error: 'Google Business Profile requiere configuración. Conecta tu cuenta en Configuración de redes.',
    };
  }

  try {
    const localPost: Record<string, unknown> = {
      languageCode: 'es',
      summary,
      topicType: 'STANDARD',
    };

    if (imageUrl) {
      localPost.media = [{ mediaFormat: 'PHOTO', sourceUrl: imageUrl }];
    }

    if (ctaUrl) {
      localPost.callToAction = { actionType: 'LEARN_MORE', url: ctaUrl };
    }

    const response = await axios.post(
      `${GBP_API_BASE}/${locationId}/localPosts`,
      localPost,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const externalPostId = response.data?.name;

    await createPostLog({
      postId,
      platform: 'google_business',
      action: 'publish',
      status: 'success',
      responsePayload: sanitizeForLog(response.data),
    });

    return { success: true, externalPostId };
  } catch (err: unknown) {
    const errorMessage = extractError(err);
    await createPostLog({
      postId,
      platform: 'google_business',
      action: 'publish',
      status: 'failed',
      errorMessage,
    });
    return { success: false, error: errorMessage };
  }
}

export async function testGoogleBusinessConnection(locationId: string, accessToken: string) {
  try {
    const { data } = await axios.get(`${GBP_API_BASE}/${locationId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 15000,
    });
    return { ok: true, name: data.locationName || data.name };
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
