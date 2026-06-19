-- Plantillas configurables de Header y Footer para imágenes de redes sociales
-- Ejecutar en Supabase SQL Editor

ALTER TABLE branches ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS frame_template_id UUID;

CREATE TABLE IF NOT EXISTS brand_frame_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Header
  header_style TEXT NOT NULL DEFAULT 'corner'
    CHECK (header_style IN ('corner', 'bar', 'minimal')),
  header_show_logo BOOLEAN NOT NULL DEFAULT true,
  header_corner_size INT NOT NULL DEFAULT 300,

  -- Footer contenido
  footer_whatsapp TEXT,
  footer_whatsapp_display TEXT,
  footer_website TEXT,
  footer_website_display TEXT,
  footer_cta_text TEXT NOT NULL DEFAULT 'PIDE AHORA!',
  footer_show_whatsapp BOOLEAN NOT NULL DEFAULT true,
  footer_show_website BOOLEAN NOT NULL DEFAULT true,
  footer_show_cta BOOLEAN NOT NULL DEFAULT true,
  footer_show_footer_logo BOOLEAN NOT NULL DEFAULT true,
  footer_height INT NOT NULL DEFAULT 118,

  -- Colores
  accent_color TEXT,
  footer_bg_color TEXT,
  cta_bg_color TEXT DEFAULT '#ffffff',
  cta_text_color TEXT,
  whatsapp_icon_color TEXT DEFAULT '#25D366',
  website_icon_color TEXT DEFAULT '#4A7FD6',
  text_color TEXT DEFAULT '#ffffff',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE branches
  DROP CONSTRAINT IF EXISTS branches_frame_template_id_fkey;

ALTER TABLE branches
  ADD CONSTRAINT branches_frame_template_id_fkey
  FOREIGN KEY (frame_template_id) REFERENCES brand_frame_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_frame_templates_branch ON brand_frame_templates(branch_id);
CREATE INDEX IF NOT EXISTS idx_frame_templates_default ON brand_frame_templates(branch_id, is_default) WHERE is_active = true;

-- Plantilla global por defecto (solo si no existe ninguna global)
INSERT INTO brand_frame_templates (
  branch_id, name, description, is_default, is_active,
  footer_whatsapp_display, footer_website_display, footer_cta_text
)
SELECT
  NULL,
  'El Pollón Clásico',
  'Header con esquina roja, logo circular y footer con WhatsApp, PIDE AHORA y web',
  true,
  true,
  '+56 9 8692 5310',
  'www.el-pollon.cl',
  'PIDE AHORA!'
WHERE NOT EXISTS (
  SELECT 1 FROM brand_frame_templates WHERE branch_id IS NULL AND is_default = true
);

-- Actualizar sucursales existentes con datos de contacto
UPDATE branches SET
  website = COALESCE(website, 'www.el-pollon.cl'),
  whatsapp = COALESCE(whatsapp, '+56986925310')
WHERE website IS NULL OR whatsapp IS NULL;

-- RLS
ALTER TABLE brand_frame_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "frame_templates_super_admin" ON brand_frame_templates
  FOR ALL USING (get_user_role() = 'super_admin');

CREATE POLICY "frame_templates_branch_read" ON brand_frame_templates
  FOR SELECT USING (
    get_user_role() = 'super_admin'
    OR branch_id IS NULL
    OR branch_id = get_user_branch_id()
  );

CREATE POLICY "frame_templates_branch_manage" ON brand_frame_templates
  FOR ALL USING (
    get_user_role() IN ('super_admin', 'admin_sucursal')
    AND (get_user_role() = 'super_admin' OR branch_id = get_user_branch_id())
  );
