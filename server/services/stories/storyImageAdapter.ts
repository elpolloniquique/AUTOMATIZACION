import axios from 'axios';
import sharp from 'sharp';
import { config } from '../../config/index.js';
import { getSupabaseAdmin } from '../../utils/supabase.js';
import {
  applyStoryLinkButtonOverlay,
  type StoryLinkButtonConfig,
} from './storyLinkButtonOverlay.js';

const STORY_W = 1080;
const STORY_H = 1920;

export type { StoryLinkButtonConfig };

export async function downloadImageBuffer(url: string): Promise<Buffer> {
  const { data } = await axios.get(url.split('?')[0], {
    responseType: 'arraybuffer',
    timeout: 30000,
    maxContentLength: 15 * 1024 * 1024,
  });
  return Buffer.from(data);
}

/** Adapta imagen cuadrada o cualquier ratio a 1080x1920 (crop center) */
export async function adaptImageToStoryFormat(sourceBuffer: Buffer): Promise<Buffer> {
  return sharp(sourceBuffer)
    .rotate()
    .resize(STORY_W, STORY_H, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 92 })
    .toBuffer();
}

export async function prepareStoryImagePublicUrl(
  imageUrl: string,
  storyId?: string,
  linkButton?: StoryLinkButtonConfig,
): Promise<string> {
  const buffer = await downloadImageBuffer(imageUrl);
  let adapted = await adaptImageToStoryFormat(buffer);

  if (linkButton?.enabled && linkButton.text) {
    adapted = await applyStoryLinkButtonOverlay(adapted, linkButton.text);
  }

  const supabase = getSupabaseAdmin();
  const fileName = `stories/story-${storyId || 'temp'}-${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from(config.supabase.storageBucket)
    .upload(fileName, adapted, { contentType: 'image/jpeg', upsert: true });

  if (error) throw new Error(`Error subiendo imagen story: ${error.message}`);

  const { data } = supabase.storage.from(config.supabase.storageBucket).getPublicUrl(fileName);
  return data.publicUrl;
}
