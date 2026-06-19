import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config, validateConfig } from './config/index.js';
import { startLocalCron } from './scheduler/localCron.js';
import { authMiddleware } from './utils/authMiddleware.js';
import { roleGuard, cronGuard } from './utils/roleGuard.js';
import { asyncHandler } from './utils/asyncHandler.js';
import { assertBranchAccess, getPostBranchId, HttpError } from './utils/branchAccess.js';
import { publishDuePosts, publishSinglePost } from './jobs/publishDuePosts.js';
import { generateContent } from './services/ai/contentGenerator.js';
import { AVAILABLE_TEMPLATES, listHtmlTemplateSlugs } from './services/image-generator/renderPostImage.js';
import { generatePostImage, fetchGalleryItems, importGalleryFromUrl } from './services/gallery/galleryService.js';
import { matchTopGalleryItems } from './services/gallery/galleryMatcher.js';
import { isAdvancedAiConfigured, getActiveAiProvider, getAiConfigStatus } from './services/gallery/galleryAiEdit.js';
import { testFacebookConnection } from './services/meta/facebookPublisher.js';
import { testInstagramConnection } from './services/meta/instagramPublisher.js';
import { testGoogleBusinessConnection } from './services/google-business/googleBusinessPublisher.js';
import { generateTikTokScript } from './services/tiktok/tiktokPublisher.js';
import { getSupabaseAdmin } from './utils/supabase.js';
import { z } from 'zod';

function zodErrorMessage(result: z.SafeParseError<unknown>) {
  const fieldErrors = result.error.flatten().fieldErrors as Record<string, string[] | undefined>;
  return Object.entries(fieldErrors)
    .map(([k, v]) => `${k}: ${v?.join(', ') ?? ''}`)
    .filter(Boolean)
    .join('; ') || 'Datos inválidos';
}

function getCorsOrigins(): (string | RegExp)[] {
  const origins: (string | RegExp)[] = [
    config.appUrl,
    'http://localhost:5173',
    /\.vercel\.app$/,
  ];
  if (process.env.VERCEL_URL) {
    origins.push(`https://${process.env.VERCEL_URL}`);
  }
  return origins;
}

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = getCorsOrigins();
    const ok = allowed.some((o) =>
      o instanceof RegExp ? o.test(origin) : o === origin
    );
    callback(null, ok);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  if (config.nodeEnv === 'production') {
    return res.json({ status: 'ok' });
  }
  res.json({ status: 'ok', warnings: validateConfig() });
});

app.post('/api/cron/publish-due-posts', cronGuard, asyncHandler(async (_req, res) => {
  const result = await publishDuePosts();
  res.json({ success: true, ...result });
}));

app.get('/api/cron/publish-due-posts', cronGuard, asyncHandler(async (_req, res) => {
  const result = await publishDuePosts();
  res.json({ success: true, ...result });
}));

app.post('/api/ai/generate', authMiddleware, asyncHandler(async (req, res) => {
  const schema = z.object({
    branch_id: z.string().uuid(),
    post_id: z.string().uuid().optional(),
    type: z.enum(['facebook', 'instagram', 'tiktok', 'google_business', 'hashtags', 'cta', 'ab_variant']),
    post_type: z.string(),
    branch_name: z.string(),
    city: z.string(),
    product_name: z.string().optional(),
    price: z.string().optional(),
    custom_prompt: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: zodErrorMessage(parsed) });

  assertBranchAccess(req.user!, parsed.data.branch_id);

  const result = await generateContent({
    branchId: parsed.data.branch_id,
    postId: parsed.data.post_id,
    type: parsed.data.type,
    postType: parsed.data.post_type,
    branchName: parsed.data.branch_name,
    city: parsed.data.city,
    productName: parsed.data.product_name,
    price: parsed.data.price,
    customPrompt: parsed.data.custom_prompt,
  });
  res.json(result);
}));

function optionalString() {
  return z.union([z.string(), z.null()]).optional().transform((v) => v ?? undefined);
}

