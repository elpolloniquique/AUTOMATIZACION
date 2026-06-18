-- Galería de fotos reales - El Pollón
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS media_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  dish_type TEXT,
  file_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'upload' CHECK (source IN ('upload', 'url')),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_gallery_branch ON media_gallery(branch_id);
CREATE INDEX IF NOT EXISTS idx_media_gallery_active ON media_gallery(is_active);
CREATE INDEX IF NOT EXISTS idx_media_gallery_dish ON media_gallery(dish_type);

ALTER TABLE media_gallery ENABLE ROW LEVEL SECURITY;

-- Lectura: usuarios autenticados ven global (sin sucursal) + su sucursal
CREATE POLICY "gallery_select" ON media_gallery
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND (
      branch_id IS NULL
      OR branch_id = get_user_branch_id()
      OR get_user_role() = 'super_admin'
    )
  );

-- Escritura: super_admin todo; otros su sucursal o global si super_admin
CREATE POLICY "gallery_insert" ON media_gallery
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND (
      get_user_role() = 'super_admin'
      OR branch_id = get_user_branch_id()
      OR branch_id IS NULL AND get_user_role() IN ('super_admin', 'admin_sucursal')
    )
  );

CREATE POLICY "gallery_update" ON media_gallery
  FOR UPDATE USING (
    get_user_role() = 'super_admin'
    OR branch_id = get_user_branch_id()
    OR (branch_id IS NULL AND get_user_role() IN ('super_admin', 'admin_sucursal'))
  );

CREATE POLICY "gallery_delete" ON media_gallery
  FOR DELETE USING (
    get_user_role() = 'super_admin'
    OR branch_id = get_user_branch_id()
    OR (branch_id IS NULL AND get_user_role() IN ('super_admin', 'admin_sucursal'))
  );

-- Bucket media-gallery (crear manualmente en Storage si no existe: público)
INSERT INTO storage.buckets (id, name, public)
VALUES ('media-gallery', 'media-gallery', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "media_gallery_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'media-gallery');

CREATE POLICY "media_gallery_auth_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'media-gallery'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "media_gallery_auth_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'media-gallery'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "media_gallery_auth_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'media-gallery'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "media_gallery_service" ON storage.objects
  FOR ALL USING (bucket_id = 'media-gallery' AND auth.role() = 'service_role');
