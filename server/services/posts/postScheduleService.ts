import { getSupabaseAdmin } from '../../utils/supabase.js';
import { publishSinglePost } from '../../jobs/publishDuePosts.js';
import { normalizeStoryLinkUrl } from '../stories/storyLinkButtonOverlay.js';
import type { UserRole } from '../../types.js';

export function canAutoApprove(role: UserRole): boolean {
  return role === 'super_admin' || role === 'admin_sucursal' || role === 'aprobador';
}

/** true si la hora programada ya lleg? (o no hay fecha ÿÿÿ publicar ya) */
export function isPublishDue(scheduledAt: string | null | undefined): boolean {
  if (!scheduledAt) return true;
  return new Date(scheduledAt).getTime() <= Date.now();
}

/** Repara posts atascados: programados pero sin aprobar y ya vencidos */
export async function repairStuckScheduledPosts(): Promise<number> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data } = await supabase
    .from('posts')
    .update({ approval_status: 'approved', error_message: null })
    .eq('status', 'scheduled')
    .eq('approval_status', 'pending')
    .lte('scheduled_at', now)
    .select('id');

  return data?.length || 0;
}

export interface SavePostInput {
  id?: string;
  branch_id: string;
  created_by: string;
  platform: string;
  post_type: string;
  title: string;
  caption?: string | null;
  cta?: string | null;
  hashtags?: string[];
  scheduled_at?: string | null;
  price?: string | null;
  product_name?: string | null;
  generated_image_url?: string | null;
  media_urls?: string[] | null;
  gallery_item_ids?: string[] | null;
  image_mode?: string | null;
  action_button_enabled?: boolean;
  action_button_type?: 'website' | 'whatsapp';
  action_button_text?: string | null;
  action_button_url?: string | null;
  action_button_whatsapp_message?: string | null;
  schedule: boolean;
  userRole: UserRole;
  userId: string;
  preserveStatus?: PostStatusPair | null;
}

interface PostStatusPair {
  status: string;
  approval_status: string;
}

export interface SavePostResult {
  post: Record<string, unknown>;
  published_now: boolean;
  publish_result?: { success: boolean; error?: string };
  message: string;
}

export async function saveAndSchedulePost(input: SavePostInput): Promise<SavePostResult> {
  const supabase = getSupabaseAdmin();
  const autoApprove = input.schedule && canAutoApprove(input.userRole);

  let status: string;
  let approval_status: string;

  if (input.schedule && autoApprove) {
    status = 'scheduled';
    approval_status = 'approved';
  } else if (input.schedule) {
    status = 'pending_approval';
    approval_status = 'pending';
  } else if (
    input.preserveStatus?.status === 'scheduled'
    || input.preserveStatus?.status === 'published'
  ) {
    status = input.preserveStatus.status;
    approval_status = input.preserveStatus.approval_status;
  } else {
    status = 'draft';
    approval_status = input.preserveStatus?.approval_status === 'approved' ? 'approved' : 'pending';
  }

  if (input.schedule && input.platform !== 'tiktok') {
    const hasImage = Boolean(input.generated_image_url);
    if (!hasImage) {
      throw new Error('Genera o selecciona una imagen antes de programar la publicaci?n');
    }
  }

  if (input.schedule) {
    const { data: account } = await supabase
      .from('social_accounts')
      .select('id, is_connected, account_id, access_token')
      .eq('branch_id', input.branch_id)
      .eq('platform', input.platform)
      .eq('is_connected', true)
      .maybeSingle();

    if (!account?.access_token || !account?.account_id) {
      throw new Error(
        `Conecta la cuenta de ${input.platform} en Redes sociales antes de programar`,
      );
    }
  }

  const row = {
    branch_id: input.branch_id,
    created_by: input.created_by,
    platform: input.platform,
    post_type: input.post_type,
    title: input.title,
    caption: input.caption || null,
    cta: input.cta || null,
    hashtags: input.hashtags || [],
    scheduled_at: input.scheduled_at || null,
    price: input.price || null,
    product_name: input.product_name || null,
    generated_image_url: input.generated_image_url || null,
    media_urls: input.media_urls || null,
    gallery_item_ids: input.gallery_item_ids || null,
    image_mode: input.image_mode || null,
    action_button_enabled: input.platform === 'facebook' && input.action_button_enabled === true,
    action_button_type: input.action_button_type === 'whatsapp' ? 'whatsapp' : 'website',
    action_button_text: (input.action_button_text || 'Comprar').trim().slice(0, 30) || 'Comprar',
    action_button_url: input.platform === 'facebook'
      && input.action_button_enabled
      && input.action_button_type !== 'whatsapp'
      ? normalizeStoryLinkUrl(input.action_button_url)
      : null,
    action_button_whatsapp_message: input.action_button_whatsapp_message || null,
    status,
    approval_status,
    error_message: null,
    ...(autoApprove ? { approved_by: input.userId } : {}),
  };

  let post: Record<string, unknown>;

  if (input.id) {
    const { data, error } = await supabase
      .from('posts')
      .update(row)
      .eq('id', input.id)
      .select('*')
      .single();
    if (error || !data) throw new Error(error?.message || 'Error al actualizar publicaci?n');
    post = data;
  } else {
    const { data, error } = await supabase.from('posts').insert(row).select('*').single();
    if (error || !data) throw new Error(error?.message || 'Error al crear publicaci?n');
    post = data;
  }

  if (input.schedule && autoApprove && isPublishDue(input.scheduled_at)) {
    const publishResult = await publishSinglePost(post as unknown as Parameters<typeof publishSinglePost>[0]);
    const { data: fresh } = await supabase.from('posts').select('*').eq('id', post.id).single();
    return {
      post: fresh || post,
      published_now: true,
      publish_result: publishResult,
      message: publishResult.success
        ? 'Publicaci?n programada y publicada en la red social'
        : `Programada pero fall? al publicar: ${publishResult.error || 'Error desconocido'}`,
    };
  }

  if (input.schedule && autoApprove) {
    return {
      post,
      published_now: false,
      message: input.scheduled_at
        ? `Publicaci?n programada para ${new Date(input.scheduled_at).toLocaleString('es-CL')}. Se publicar? autom?ticamente en esa hora.`
        : 'Publicaci?n programada',
    };
  }

  return {
    post,
    published_now: false,
    message: input.schedule ? 'Enviada a aprobaci?n' : 'Borrador guardado',
  };
}