app.post('/api/images/generate', authMiddleware, asyncHandler(async (req, res) => {
  const schema = z.object({
    mode: z.enum(['template', 'gallery_auto', 'gallery_prompt', 'gallery_pick']).default('gallery_auto'),
    template_slug: z.string(),
    branch_name: z.string(),
    branch_id: z.string().uuid().optional(),
    offer_title: z.string().min(1, 'El título es requerido'),
    caption: optionalString(),
    post_type: optionalString(),
    image_prompt: optionalString(),
    price: optionalString(),
    product_image_url: optionalString(),
    logo_url: optionalString(),
    cta: optionalString(),
    brand_color: optionalString(),
    post_id: z.string().uuid().optional(),
    gallery_item_ids: z.array(z.string().uuid()).min(1).max(4).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: zodErrorMessage(parsed) });

  if (parsed.data.branch_id) {
    assertBranchAccess(req.user!, parsed.data.branch_id);
  }

  const result = await generatePostImage({
    mode: parsed.data.mode,
    templateSlug: parsed.data.template_slug,
    branchName: parsed.data.branch_name,
    branchId: parsed.data.branch_id,
    offerTitle: parsed.data.offer_title,
    caption: parsed.data.caption,
    postType: parsed.data.post_type,
    imagePrompt: parsed.data.image_prompt,
    price: parsed.data.price,
    logoUrl: parsed.data.logo_url,
    cta: parsed.data.cta,
    brandColor: parsed.data.brand_color,
    postId: parsed.data.post_id,
    galleryItemIds: parsed.data.gallery_item_ids,
  });
  res.json(result);
}));

app.get('/api/images/templates', authMiddleware, (_req, res) => {
  const aiStatus = getAiConfigStatus();
  res.json({
    templates: AVAILABLE_TEMPLATES,
    ai_configured: isAdvancedAiConfigured(),
    ai_provider: getActiveAiProvider(),
    ...aiStatus,
  });
});

app.get('/api/templates/html-slugs', authMiddleware, asyncHandler(async (_req, res) => {
  const slugs = await listHtmlTemplateSlugs();
  res.json({ slugs });
}));

app.get('/api/gallery/match', authMiddleware, asyncHandler(async (req, res) => {
  const branchId = req.query.branch_id as string | undefined;
  const title = (req.query.title as string) || '';
  const caption = (req.query.caption as string) || '';
  const postType = (req.query.post_type as string) || '';

  if (branchId) assertBranchAccess(req.user!, branchId);

  const items = await fetchGalleryItems(branchId);
  const matches = matchTopGalleryItems(items, { title, caption, postType, branchId }, 5);
  res.json({ matches, total: items.length });
}));

app.post('/api/gallery/import-url', authMiddleware, asyncHandler(async (req, res) => {
  const schema = z.object({
    url: z.string().url(),
    title: z.string().min(2),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    dish_type: z.string().optional(),
    branch_id: z.string().uuid().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: zodErrorMessage(parsed) });

  if (parsed.data.branch_id) assertBranchAccess(req.user!, parsed.data.branch_id);

  const item = await importGalleryFromUrl(parsed.data.url, {
    title: parsed.data.title,
    description: parsed.data.description,
    tags: parsed.data.tags,
    dish_type: parsed.data.dish_type,
    branch_id: parsed.data.branch_id,
    created_by: req.user!.id,
  });
  res.json(item);
}));

