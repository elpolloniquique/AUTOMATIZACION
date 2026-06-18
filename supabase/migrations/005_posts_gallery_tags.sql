-- Posts: soporte multi-foto de galería e historial de republicación
ALTER TABLE posts ADD COLUMN IF NOT EXISTS gallery_item_ids UUID[] DEFAULT '{}';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_urls TEXT[] DEFAULT '{}';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_mode TEXT DEFAULT 'gallery_auto';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS source_post_id UUID REFERENCES posts(id) ON DELETE SET NULL;

-- Catálogo de etiquetas para IA y hashtags
CREATE TABLE IF NOT EXISTS content_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('marca', 'plato', 'promo', 'ubicacion', 'general')),
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (branch_id, name)
);

CREATE INDEX IF NOT EXISTS idx_content_tags_branch ON content_tags(branch_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_posts_source ON posts(source_post_id) WHERE source_post_id IS NOT NULL;

-- Etiquetas iniciales El Pollón
INSERT INTO content_tags (name, category, sort_order) VALUES
  ('ElPollon', 'marca', 1),
  ('PolloALaBrasa', 'marca', 2),
  ('PolleriaPeruana', 'marca', 3),
  ('ComidaPeruana', 'plato', 10),
  ('Chaufa', 'plato', 11),
  ('ArrozConPollo', 'plato', 12),
  ('ComboFamiliar', 'plato', 13),
  ('Oferton', 'promo', 20),
  ('Promocion', 'promo', 21),
  ('Delivery', 'promo', 22),
  ('Iquique', 'ubicacion', 30),
  ('AltoHospicio', 'ubicacion', 31),
  ('Tarapaca', 'ubicacion', 32)
ON CONFLICT DO NOTHING;

ALTER TABLE content_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_tags_select" ON content_tags
  FOR SELECT USING (
    get_user_role() = 'super_admin'
    OR branch_id IS NULL
    OR branch_id = get_user_branch_id()
  );

CREATE POLICY "content_tags_manage" ON content_tags
  FOR ALL USING (
    get_user_role() IN ('super_admin', 'admin_sucursal')
    AND (get_user_role() = 'super_admin' OR branch_id IS NULL OR branch_id = get_user_branch_id())
  );
