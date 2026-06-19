import { getSupabaseAdmin } from '../../utils/supabase.js';
import { POLLON_BRAND } from '../../constants/pollonBrand.js';

export interface FrameConfig {
  whatsappDisplay: string;
  websiteDisplay: string;
  ctaText: string;
  showWhatsapp: boolean;
  showWebsite: boolean;
  showCta: boolean;
  showFooterLogo: boolean;
  showHeaderLogo: boolean;
  footerHeight: number;
  headerStyle: 'corner' | 'bar' | 'minimal';
  cornerSize: number;
  accentColor?: string;
  footerBgColor?: string;
  ctaBgColor: string;
  ctaTextColor?: string;
  whatsappIconColor: string;
  websiteIconColor: string;
  textColor: string;
}

export interface FrameTemplateRow {
  id: string;
  branch_id: string | null;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  header_style: string;
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

function formatWhatsappDisplay(raw: string | null | undefined): string {
  if (!raw) return POLLON_BRAND.whatsappPhone;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('569')) {
    return `+56 9 ${digits.slice(3, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 9) {
    return `+56 9 ${digits.slice(0, 4)} ${digits.slice(4)}`;
  }
  return raw.replace(/[^\x20-\x7E]/g, '').slice(0, 22);
}

function formatWebsiteDisplay(raw: string | null | undefined): string {
  if (!raw) return POLLON_BRAND.websiteDisplay;
  return raw
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '')
    .replace(/[^\x20-\x7E]/g, '')
    .slice(0, 28);
}

export function defaultFrameConfig(): FrameConfig {
  return {
    whatsappDisplay: POLLON_BRAND.whatsappPhone,
    websiteDisplay: POLLON_BRAND.websiteDisplay,
    ctaText: 'PIDE AHORA!',
    showWhatsapp: true,
    showWebsite: true,
    showCta: true,
    showFooterLogo: true,
    showHeaderLogo: true,
    footerHeight: 118,
    headerStyle: 'corner',
    cornerSize: 300,
    ctaBgColor: '#ffffff',
    whatsappIconColor: '#25D366',
    websiteIconColor: '#4A7FD6',
    textColor: '#ffffff',
  };
}

export function templateRowToConfig(
  template: FrameTemplateRow | null,
  branch?: { whatsapp?: string | null; website?: string | null; brand_color?: string | null } | null,
): FrameConfig {
  const base = defaultFrameConfig();

  const whatsappRaw = template?.footer_whatsapp_display
    || template?.footer_whatsapp
    || branch?.whatsapp;
  const websiteRaw = template?.footer_website_display
    || template?.footer_website
    || branch?.website;

  return {
    whatsappDisplay: formatWhatsappDisplay(whatsappRaw),
    websiteDisplay: formatWebsiteDisplay(websiteRaw),
    ctaText: (template?.footer_cta_text || base.ctaText).replace(/[^\x20-\x7E¡!]/g, '').slice(0, 24) || 'PIDE AHORA!',
    showWhatsapp: template?.footer_show_whatsapp ?? base.showWhatsapp,
    showWebsite: template?.footer_show_website ?? base.showWebsite,
    showCta: template?.footer_show_cta ?? base.showCta,
    showFooterLogo: template?.footer_show_footer_logo ?? base.showFooterLogo,
    showHeaderLogo: template?.header_show_logo ?? base.showHeaderLogo,
    footerHeight: template?.footer_height ?? base.footerHeight,
    headerStyle: (template?.header_style as FrameConfig['headerStyle']) || base.headerStyle,
    cornerSize: template?.header_corner_size ?? base.cornerSize,
    accentColor: template?.accent_color || branch?.brand_color || undefined,
    footerBgColor: template?.footer_bg_color || undefined,
    ctaBgColor: template?.cta_bg_color || base.ctaBgColor,
    ctaTextColor: template?.cta_text_color || undefined,
    whatsappIconColor: template?.whatsapp_icon_color || base.whatsappIconColor,
    websiteIconColor: template?.website_icon_color || base.websiteIconColor,
    textColor: template?.text_color || base.textColor,
  };
}

export async function resolveFrameConfig(
  branchId?: string,
  frameTemplateId?: string | null,
): Promise<FrameConfig> {
  if (!branchId) return defaultFrameConfig();

  const supabase = getSupabaseAdmin();
  const { data: branch, error: branchError } = await supabase
    .from('branches')
    .select('whatsapp, website, brand_color, frame_template_id')
    .eq('id', branchId)
    .maybeSingle();

  if (branchError || !branch) return defaultFrameConfig();

  if (frameTemplateId) {
    const { data: picked } = await supabase
      .from('brand_frame_templates')
      .select('*')
      .eq('id', frameTemplateId)
      .eq('is_active', true)
      .maybeSingle();
    if (picked) return templateRowToConfig(picked as FrameTemplateRow, branch);
  }

  let template: FrameTemplateRow | null = null;

  if (branch.frame_template_id) {
    const { data } = await supabase
      .from('brand_frame_templates')
      .select('*')
      .eq('id', branch.frame_template_id)
      .eq('is_active', true)
      .maybeSingle();
    template = data as FrameTemplateRow | null;
  }

  if (!template) {
    const { data } = await supabase
      .from('brand_frame_templates')
      .select('*')
      .eq('branch_id', branchId)
      .eq('is_default', true)
      .eq('is_active', true)
      .maybeSingle();
    template = data as FrameTemplateRow | null;
  }

  if (!template) {
    const { data } = await supabase
      .from('brand_frame_templates')
      .select('*')
      .is('branch_id', null)
      .eq('is_default', true)
      .eq('is_active', true)
      .maybeSingle();
    template = data as FrameTemplateRow | null;
  }

  return templateRowToConfig(template, branch);
}

export function buildTemplatePayload(body: Record<string, unknown>) {
  return {
    branch_id: body.branch_id || null,
    name: body.name,
    description: body.description || null,
    is_default: Boolean(body.is_default),
    is_active: body.is_active !== false,
    header_style: body.header_style || 'corner',
    header_show_logo: body.header_show_logo !== false,
    header_corner_size: Number(body.header_corner_size) || 300,
    footer_whatsapp: body.footer_whatsapp || null,
    footer_whatsapp_display: body.footer_whatsapp_display || null,
    footer_website: body.footer_website || null,
    footer_website_display: body.footer_website_display || null,
    footer_cta_text: body.footer_cta_text || 'PIDE AHORA!',
    footer_show_whatsapp: body.footer_show_whatsapp !== false,
    footer_show_website: body.footer_show_website !== false,
    footer_show_cta: body.footer_show_cta !== false,
    footer_show_footer_logo: body.footer_show_footer_logo !== false,
    footer_height: Number(body.footer_height) || 118,
    accent_color: body.accent_color || null,
    footer_bg_color: body.footer_bg_color || null,
    cta_bg_color: body.cta_bg_color || '#ffffff',
    cta_text_color: body.cta_text_color || null,
    whatsapp_icon_color: body.whatsapp_icon_color || '#25D366',
    website_icon_color: body.website_icon_color || '#4A7FD6',
    text_color: body.text_color || '#ffffff',
    updated_at: new Date().toISOString(),
  };
}