app.post('/api/social/test', authMiddleware, roleGuard('super_admin', 'admin_sucursal'), asyncHandler(async (req, res) => {
  const schema = z.object({
    platform: z.enum(['facebook', 'instagram', 'tiktok', 'google_business']),
    account_id: z.string(),
    access_token: z.string(),
    branch_id: z.string().uuid().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: zodErrorMessage(parsed) });

  if (parsed.data.branch_id) {
    assertBranchAccess(req.user!, parsed.data.branch_id);
  }

  const { platform, account_id, access_token } = parsed.data;
  let result;
  switch (platform) {
    case 'facebook':
      result = await testFacebookConnection(account_id, access_token);
      break;
    case 'instagram':
      result = await testInstagramConnection(account_id, access_token);
      break;
    case 'google_business':
      result = await testGoogleBusinessConnection(account_id, access_token);
      break;
    default:
      result = { ok: false, error: 'TikTok API pendiente de aprobación.' };
  }
  res.json(result);
}));

app.post('/api/social/publish-test', authMiddleware, roleGuard('super_admin', 'admin_sucursal'), asyncHandler(async (req, res) => {
  const schema = z.object({ post_id: z.string().uuid() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: zodErrorMessage(parsed) });

  const supabase = getSupabaseAdmin();
  const branchId = await getPostBranchId(supabase, parsed.data.post_id);
  assertBranchAccess(req.user!, branchId);

  const { data: post, error } = await supabase.from('posts').select('*').eq('id', parsed.data.post_id).single();
  if (error || !post) return res.status(404).json({ error: 'Publicación no encontrada' });

  const result = await publishSinglePost(post);
  res.json(result);
}));

app.post('/api/posts/:id/republish', authMiddleware, asyncHandler(async (req, res) => {
  const schema = z.object({
    scheduled_at: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: zodErrorMessage(parsed) });

  const supabase = getSupabaseAdmin();
  const postId = String(req.params.id);
  const branchId = await getPostBranchId(supabase, postId);
  assertBranchAccess(req.user!, branchId);

  const { data: original, error } = await supabase.from('posts').select('*').eq('id', postId).single();
  if (error || !original) return res.status(404).json({ error: 'Publicación no encontrada' });

  const scheduledAt = parsed.data.scheduled_at
    ? new Date(parsed.data.scheduled_at).toISOString()
    : null;

  const { data: clone, error: insertError } = await supabase
    .from('posts')
    .insert({
      branch_id: original.branch_id,
      created_by: req.user!.id,
      title: original.title,
      caption: original.caption,
      cta: original.cta,
      hashtags: original.hashtags,
      platform: original.platform,
      post_type: original.post_type,
      media_url: original.media_url,
      generated_image_url: original.generated_image_url,
      media_urls: original.media_urls || [],
      gallery_item_ids: original.gallery_item_ids || [],
      image_mode: original.image_mode,
      price: original.price,
      product_name: original.product_name,
      scheduled_at: scheduledAt,
      status: scheduledAt ? 'pending_approval' : 'draft',
      approval_status: 'pending',
      source_post_id: original.id,
    })
    .select()
    .single();

  if (insertError || !clone) {
    return res.status(500).json({ error: insertError?.message || 'Error al republicar' });
  }

  res.json({ success: true, post: clone });
}));

app.post('/api/posts/:id/retry', authMiddleware, roleGuard('super_admin', 'admin_sucursal', 'aprobador'), asyncHandler(async (req, res) => {
  const supabase = getSupabaseAdmin();
  const postId = String(req.params.id);
  const branchId = await getPostBranchId(supabase, postId);
  assertBranchAccess(req.user!, branchId);

  const { data: post, error } = await supabase.from('posts').select('*').eq('id', postId).single();
  if (error || !post) return res.status(404).json({ error: 'Publicación no encontrada' });

  await supabase.from('posts').update({
    status: 'scheduled',
    approval_status: 'approved',
    error_message: null,
  }).eq('id', post.id);
  const result = await publishSinglePost(post);
  res.json(result);
}));

