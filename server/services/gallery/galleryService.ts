import axios from 'axios';
import sharp from 'sharp';
import { getSupabaseAdmin } from '../../utils/supabase.js';
import { config } from '../../config/index.js';
import { matchBestGalleryItem, type GalleryItem, type MatchInput } from './galleryMatcher.js';
import { renderPostImage } from '../image-generator/renderPostImage.js';
import { editGalleryImageWithAi } from './galleryAiEdit.js';

import { composeMultiGalleryCollage, uploadComposedImage } from './galleryImageComposer.js';

/** Compositor Sharp — funciona en Vercel sin Playwright/Chromium */
async function renderGalleryPhotos(params: {
  photoUrls: string[];
  offerTitle: string;
  price?: string;
  brandColor?: string;
  logoUrl?: string;
  postId?: string;
  branchId?: string;
  frameTemplateId?: string | null;
  useFrame?: boolean;
}): Promise<string> {
  const buffer = await composeMultiGalleryCollage({
    photoUrls: params.photoUrls,
    title: params.offerTitle,
    price: params.price,
    brandColor: params.brandColor,
    logoUrl: params.logoUrl,
    branchId: params.branchId,
    frameTemplateId: params.frameTemplateId,
    useFrame: params.useFrame,
  });
  return uploadComposedImage(buffer, params.postId);
}

export type ImageGenerateMode = 'template' | 'gallery_auto' | 'gallery_prompt' | 'gallery_pick';

export interface GenerateFromGalleryParams {
  mode: ImageGenerateMode;
  branchId?: string;
  branchName: string;
  offerTitle: string;
  caption?: string;
  postType?: string;
  imagePrompt?: string;
  templateSlug: string;
  price?: string;
  logoUrl?: string;
  cta?: string;
  brandColor?: string;
  postId?: string;
  galleryItemIds?: string[];
  frameTemplateId?: string | null;
  useFrame?: boolean;
}

export interface GenerateFromGalleryResult {
  url: string;
  mode: ImageGenerateMode;
  galleryItem?: GalleryItem;
  galleryItems?: GalleryItem[];
  mediaUrls?: string[];
  matchScore?: number;
  matchReason?: string;
  aiSource?: 'gemini' | 'openai' | 'composer' | 'template' | 'collage';
  aiWarning?: string;
}

export async function fetchGalleryItems(branchId?: string): Promise<GalleryItem[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('media_gallery')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (branchId) {
    query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []) as GalleryItem[];
}

export async function generatePostImage(params: GenerateFromGalleryParams): Promise<GenerateFromGalleryResult> {
  if (params.mode === 'template') {
    const url = await renderPostImage({
      templateSlug: params.templateSlug,
      branchName: params.branchName,
      offerTitle: params.offerTitle,
      price: params.price,
      logoUrl: params.logoUrl,
      cta: params.cta,
      brandColor: params.brandColor,
      postId: params.postId,
    });
    return { url, mode: 'template', aiSource: 'template' };
  }

  if (params.mode === 'gallery_pick') {
    const ids = params.galleryItemIds?.filter(Boolean) ?? [];
    if (ids.length === 0) {
      throw new Error('Selecciona al menos 1 foto de la galería (máximo 4).');
    }
    if (ids.length > 4) {
      throw new Error('Máximo 4 fotos por publicación.');
    }

    const allItems = await fetchGalleryItems(params.branchId);
    const selected = ids
      .map((id) => allItems.find((item) => item.id === id))
      .filter((item): item is GalleryItem => Boolean(item));

    if (selected.length === 0) {
      throw new Error('Las fotos seleccionadas no están disponibles en la galería.');
    }

    const mediaUrls = selected.map((item) => item.public_url);

    const url = await renderGalleryPhotos({
      photoUrls: mediaUrls,
      offerTitle: params.offerTitle,
      price: params.price,
      brandColor: params.brandColor,
      logoUrl: params.logoUrl,
      postId: params.postId,
      branchId: params.branchId,
      frameTemplateId: params.frameTemplateId,
      useFrame: params.useFrame,
    });

    return {
      url,
      mode: 'gallery_pick',
      galleryItem: selected[0],
      galleryItems: selected,
      mediaUrls,
      matchReason: selected.length === 1
        ? 'Selección manual de galería'
        : `${selected.length} fotos seleccionadas manualmente`,
      aiSource: 'collage',
    };
  }

  const items = await fetchGalleryItems(params.branchId);
  if (items.length === 0) {
    throw new Error('No hay fotos en la galería. Sube platos reales en el menú Galería primero.');
  }

  const matchInput: MatchInput = {
    title: params.offerTitle,
    caption: params.caption,
    postType: params.postType,
    branchId: params.branchId,
  };

  const match = matchBestGalleryItem(items, matchInput);
  if (!match) {
    throw new Error('No se encontró una foto compatible en la galería. Agrega más fotos con título y etiquetas.');
  }

  if (params.mode === 'gallery_auto') {
    const url = await renderGalleryPhotos({
      photoUrls: [match.item.public_url],
      offerTitle: params.offerTitle,
      price: params.price,
      brandColor: params.brandColor,
      logoUrl: params.logoUrl,
      postId: params.postId,
      branchId: params.branchId,
      frameTemplateId: params.frameTemplateId,
      useFrame: params.useFrame,
    });
    return {
      url,
      mode: 'gallery_auto',
      galleryItem: match.item,
      matchScore: match.score,
      matchReason: match.reason,
      aiSource: 'collage',
    };
  }

  // gallery_prompt — IA avanzada (Gemini gratis u OpenAI de pago) o compositor
  const prompt = params.imagePrompt?.trim() || `Presentación profesional de ${params.offerTitle}`;

  const ai = await editGalleryImageWithAi({
    photoUrl: match.item.public_url,
    prompt,
    title: params.offerTitle,
    price: params.price,
    brandColor: params.brandColor,
  });

  return {
    url: ai.url,
    mode: 'gallery_prompt',
    galleryItem: match.item,
    matchScore: match.score,
    matchReason: match.reason,
    aiSource: ai.source,
    aiWarning: ai.warning,
  };
}

export async function importGalleryFromUrl(
  url: string,
  meta: { title: string; description?: string; tags?: string[]; dish_type?: string; branch_id?: string; created_by?: string }
): Promise<GalleryItem> {
  const { data: imageData } = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    maxContentLength: 10 * 1024 * 1024,
  });

  const buffer = Buffer.from(imageData);
  const optimized = await sharp(buffer)
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();

  const supabase = getSupabaseAdmin();
  const branchPart = meta.branch_id || 'global';
  const filePath = `${branchPart}/${Date.now()}-${sanitizeFilename(meta.title)}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(config.supabase.galleryBucket)
    .upload(filePath, optimized, { contentType: 'image/jpeg', upsert: false });

  if (uploadError) throw new Error(`Error subiendo imagen: ${uploadError.message}`);

  const { data: publicData } = supabase.storage.from(config.supabase.galleryBucket).getPublicUrl(filePath);

  const { data, error } = await supabase
    .from('media_gallery')
    .insert({
      branch_id: meta.branch_id || null,
      title: meta.title,
      description: meta.description || null,
      tags: meta.tags || [],
      dish_type: meta.dish_type || null,
      file_path: filePath,
      public_url: publicData.publicUrl,
      source: 'url',
      created_by: meta.created_by || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as GalleryItem;
}

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'foto';
}
