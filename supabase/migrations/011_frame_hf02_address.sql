-- HF02 v2: direccion en footer + colores amarillo/rojo del mockup
-- Ejecutar en Supabase SQL Editor

ALTER TABLE brand_frame_templates ADD COLUMN IF NOT EXISTS footer_address TEXT;
ALTER TABLE brand_frame_templates ADD COLUMN IF NOT EXISTS footer_address_display TEXT;
ALTER TABLE brand_frame_templates ADD COLUMN IF NOT EXISTS footer_show_address BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE brand_frame_templates ADD COLUMN IF NOT EXISTS footer_address_font_size INT;
ALTER TABLE brand_frame_templates ADD COLUMN IF NOT EXISTS footer_address_text_color TEXT;

UPDATE brand_frame_templates SET
  footer_bg_color = '#F2B705',
  accent_color = '#F2B705',
  footer_address_display = COALESCE(footer_address_display, 'Vivar 1086, Iquique'),
  footer_show_address = true,
  footer_address_font_size = COALESCE(footer_address_font_size, 22),
  footer_address_text_color = COALESCE(footer_address_text_color, '#000000'),
  footer_height = 145,
  footer_cta_text = 'ORDENA AHORA!',
  cta_bg_color = '#C40000',
  whatsapp_icon_color = '#C40000',
  website_icon_color = '#C40000',
  footer_whatsapp_text_color = '#000000',
  footer_website_text_color = '#000000',
  text_color = '#000000',
  footer_whatsapp_font_size = 22,
  footer_website_font_size = 22,
  footer_cta_font_size = 26,
  footer_icon_size = 42
WHERE layout_version = 'hf02';
