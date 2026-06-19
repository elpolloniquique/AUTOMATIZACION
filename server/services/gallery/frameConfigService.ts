import { getSupabaseAdmin } from '../../utils/supabase.js';
import { POLLON_BRAND } from '../../constants/pollonBrand.js';
import type { FooterFontFamily } from './frameTextRenderer.js';

export interface FrameConfig {
  layoutVersion: string;
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
  footerAdaptiveColor: boolean;
  ctaBgColor: string;
  ctaTextColor?: string;
  whatsappIconColor: string;
  websiteIconColor: string;
  textColor: string;
  whatsappTextColor?: string;
  websiteTextColor?: string;
  footerFontFamily: FooterFontFamily;
  whatsappFontSize: number;
  websiteFontSize: number;
  ctaFontSize: number;
  footerIconSize: number;
}

export interface FrameTemplateRow {
  id: string;
  branch_id: string | null;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  layout_version?: string | null;
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
  footer_adaptive_color?: boolean | null;
  footer_font_family?: string | null;
  footer_whatsapp_font_size?: number | null;
  footer_website_font_size?: number | null;
  footer_cta_font_size?: number | null;
  footer_whatsapp_text_color?: string | null;
  footer_website_text_color?: string | null;
  footer_icon_size?: number | null;
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

function parseFontFamily(raw: string | null | undefined): FooterFontFamily {
  if (raw === 'Roboto-Bold') return 'Roboto-Bold';
  return 'Roboto-Black';
}

export function defaultFrameConfig(layout: string = 'hf01'): FrameConfig {
  if (layout === 'hf02') {
    return {
      layoutVersion: 'hf02',
      whatsappDisplay: POLLON_BRAND.whatsappPhone,
      websiteDisplay: POLLON_BRAND.websiteDisplay,
      ctaText: 'ORDENA AHORA!',
      showWhatsapp: true,
      showWebsite: true,
      showCta: true,
      showFooterLogo: false,
      showHeaderLogo: true,
      footerHeight: 130,
      headerStyle: 'minimal',
      cornerSize: 300,
      footerAdaptiveColor: true,
      ctaBgColor: '#c50000',
      ctaTextColor: '#ffffff',
      whatsappIconColor: '#c50000',
      websiteIconColor: '#c50000',
      textColor: '#000000',
      whatsappTextColor: '#000000',
      websiteTextColor: '#000000',
      footerBgColor: '#F59E0B',
      footerFontFamily: 'Roboto-Black',
      whatsappFontSize: 26,
      websiteFontSize: 26,
      ctaFontSize: 24,
      footerIconSize: 44,
    };
  }

  return {
    layoutVersion: 'hf01',
    whatsappDisplay: POLLON_BRAND.whatsappPhone,
    websiteDisplay: POLLON_BRAND.websiteDisplay,
    ctaText: 'PIDE AHORA!',
    showWhatsapp: true,
    showWebsite: true,
    showCta: true,
    showFooterLogo: true,
    showHeaderLogo: true,
    footerHeight: 132,
    headerStyle: 'corner',
    cornerSize: 300,
    footerAdaptiveColor: true,
    ctaBgColor: '#ffffff',
    ctaTextColor: '#c50000',
    whatsappIconColor: '#25D366',
    websiteIconColor: '#4A7FD6',
    textColor: '#ffffff',
    footerFontFamily: 'Roboto-Black',
    whatsappFontSize: 28,
    websiteFontSize: 26,
    ctaFontSize: 26,
    footerIconSize: 46,
  };
}

export function templateRowToConfig(
  template: FrameTemplateRow | null,
  branch?: { whatsapp?: string | null; website?: string | null; brand_color?: string | null } | null,
): FrameConfig {
  const layout = template?.layout_version || 'hf01';
  const base = defaultFrameConfig(layout);

  const whatsappRaw = template?.footer_whatsapp_display
    || template?.footer_whatsapp
    || branch?.whatsapp;
  const websiteRaw = template?.footer_website_display
    || template?.footer_website
    || branch?.website;

  return {
    layoutVersion: template?.layout_version || base.layoutVersion,
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
    footerAdaptiveColor: template?.footer_adaptive_color ?? base.footerAdaptiveColor,
    ctaBgColor: template?.cta_bg_color || base.ctaBgColor,
    ctaTextColor: template?.cta_text_color || base.ctaTextColor,
    whatsappIconColor: template?.whatsapp_icon_color || base.whatsappIconColor,
    websiteIconColor: template?.website_icon_color || base.websiteIconColor,
    textColor: template?.text_color || base.textColor,
    whatsappTextColor: template?.footer_whatsapp_text_color || undefined,
    websiteTextColor: template?.footer_website_text_color || undefined,
    footerFontFamily: parseFontFamily(template?.footer_font_family),
    whatsappFontSize: template?.footer_whatsapp_font_size ?? base.whatsappFontSize,
    websiteFontSize: template?.footer_website_font_size ?? base.websiteFontSize,
    ctaFontSize: template?.footer_cta_font_size ?? base.ctaFontSize,
    footerIconSize: template?.footer_icon_size ?? base.footerIconSize,
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
    layout_version: body.layout_version || 'hf01',
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
    footer_height: Number(body.footer_height) || (body.layout_version === 'hf02' ? 130 : 132),
    footer_adaptive_color: body.footer_adaptive_color !== false,
    footer_font_family: body.footer_font_family || 'Roboto-Black',
    footer_whatsapp_font_size: Number(body.footer_whatsapp_font_size) || 28,
    footer_website_font_size: Number(body.footer_website_font_size) || 26,
    footer_cta_font_size: Number(body.footer_cta_font_size) || 26,
    footer_whatsapp_text_color: body.footer_whatsapp_text_color || null,
    footer_website_text_color: body.footer_website_text_color || null,
    footer_icon_size: Number(body.footer_icon_size) || 46,
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

/** Convierte datos del API preview/CRUD a fila de plantilla */
export function bodyToTemplateRow(data: Record<string, unknown>, branchId?: string | null): FrameTemplateRow {
  return {
    id: 'preview',
    branch_id: branchId || null,
    name: String(data.name || 'Preview'),
    description: (data.description as string) || null,
    is_default: Boolean(data.is_default),
    is_active: true,
    layout_version: (data.layout_version as string) || 'hf01',
    header_style: (data.header_style as string) || 'corner',
    header_show_logo: data.header_show_logo !== false,
    header_corner_size: Number(data.header_corner_size) || 300,
    footer_whatsapp: (data.footer_whatsapp as string) || null,
    footer_whatsapp_display: (data.footer_whatsapp_display as string) || null,
    footer_website: (data.footer_website as string) || null,
    footer_website_display: (data.footer_website_display as string) || null,
    footer_cta_text: (data.footer_cta_text as string) || 'PIDE AHORA!',
    footer_show_whatsapp: data.footer_show_whatsapp !== false,
    footer_show_website: data.footer_show_website !== false,
    footer_show_cta: data.footer_show_cta !== false,
    footer_show_footer_logo: data.footer_show_footer_logo !== false,
    footer_height: Number(data.footer_height) || 132,
    footer_adaptive_color: data.footer_adaptive_color !== false,
    footer_font_family: (data.footer_font_family as string) || 'Roboto-Black',
    footer_whatsapp_font_size: Number(data.footer_whatsapp_font_size) || 28,
    footer_website_font_size: Number(data.footer_website_font_size) || 26,
    footer_cta_font_size: Number(data.footer_cta_font_size) || 26,
    footer_whatsapp_text_color: (data.footer_whatsapp_text_color as string) || null,
    footer_website_text_color: (data.footer_website_text_color as string) || null,
    footer_icon_size: Number(data.footer_icon_size) || 46,
    accent_color: (data.accent_color as string) || null,
    footer_bg_color: (data.footer_bg_color as string) || null,
    cta_bg_color: (data.cta_bg_color as string) || '#ffffff',
    cta_text_color: (data.cta_text_color as string) || null,
    whatsapp_icon_color: (data.whatsapp_icon_color as string) || '#25D366',
    website_icon_color: (data.website_icon_color as string) || '#4A7FD6',
    text_color: (data.text_color as string) || '#ffffff',
    created_at: '',
    updated_at: '',
  };
}
