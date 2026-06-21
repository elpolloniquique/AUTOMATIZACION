import { randomUUID } from 'crypto';
import { getSupabaseAdmin } from '../../utils/supabase.js';
import { publishStoryWithRetry } from '../meta/facebookStoryPublisher.js';
import { prepareStoryImagePublicUrl } from './storyImageAdapter.js';
import { normalizeStoryLinkUrl } from './storyLinkButtonOverlay.js';
import {
  alreadyPublishedToday,
  getSantiagoNow,
  isDayScheduled,
  isTimeInPublishWindow,
} from '../../utils/santiagoTime.js';

export interface ScheduledStoryRow {
  id: string;
  branch_id: string;
  created_by: string | null;
  title: string;
  image_url: string;
  gallery_item_id: string | null;
  schedule_mode: 'recurring' | 'once';
  scheduled_at: string | null;
  days_of_week: number[];
  publish_time: string;
  timezone: string;
  is_active: boolean;
  link_button_enabled: boolean;
  link_button_text: string;
  link_button_url: string | null;
  last_published_at: string | null;
  last_publish_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoryPublicationRow {
  id: string;
  scheduled_story_id: string | null;
  branch_id: string;
  title: string | null;
  image_url: string;
  status: 'success' | 'failed' | 'pending';
  external_story_id: string | null;
  story_url: string | null;
  error_message: string | null;
  published_at: string | null;
  created_at: string;
}

export interface PublishStoryJobResult {
  processed: number;
  published: number;
  failed: number;
  skipped: number;
  details: Array<{ storyId: string; title: string; status: string; error?: string }>;
}

async function getFacebookAccount(branchId: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('social_accounts')
    .select('*')
    .eq('branch_id', branchId)
    .eq('platform', 'facebook')
    .eq('is_connected', true)
    .maybeSingle();
  return data;
}

export async function publishSingleStory(
  story: ScheduledStoryRow,
  force = false,
): Promise<{ success: boolean; error?: string; externalStoryId?: string }> {
  const supabase = getSupabaseAdmin();
  const account = await getFacebookAccount(story.branch_id);

  if (!account?.account_id || !account.access_token) {
    const err = 'Facebook no conectado para esta sucursal';
    await recordPublication(story, 'failed', err);
    await supabase.from('scheduled_stories').update({
      last_publish_error: err,
      updated_at: new Date().toISOString(),
    }).eq('id', story.id);
    return { success: false, error: err };
  }

  const pubId = randomUUID();
  await supabase.from('story_publications').insert({
    id: pubId,
    scheduled_story_id: story.id,
    branch_id: story.branch_id,
    title: story.title,
    image_url: story.image_url,
    status: 'pending',
  });

  try {
    const storyImageUrl = await prepareStoryImagePublicUrl(story.image_url, story.id, {
      enabled: story.link_button_enabled !== false,
      text: story.link_button_text || 'Comprar',
      url: normalizeStoryLinkUrl(story.link_button_url),
    });

    const result = await publishStoryWithRetry({
      pageId: account.account_id,
      accessToken: account.access_token,
      imageUrl: storyImageUrl,
    });

    const now = new Date().toISOString();

    if (result.success) {
      await supabase.from('story_publications').update({
        status: 'success',
        external_story_id: result.externalStoryId || null,
        story_url: result.storyUrl || null,
        published_at: now,
        image_url: storyImageUrl,
      }).eq('id', pubId);

      await supabase.from('scheduled_stories').update({
        last_published_at: now,
        last_publish_error: null,
        updated_at: now,
        ...((story.schedule_mode || 'recurring') === 'once' ? { is_active: false } : {}),
      }).eq('id', story.id);

      return { success: true, externalStoryId: result.externalStoryId };
    }

    const err = result.error || 'Error desconocido al publicar historia';
    await supabase.from('story_publications').update({
      status: 'failed',
      error_message: err,
      published_at: now,
    }).eq('id', pubId);

    await supabase.from('scheduled_stories').update({
      last_publish_error: err,
      updated_at: now,
    }).eq('id', story.id);

    return { success: false, error: err };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Error al preparar imagen';
    await supabase.from('story_publications').update({
      status: 'failed',
      error_message: errMsg,
      published_at: new Date().toISOString(),
    }).eq('id', pubId);

    await supabase.from('scheduled_stories').update({
      last_publish_error: errMsg,
      updated_at: new Date().toISOString(),
    }).eq('id', story.id);

    return { success: false, error: errMsg };
  }
}

async function recordPublication(
  story: ScheduledStoryRow,
  status: 'failed',
  error: string,
) {
  const supabase = getSupabaseAdmin();
  await supabase.from('story_publications').insert({
    scheduled_story_id: story.id,
    branch_id: story.branch_id,
    title: story.title,
    image_url: story.image_url,
    status,
    error_message: error,
    published_at: new Date().toISOString(),
  });
}

export function isStoryDue(story: ScheduledStoryRow, force = false): boolean {
  if (!story.is_active && !force) return false;

  const mode = story.schedule_mode || 'recurring';

  if (mode === 'once') {
    if (!story.scheduled_at) return false;
    if (!force && story.last_published_at) return false;
    if (force) return true;
    return new Date(story.scheduled_at).getTime() <= Date.now();
  }

  const now = getSantiagoNow();
  if (!story.days_of_week?.length || !isDayScheduled(story.days_of_week, now.dayOfWeek)) return false;
  if (!force && !isTimeInPublishWindow(now, story.publish_time, 2)) return false;
  if (!force && alreadyPublishedToday(story.last_published_at, now)) return false;
  return true;
}

export async function publishDueStories(options?: { branchId?: string }): Promise<PublishStoryJobResult> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('scheduled_stories')
    .select('*')
    .eq('is_active', true)
    .order('publish_time');
  if (options?.branchId) query = query.eq('branch_id', options.branchId);

