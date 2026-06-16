import express from 'express';
import cors from 'cors';
import { config, validateConfig } from './config/index.js';
import { startLocalCron } from './scheduler/localCron.js';
import { authMiddleware } from './utils/authMiddleware.js';
import { roleGuard, cronGuard } from './utils/roleGuard.js';
import { publishDuePosts, publishSinglePost } from './jobs/publishDuePosts.js';
import { generateContent } from './services/ai/contentGenerator.js';
import { renderPostImage, AVAILABLE_TEMPLATES } from './services/image-generator/renderPostImage.js';
import { testFacebookConnection } from './services/meta/facebookPublisher.js';
import { testInstagramConnection } from './services/meta/instagramPublisher.js';
import { testGoogleBusinessConnection } from './services/google-business/googleBusinessPublisher.js';
import { generateTikTokScript } from './services/tiktok/tiktokPublisher.js';
import { getSupabaseAdmin } from './utils/supabase.js';
import { z } from 'zod';

const app = express();

app.use(cors({ origin: config.appUrl, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  const warnings = validateConfig();
  res.json({ status: 'ok', warnings });
});

// Cron endpoint (GitHub Actions)
app.post('/api/cron/publish-due-posts', cronGuard, async (_req, res) => {
  try {
    const result = await publishDuePosts();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error en cron' });
  }
});

// AI content generation
app.post('/api/ai/generate', authMiddleware, async (req, res) => {
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
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
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
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error generando contenido' });
  }
});

// Image generation
app.post('/api/images/generate', authMiddleware, async (req, res) => {
  const schema = z.object({
    template_slug: z.string(),
    branch_name: z.string(),
    offer_title: z.string(),
    price: z.string().optional(),
    product_image_url: z.string().optional(),
    logo_url: z.string().optional(),
    cta: z.string().optional(),
    brand_color: z.string().optional(),
    post_id: z.string().uuid().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const url = await renderPostImage({
      templateSlug: parsed.data.template_slug,
      branchName: parsed.data.branch_name,
      offerTitle: parsed.data.offer_title,
      price: parsed.data.price,
      productImageUrl: parsed.data.product_image_url,
      logoUrl: parsed.data.logo_url,
      cta: parsed.data.cta,
      brandColor: parsed.data.brand_color,
      postId: parsed.data.post_id,
    });
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error generando imagen' });
  }
});

app.get('/api/images/templates', authMiddleware, (_req, res) => {
  res.json(AVAILABLE_TEMPLATES);
});

// Test social connections
app.post('/api/social/test', authMiddleware, roleGuard('super_admin', 'admin_sucursal'), async (req, res) => {
  const schema = z.object({
    platform: z.enum(['facebook', 'instagram', 'tiktok', 'google_business']),
    account_id: z.string(),
    access_token: z.string(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

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
    case 'tiktok':
      result = { ok: false, error: 'TikTok API pendiente de aprobación. Configura OAuth cuando esté disponible.' };
      break;
  }

  res.json(result);
});

// Publish test post
app.post('/api/social/publish-test', authMiddleware, roleGuard('super_admin', 'admin_sucursal'), async (req, res) => {
  const schema = z.object({ post_id: z.string().uuid() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const supabase = getSupabaseAdmin();
  const { data: post, error } = await supabase.from('posts').select('*').eq('id', parsed.data.post_id).single();
  if (error || !post) return res.status(404).json({ error: 'Publicación no encontrada' });

  const result = await publishSinglePost(post);
  res.json(result);
});

// Retry failed post
app.post('/api/posts/:id/retry', authMiddleware, async (req, res) => {
  const supabase = getSupabaseAdmin();
  const { data: post, error } = await supabase.from('posts').select('*').eq('id', req.params.id).single();
  if (error || !post) return res.status(404).json({ error: 'Publicación no encontrada' });

  await supabase.from('posts').update({ status: 'scheduled', error_message: null }).eq('id', post.id);
  const result = await publishSinglePost(post);
  res.json(result);
});

// Approve post
app.post('/api/posts/:id/approve', authMiddleware, roleGuard('super_admin', 'admin_sucursal', 'aprobador'), async (req, res) => {
  const supabase = getSupabaseAdmin();
  const { data: post } = await supabase.from('posts').select('branch_id').eq('id', req.params.id).single();

  if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });
  if (req.user!.role !== 'super_admin' && req.user!.branchId !== post.branch_id) {
    return res.status(403).json({ error: 'Sin permisos para esta sucursal' });
  }

  const { error } = await supabase
    .from('posts')
    .update({
      approval_status: 'approved',
      approved_by: req.user!.id,
      status: 'scheduled',
    })
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Reject post
app.post('/api/posts/:id/reject', authMiddleware, roleGuard('super_admin', 'admin_sucursal', 'aprobador'), async (req, res) => {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('posts')
    .update({ approval_status: 'rejected', status: 'draft' })
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// TikTok script
app.post('/api/tiktok/script', authMiddleware, (req, res) => {
  const { caption, post_type } = req.body;
  const script = generateTikTokScript(caption || '', post_type || 'promocion');
  res.json({ script });
});

// Dashboard stats
app.get('/api/dashboard/stats', authMiddleware, async (req, res) => {
  const supabase = getSupabaseAdmin();
  const branchFilter = req.user!.role === 'super_admin' ? null : req.user!.branchId;

  let query = supabase.from('posts').select('status, platform, approval_status', { count: 'exact' });
  if (branchFilter) query = query.eq('branch_id', branchFilter);

  const { data: posts } = await query;

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
});

// Local dev server
if (process.env.VERCEL !== '1') {
  app.listen(config.port, () => {
    console.log(`🍗 El Pollón API corriendo en http://localhost:${config.port}`);
    validateConfig().forEach((w) => console.warn(`⚠️  ${w}`));
    startLocalCron();
  });
}

export default app;
