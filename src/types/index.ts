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
  is_active: boolean;
  created_at: string;
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

export interface PostTemplate {
  id: string;
  name: string;
  type: PostType;
  platform: string;
  html_template: string | null;
  default_caption: string | null;
  is_active: boolean;
  created_at: string;
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

export type ImageGenerateMode = 'template' | 'gallery_auto' | 'gallery_prompt';

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
  matchScore?: number;
  matchReason?: string;
  aiSource?: 'openai' | 'composer' | 'template';
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