app.post('/api/posts/:id/approve', authMiddleware, roleGuard('super_admin', 'admin_sucursal', 'aprobador'), asyncHandler(async (req, res) => {
  const supabase = getSupabaseAdmin();
  const postId = String(req.params.id);
  const branchId = await getPostBranchId(supabase, postId);
  assertBranchAccess(req.user!, branchId);

  const { error } = await supabase
    .from('posts')
    .update({
      approval_status: 'approved',
      approved_by: req.user!.id,
      status: 'scheduled',
      error_message: null,
    })
    .eq('id', postId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const { data: post } = await supabase.from('posts').select('*').eq('id', postId).single();
  if (!post) {
    res.json({ success: true, published_now: false });
    return;
  }

  const isDue = !post.scheduled_at || new Date(post.scheduled_at) <= new Date();
  if (isDue) {
    const publishResult = await publishSinglePost(post);
    res.json({ success: true, published_now: true, publish_result: publishResult });
    return;
  }

  res.json({ success: true, published_now: false });
}));

app.post('/api/posts/:id/publish-now', authMiddleware, roleGuard('super_admin', 'admin_sucursal', 'aprobador'), asyncHandler(async (req, res) => {
  const supabase = getSupabaseAdmin();
  const postId = String(req.params.id);
  const branchId = await getPostBranchId(supabase, postId);
  assertBranchAccess(req.user!, branchId);

  const { data: post, error } = await supabase.from('posts').select('*').eq('id', postId).single();
  if (error || !post) return res.status(404).json({ error: 'Publicación no encontrada' });

  if (post.status === 'published') {
    return res.status(400).json({ error: 'Esta publicación ya fue publicada' });
  }

  await supabase
    .from('posts')
    .update({
      approval_status: 'approved',
      approved_by: req.user!.id,
      status: 'scheduled',
      error_message: null,
    })
    .eq('id', postId);

  const publishResult = await publishSinglePost({ ...post, approval_status: 'approved', status: 'scheduled' });
  res.json(publishResult);
}));

app.post('/api/posts/:id/reject', authMiddleware, roleGuard('super_admin', 'admin_sucursal', 'aprobador'), asyncHandler(async (req, res) => {
  const supabase = getSupabaseAdmin();
  const postId = String(req.params.id);
  const branchId = await getPostBranchId(supabase, postId);
  assertBranchAccess(req.user!, branchId);

  const { error } = await supabase
    .from('posts')
    .update({ approval_status: 'rejected', status: 'draft' })
    .eq('id', postId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ success: true });
}));

app.post('/api/tiktok/script', authMiddleware, asyncHandler(async (req, res) => {
  const { caption, post_type } = req.body;
  const script = generateTikTokScript(caption || '', post_type || 'promocion');
  res.json({ script });
}));

app.get('/api/dashboard/stats', authMiddleware, asyncHandler(async (req, res) => {
  const supabase = getSupabaseAdmin();
  const branchFilter = req.user!.role === 'super_admin' ? null : req.user!.branchId;

  let query = supabase.from('posts').select('status, platform, approval_status');
  if (branchFilter) query = query.eq('branch_id', branchFilter);

  const { data: posts, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const stats = {
    scheduled: posts?.filter((p) => p.status === 'scheduled').length || 0,
    published: posts?.filter((p) => p.status === 'published').length || 0,
    failed: posts?.filter((p) => p.status === 'failed').length || 0,
    pending_approval: posts?.filter((p) => p.approval_status === 'pending').length || 0,
    by_platform: {
      facebook: posts?.filter((p) => p.platform === 'facebook').length || 0,
      instagram: posts?.filter((p) => p.platform === 'instagram').length || 0,
      tiktok: posts?.filter((p) => p.platform === 'tiktok').length || 0,
      google_business: posts?.filter((p) => p.platform === 'google_business').length || 0,
    },
  };

  res.json(stats);
}));

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  console.error('[API Error]', err.message);
  res.status(500).json({ error: err.message || 'Error interno del servidor' });
});

if (process.env.VERCEL !== '1') {
  app.listen(config.port, () => {
    console.log(`🍗 El Pollón API corriendo en http://localhost:${config.port}`);
    validateConfig().forEach((w) => console.warn(`⚠️  ${w}`));
    startLocalCron();
  });
}

export default app;
