import axios from 'axios';
import { config } from '../../config/index.js';

const GRAPH_BASE = `https://graph.facebook.com/${config.meta.graphVersion}`;

export interface FacebookStoryPublishParams {
  pageId: string;
  accessToken: string;
  imageUrl: string;
}

export interface StoryPublishResult {
  success: boolean;
  externalStoryId?: string;
  storyUrl?: string;
  photoId?: string;
  error?: string;
}

export async function publishPhotoStoryToFacebook(
  params: FacebookStoryPublishParams,
): Promise<StoryPublishResult> {
  const { pageId, accessToken, imageUrl } = params;

  try {
    const uploadRes = await axios.post(
      `${GRAPH_BASE}/${pageId}/photos`,
      null,
      {
        params: {
          url: imageUrl,
          published: false,
          temporary: true,
          access_token: accessToken,
        },
        timeout: 30000,
      },
    );

    const photoId = uploadRes.data?.id;
    if (!photoId) {
      return { success: false, error: 'Meta no devolvió photo_id al subir la imagen' };
    }

    const storyRes = await axios.post(
      `${GRAPH_BASE}/${pageId}/photo_stories`,
      { photo_id: photoId },
      {
        params: { access_token: accessToken },
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      },
    );

    const postId = storyRes.data?.post_id || storyRes.data?.id;
    const success = storyRes.data?.success === true || Boolean(postId);

    if (!success) {
      return {
        success: false,
        error: storyRes.data?.error?.message || 'Meta rechazó la publicación de la historia',
        photoId,
      };
    }

    return {
      success: true,
      externalStoryId: postId,
      storyUrl: postId ? `https://www.facebook.com/stories/${postId}` : undefined,
      photoId,
    };
  } catch (err: unknown) {
    return { success: false, error: extractAxiosError(err) };
  }
}

function extractAxiosError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const apiError = err.response?.data?.error;
    if (apiError?.message) {
      const sub = apiError.error_user_msg || apiError.error_user_title;
      return sub ? `${apiError.message} — ${sub}` : apiError.message;
    }
    return err.message;
  }
  return err instanceof Error ? err.message : 'Error desconocido';
}

export async function publishStoryWithRetry(
  params: FacebookStoryPublishParams,
  maxRetries = 1,
): Promise<StoryPublishResult> {
  let last: StoryPublishResult = { success: false, error: 'Sin intentos' };
  for (let i = 0; i <= maxRetries; i++) {
    last = await publishPhotoStoryToFacebook(params);
    if (last.success) return last;
    if (i < maxRetries) await new Promise((r) => setTimeout(r, 1000));
  }
  return last;
}
