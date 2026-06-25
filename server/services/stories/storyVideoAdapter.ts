import axios from 'axios';
import { config } from '../../config/index.js';
import { getSupabaseAdmin } from '../../utils/supabase.js';
import {
  extractVideoThumbnail,
  processStoryVideo,
  type StoryAudioMode,
  type StoryVideoProcessOptions,
} from './storyVideoProcessor.js';

export type { StoryAudioMode };

export async function downloadVideoBuffer(url: string): Promise<Buffer> {
  const { data } = await axios.get(url.split('?')[0], {
    responseType: 'arraybuffer',
    timeout: 120000,
    maxContentLength: 100 * 1024 * 1024,
  });
  return Buffer.from(data);
}

export interface PreparedStoryVideo {
  videoUrl: string;
  thumbnailUrl: string;
}

export async function prepareStoryVideoPublicUrl(
  videoUrl: string,
  storyId: string | undefined,
  audioOptions: StoryVideoProcessOptions,
): Promise<PreparedStoryVideo> {
  const sourceBuffer = await downloadVideoBuffer(videoUrl);
  const processed = await processStoryVideo(sourceBuffer, audioOptions);
  const thumbnail = await extractVideoThumbnail(processed);

  const supabase = getSupabaseAdmin();
  const stamp = Date.now();
  const baseName = `stories/story-${storyId || 'temp'}-${stamp}`;

  const videoPath = `${baseName}.mp4`;
  const { error: videoErr } = await supabase.storage
    .from(config.supabase.storageBucket)
    .upload(videoPath, processed, { contentType: 'video/mp4', upsert: true });

  if (videoErr) throw new Error(`Error subiendo video story: ${videoErr.message}`);

  const thumbPath = `${baseName}-thumb.jpg`;
  const { error: thumbErr } = await supabase.storage
    .from(config.supabase.storageBucket)
    .upload(thumbPath, thumbnail, { contentType: 'image/jpeg', upsert: true });

  if (thumbErr) throw new Error(`Error subiendo miniatura: ${thumbErr.message}`);

  const bucket = config.supabase.storageBucket;
  const { data: videoData } = supabase.storage.from(bucket).getPublicUrl(videoPath);
  const { data: thumbData } = supabase.storage.from(bucket).getPublicUrl(thumbPath);

  return {
    videoUrl: videoData.publicUrl,
    thumbnailUrl: thumbData.publicUrl,
  };
}
