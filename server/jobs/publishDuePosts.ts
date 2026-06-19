import { getSupabaseAdmin } from '../utils/supabase.js';
import { publishWithRetry as publishFacebook } from '../services/meta/facebookPublisher.js';
import { appendPollonContact } from '../constants/pollonBrand.js';
import { publishToInstagram } from '../services/meta/instagramPublisher.js';
import { publishToTikTok } from '../services/tiktok/tiktokPublisher.js';
import { publishToGoogleBusiness } from '../services/google-business/googleBusinessPublisher.js';
import { createPostLog } from '../utils/logger.js';

interface PostRow {
  id: string;
  branch_id: string;
  title: string;
  caption: string | null;
  hashtags: string[] | null;
  cta: string | null;
  platform: string;
  generated_image_url: string | null;
  media_url: string | null;
}

interface SocialAccount {
  platform: string;
  account_id: string | null;
  access_token: string | null;
  is_connected: boolean;
}

export interface PublishJobResult {
  processed: number;
  published: number;
  failed: number;
  details: Array<{ postId: string; platform: string; status: string; error?: string }>;
}

export async function publishDuePosts(): Promise<PublishJobResult> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .eq('status', 'scheduled')
    .eq('approval_status', 'approved')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(20);

  if (error) throw new Error(`Error buscando posts: ${error.message}`);

  const result: PublishJobResult = { processed: 0, published: 0, failed: 0, details: [] };

  // Posts programados pero sin aprobar (estado inconsistente — no se publican)
  const { data: pendingApproval } = await supabase
    .from('posts')
    .select('id, title, scheduled_at')
    .eq('status', 'scheduled')
    .eq('approval_status', 'pending')
    .lte('scheduled_at', now)
    .limit(10);

  for (const p of pendingApproval || []) {
    result.details.push({
      postId: p.id,
      platform: 'system',
      status: 'skipped',
      error: `Sin aprobar: "${p.title}" — ve a Aprobaciones`,
    });
  }

  if (!posts?.length) return result;

  for (const post of posts as PostRow[]) {
    result.processed++;
    const publishResult = await publishSinglePost(post);
    result.details.push({
      postId: post.id,
      platform: post.platform,
      status: publishResult.success ? 'published' : 'failed',
      error: publishResult.error,
    });
    if (publishResult.success) result.published++;
    else result.failed++;
  }

  return result;
}

export async function publishSinglePost(post: PostRow): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();

  const { data: accounts } = await supabase
    .from('social_accounts')
    .select('*')
    .eq('branch_id', post.branch_id)
    .eq('platform', post.platform)
    .eq('is_connected', true)
    .maybeSingle();

  const account = accounts as SocialAccount | null;
  const imageUrl = post.generated_image_url || post.media_url;
  const message = buildCaption(post);

  if (!imageUrl && post.platform !== 'tiktok') {
    await updatePostStatus(post.id, 'failed', 'No hay imagen para publicar');
    return { success: false, error: 'No hay imagen para publicar' };
  }

  if (!account?.access_token || !account?.account_id) {
    const manualPlatforms = ['tiktok', 'google_business'];
    if (manualPlatforms.includes(post.platform)) {
      await updatePostStatus(post.id, 'manual_required', 'Plataforma pendiente de configuración');
      return { success: false, error: 'Pendiente de configuración manual' };
    }
    await updatePostStatus(post.id, 'failed', 'Cuenta de red social no conectada');
    return { success: false, error: 'Cuenta no conectada' };
  }

  let publishResult: { success: boolean; externalPostId?: string; error?: string };

  switch (post.platform) {
    case 'facebook':
      publishResult = await publishFacebook({
        postId: post.id,
        pageId: account.account_id,
        accessToken: account.access_token,
        message,
        imageUrl: imageUrl!,
      });
      break;

    case 'instagram':
      publishResult = await publishToInstagram({
        postId: post.id,
        igAccountId: account.account_id,
        accessToken: account.access_token,
        caption: message,
        imageUrl: imageUrl!,
      });
      break;

    case 'tiktok':
      publishResult = await publishToTikTok({
        postId: post.id,
        accountId: account.account_id,
        accessToken: account.access_token,
        caption: message,
      });
      break;

    case 'google_business':
      publishResult = await publishToGoogleBusiness({
        postId: post.id,
        locationId: account.account_id,
        accessToken: account.access_token,
        summary: message,
        imageUrl: imageUrl || undefined,
      });
      break;

    default:
      publishResult = { success: false, error: `Plataforma no soportada: ${post.platform}` };
  }

  if (publishResult.success) {
    await supabase
      .from('posts')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        external_post_id: publishResult.externalPostId || null,
        error_message: null,
      })
      .eq('id', post.id);
    return { success: true };
  }

  const status = publishResult.error?.includes('manual') ? 'manual_required' : 'failed';
  await updatePostStatus(post.id, status, publishResult.error);
  return { success: false, error: publishResult.error };
}

async function updatePostStatus(postId: string, status: string, errorMessage?: string) {
  const supabase = getSupabaseAdmin();
  await supabase
    .from('posts')
    .update({ status, error_message: errorMessage || null })
    .eq('id', postId);

  await createPostLog({
    postId,
    platform: 'system',
    action: 'status_update',
    status,
    errorMessage,
  });
}

function buildCaption(post: PostRow): string {
  const parts = [post.caption || post.title];
  if (post.cta) parts.push(post.cta);
  if (post.hashtags?.length) parts.push(post.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' '));
  return appendPollonContact(parts.filter(Boolean).join('\n\n'));
}

// Ejecutar directamente: npm run cron:local
if (process.argv[1]?.includes('publishDuePosts')) {
  publishDuePosts()
    .then((r) => {
      console.log('[cron] Resultado:', JSON.stringify(r, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('[cron] Error:', err);
      process.exit(1);
    });
}
