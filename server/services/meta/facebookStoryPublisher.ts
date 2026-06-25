import axios from 'axios';
import { config } from '../../config/index.js';
import { mapButtonTextToCtaType } from './facebookPostActionButton.js';

const GRAPH_BASE = `https://graph.facebook.com/${config.meta.graphVersion}`;

export type StoryMediaType = 'image' | 'video';

export interface FacebookStoryPublishParams {
  pageId: string;
  accessToken: string;
  mediaType?: StoryMediaType;
  imageUrl?: string;
  videoUrl?: string;
  linkUrl?: string;
  linkText?: string;
}

export interface StoryPublishResult {
  success: boolean;
  externalStoryId?: string;
  storyUrl?: string;
  photoId?: string;
  videoId?: string;
  error?: string;
  linkMode?: 'native' | 'photo';
}

async function publishPhotoStory(
  pageId: string,
  accessToken: string,
  photoId: string,
  linkUrl?: string,
  linkText?: string,
): Promise<{ postId?: string; success: boolean; linkMode: 'native' | 'photo' }> {
  const attempts: Array<{ body: Record<string, unknown>; linkMode: 'native' | 'photo' }> = [];

  if (linkUrl) {
    const ctaType = mapButtonTextToCtaType(linkText || 'Comprar');
    attempts.push({
      linkMode: 'native',
      body: {
        photo_id: photoId,
        link: linkUrl,
        call_to_action: { type: ctaType, value: { link: linkUrl } },
      },
    });
  }

  attempts.push({ linkMode: 'photo', body: { photo_id: photoId } });

  let lastErr: unknown;
  for (const attempt of attempts) {
    try {
      const storyRes = await axios.post(
        `${GRAPH_BASE}/${pageId}/photo_stories`,
        attempt.body,
        {
          params: { access_token: accessToken },
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
        },
      );

      const postId = storyRes.data?.post_id || storyRes.data?.id;
      const success = storyRes.data?.success === true || Boolean(postId);
      if (success) return { postId, success: true, linkMode: attempt.linkMode };
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error('Meta rechazó la publicación de la historia');
}

export async function publishPhotoStoryToFacebook(
  params: FacebookStoryPublishParams,
): Promise<StoryPublishResult> {
  const { pageId, accessToken, imageUrl, linkUrl, linkText } = params;

  if (!imageUrl) {
    return { success: false, error: 'URL de imagen requerida' };
  }

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

    const story = await publishPhotoStory(pageId, accessToken, photoId, linkUrl, linkText);
    if (!story.success) {
      return {
        success: false,
        error: 'Meta rechazó la publicación de la historia',
        photoId,
      };
    }

    const postId = story.postId;
    return {
      success: true,
      externalStoryId: postId,
      storyUrl: postId ? `https://www.facebook.com/stories/${postId}` : undefined,
      photoId,
      linkMode: story.linkMode,
    };
  } catch (err: unknown) {
    return { success: false, error: extractAxiosError(err) };
  }
}

async function uploadVideoForStory(
  pageId: string,
  accessToken: string,
  videoUrl: string,
): Promise<string> {
  const initRes = await axios.post(
    `${GRAPH_BASE}/${pageId}/video_stories`,
    { upload_phase: 'start' },
    {
      params: { access_token: accessToken },
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000,
    },
  );

  const videoId = initRes.data?.video_id;
  const uploadUrl = initRes.data?.upload_url;

  if (!videoId || !uploadUrl) {
    throw new Error('Meta no devolvió video_id o upload_url al iniciar la subida');
  }

  const uploadRes = await axios.post(uploadUrl, null, {
    headers: {
      Authorization: `OAuth ${accessToken}`,
      file_url: videoUrl,
    },
    timeout: 180000,
  });

  if (uploadRes.data?.success !== true) {
    throw new Error('Meta rechazó la subida del archivo de video');
  }

  const finishRes = await axios.post(
    `${GRAPH_BASE}/${pageId}/video_stories`,
    { upload_phase: 'finish', video_id: videoId },
    {
      params: { access_token: accessToken },
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000,
    },
  );

  const postId = finishRes.data?.post_id;
  const success = finishRes.data?.success === true || Boolean(postId);
  if (!success) {
    throw new Error('Meta rechazó la publicación del video story');
  }

  return postId || videoId;
}

export async function publishVideoStoryToFacebook(
  params: FacebookStoryPublishParams,
): Promise<StoryPublishResult> {
  const { pageId, accessToken, videoUrl } = params;

  if (!videoUrl) {
    return { success: false, error: 'URL de video requerida' };
  }

  try {
    const postId = await uploadVideoForStory(pageId, accessToken, videoUrl);
    return {
      success: true,
      externalStoryId: postId,
      storyUrl: postId ? `https://www.facebook.com/stories/${postId}` : undefined,
      videoId: postId,
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
  const mediaType = params.mediaType || (params.videoUrl ? 'video' : 'image');
  const publishFn = mediaType === 'video'
    ? publishVideoStoryToFacebook
    : publishPhotoStoryToFacebook;

  let last: StoryPublishResult = { success: false, error: 'Sin intentos' };
  for (let i = 0; i <= maxRetries; i++) {
    last = await publishFn(params);
    if (last.success) return last;
    if (i < maxRetries) await new Promise((r) => setTimeout(r, 2000));
  }
  return last;
}