  const { data: stories, error } = await query;

  if (error) throw new Error(error.message);

  const result: PublishStoryJobResult = {
    processed: 0,
    published: 0,
    failed: 0,
    skipped: 0,
    details: [],
  };

  for (const row of (stories || []) as ScheduledStoryRow[]) {
    if (!isStoryDue(row)) {
      result.skipped++;
      continue;
    }

    result.processed++;
    const pub = await publishSingleStory(row);
    if (pub.success) {
      result.published++;
      result.details.push({ storyId: row.id, title: row.title, status: 'published' });
    } else {
      result.failed++;
      result.details.push({ storyId: row.id, title: row.title, status: 'failed', error: pub.error });
    }
  }

  return result;
}

export function buildStoryPayload(body: Record<string, unknown>, userId?: string) {
  const mode = (body.schedule_mode as string) === 'once' ? 'once' : 'recurring';
  const days = Array.isArray(body.days_of_week)
    ? (body.days_of_week as number[]).map(Number)
    : [1, 2, 3, 4, 5, 6, 0];

  const linkEnabled = body.link_button_enabled !== false;
  const linkText = String(body.link_button_text || 'Comprar').trim().slice(0, 30) || 'Comprar';

  return {
    branch_id: body.branch_id,
    created_by: userId || body.created_by || null,
    title: body.title,
    image_url: body.image_url,
    gallery_item_id: body.gallery_item_id || null,
    schedule_mode: mode,
    scheduled_at: mode === 'once' ? (body.scheduled_at as string) || null : null,
    days_of_week: mode === 'once' ? [] : days,
    publish_time: mode === 'once' ? '00:00:00' : (body.publish_time || '10:00:00'),
    timezone: body.timezone || 'America/Santiago',
    is_active: body.is_active !== false,
    link_button_enabled: linkEnabled,
    link_button_text: linkText,
    link_button_url: linkEnabled ? normalizeStoryLinkUrl(body.link_button_url as string | null) : null,
    updated_at: new Date().toISOString(),
  };
}

export async function maybePublishStoryImmediately(story: ScheduledStoryRow): Promise<void> {
  if (isStoryDue(story)) {
    await publishSingleStory(story);
  }
}
