-- Header y Footer 01: tipografía editable, iconos y color adaptativo
-- Ejecutar en Supabase SQL Editor

ALTER TABLE brand_frame_templates ADD COLUMN IF NOT EXISTS layout_version TEXT NOT NULL DEFAULT 'hf01';
ALTER TABLE brand_frame_templates ADD COLUMN IF NOT EXISTS footer_adaptive_color BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE brand_frame_templates ADD COLUMN IF NOT EXISTS footer_font_family TEXT NOT NULL DEFAULT 'Roboto-Black';
ALTER TABLE brand_frame_templates ADD COLUMN IF NOT EXISTS footer_whatsapp_font_size INT NOT NULL DEFAULT 28;
ALTER TABLE brand_frame_templates ADD COLUMN IF NOT EXISTS footer_website_font_size INT NOT NULL DEFAULT 26;
ALTER TABLE brand_frame_templates ADD COLUMN IF NOT EXISTS footer_cta_font_size INT NOT NULL DEFAULT 26;
ALTER TABLE brand_frame_templates ADD COLUMN IF NOT EXISTS footer_whatsapp_text_color TEXT;
ALTER TABLE brand_frame_templates ADD COLUMN IF NOT EXISTS footer_website_text_color TEXT;
ALTER TABLE brand_frame_templates ADD COLUMN IF NOT EXISTS footer_icon_size INT NOT NULL DEFAULT 46;

-- Actualizar plantilla global al diseño HF01
UPDATE brand_frame_templates SET
  name = 'Header y Footer 01',
  description = 'Diseño clásico El Pollón: header con esquina, footer inteligente con WhatsApp, PIDE AHORA y web. Tipografía grande y legible.',
  layout_version = 'hf01',
  footer_adaptive_color = true,
  footer_font_family = 'Roboto-Black',
  footer_whatsapp_font_size = 28,
  footer_website_font_size = 26,
  footer_cta_font_size = 26,
  footer_icon_size = 46,
  footer_height = 132,
  footer_cta_text = 'PIDE AHORA!',
  text_color = '#ffffff',
  cta_text_color = '#c50000',
  cta_bg_color = '#ffffff'
WHERE branch_id IS NULL AND is_default = true;
