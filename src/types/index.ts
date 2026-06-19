export type UserRole = 'super_admin' | 'admin_sucursal' | 'creador_contenido' | 'aprobador';

export type Platform = 'facebook' | 'instagram' | 'tiktok' | 'google_business';

export type PostType =
  | 'oferta'
  | 'combo'
  | 'delivery'
  | 'testimonio'
  | 'horario'
  | 'promocion'
  | 'fecha_especial'
  | 'producto_destacado';

export type PostStatus =
  | 'draft'
  | 'pending_approval'
  | 'scheduled'
  | 'published'
  | 'failed'
  | 'manual_required';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  branch_id: string | null;
  created_at: string;
}

export interface Branch {
  id: string;
  name: string;
  city: string;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  opening_hours: string | null;
  logo_url: string | null;
  brand_color: string;
  website: string | null;
  frame_template_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface BrandFrameTemplate {
  id: string;
  branch_id: string | null;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  layout_version?: string;
  header_style: 'corner' | 'bar' | 'minimal';
  header_show_logo: boolean;
  header_corner_size: number;
  footer_whatsapp: string | null;
  footer_whatsapp_display: string | null;
  footer_website: string | null;
  footer_website_display: string | null;
  footer_cta_text: string;
  footer_show_whatsapp: boolean;
  footer_show_website: boolean;
  footer_show_cta: boolean;
  footer_show_footer_logo: boolean;
  footer_height: number;
  footer_adaptive_color?: boolean;
  footer_font_family?: 'Roboto-Bold' | 'Roboto-Black';
  footer_whatsapp_font_size?: number;
  footer_website_font_size?: number;
  footer_cta_font_size?: number;
  footer_whatsapp_text_color?: string | null;
  footer_website_text_color?: string | null;
  footer_icon_size?: number;
  accent_color: string | null;
  footer_bg_color: string | null;
  cta_bg_color: string | null;
  cta_text_color: string | null;
  whatsapp_icon_color: string | null;
  website_icon_color: string | null;
  text_color: string | null;
  created_at: string;
  updated_at: string;
}

export interface SocialAccount {
  id: string;
  branch_id: string;
  platform: Platform;
  account_name: string | null;
  account_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  is_connected: boolean;
  created_at: string;
}

export interface ScheduledStory {
  id: string;
  branch_id: string;
  created_by: string | null;
  title: string;
  image_url: string;
  gallery_item_id: string | null;
  days_of_week: number[];
  publish_time: string;
  timezone: string;
  is_active: boolean;
  last_published_at: string | null;
  last_publish_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoryPublication {
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
  scheduled_stories?: { title: string } | null;
}

export interface PostTemplate {
  id: string;
  name: string;
  type: PostType;
  platform: string;
  html_template: string | null;
  html_content: string | null;
  default_caption: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Post {
  id: string;
  branch_id: string;
  created_by: string | null;
  approved_by: string | null;
  title: string;
  caption: string | null;
  hashtags: string[] | null;
  cta: string | null;
  platform: Platform;
  post_type: PostType;
  media_url: string | null;
  generated_image_url: string | null;
  media_urls: string[] | null;
  gallery_item_ids: string[] | null;
  image_mode: ImageGenerateMode | null;
  source_post_id: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  status: PostStatus;
  approval_status: ApprovalStatus;
  external_post_id: string | null;
  error_message: string | null;
  template_id: string | null;
  price: string | null;
  product_name: string | null;
  created_at: string;
  updated_at: string;
  branches?: Branch;
}

export interface PostLog {
  id: string;
  post_id: string;
  platform: string;
  action: string;
  status: string;
  request_payload: unknown;
  response_payload: unknown;
  error_message: string | null;
  created_at: string;
}

export type ImageGenerateMode = 'template' | 'gallery_auto' | 'gallery_prompt' | 'gallery_pick';

export type ContentTagCategory = 'marca' | 'plato' | 'promo' | 'ubicacion' | 'general';

export interface ContentTag {
  id: string;
  branch_id: string | null;
  name: string;
  category: ContentTagCategory;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export const TAG_CATEGORY_LABELS: Record<ContentTagCategory, string> = {
  marca: 'Marca',
  plato: 'Plato',
  promo: 'Promoción',
  ubicacion: 'Ubicación',
  general: 'General',
};

export interface MediaGalleryItem {
  id: string;
  branch_id: string | null;
  title: string;
  description: string | null;
  tags: string[] | null;
  dish_type: string | null;
  file_path: string;
  public_url: string;
  source: 'upload' | 'url';
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface ImageGenerateResult {
  url: string;
  mode: ImageGenerateMode;
  galleryItem?: MediaGalleryItem;
  galleryItems?: MediaGalleryItem[];
  mediaUrls?: string[];
  matchScore?: number;
  matchReason?: string;
  aiSource?: 'gemini' | 'openai' | 'composer' | 'template' | 'collage';
  aiWarning?: string;
}

export interface DashboardStats {
  scheduled: number;
  published: number;
  failed: number;
  pending_approval: number;
  by_platform: Record<Platform, number>;
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  google_business: 'Google Business',
};

export const STATUS_LABELS: Record<PostStatus, string> = {
  draft: 'Borrador',
  pending_approval: 'Pendiente',
  scheduled: 'Programada',
  published: 'Publicada',
  failed: 'Fallida',
  manual_required: 'Acción manual',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin_sucursal: 'Admin Sucursal',
  creador_contenido: 'Creador',
  aprobador: 'Aprobador',
};

export const POST_TYPE_LABELS: Record<PostType, string> = {
  oferta: 'Oferta',
  combo: 'Combo',
  delivery: 'Delivery',
  testimonio: 'Testimonio',
  horario: 'Horario',
  promocion: 'Promoción',
  fecha_especial: 'Fecha especial',
  producto_destacado: 'Producto destacado',
};
