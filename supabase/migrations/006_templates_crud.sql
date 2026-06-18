-- Plantillas: HTML personalizado en BD + permisos admin sucursal
ALTER TABLE post_templates ADD COLUMN IF NOT EXISTS html_content TEXT;
ALTER TABLE post_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE FUNCTION update_post_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS post_templates_updated_at ON post_templates;
CREATE TRIGGER post_templates_updated_at
  BEFORE UPDATE ON post_templates
  FOR EACH ROW EXECUTE FUNCTION update_post_templates_updated_at();

-- Admin sucursal puede gestionar plantillas
DROP POLICY IF EXISTS "templates_select" ON post_templates;
CREATE POLICY "templates_select" ON post_templates
  FOR SELECT USING (
    is_active = true
    OR get_user_role() IN ('super_admin', 'admin_sucursal')
  );

DROP POLICY IF EXISTS "admin_templates_manage" ON post_templates;
CREATE POLICY "admin_templates_manage" ON post_templates
  FOR ALL USING (get_user_role() IN ('super_admin', 'admin_sucursal'));
