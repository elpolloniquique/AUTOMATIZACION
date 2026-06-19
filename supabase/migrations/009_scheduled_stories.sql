-- Historias programadas Facebook Page
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS scheduled_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  gallery_item_id UUID REFERENCES media_gallery(id) ON DELETE SET NULL,
  days_of_week INT[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6,0],
  publish_time TIME NOT NULL DEFAULT '10:00',
  timezone TEXT NOT NULL DEFAULT 'America/Santiago',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_published_at TIMESTAMPTZ,
  last_publish_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS story_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_story_id UUID REFERENCES scheduled_stories(id) ON DELETE SET NULL,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  title TEXT,
  image_url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
  external_story_id TEXT,
  story_url TEXT,
  error_message TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_stories_branch ON scheduled_stories(branch_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_stories_active ON scheduled_stories(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_story_publications_branch ON story_publications(branch_id);
CREATE INDEX IF NOT EXISTS idx_story_publications_story ON story_publications(scheduled_story_id);
CREATE INDEX IF NOT EXISTS idx_story_publications_created ON story_publications(created_at DESC);

ALTER TABLE scheduled_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scheduled_stories_super_admin" ON scheduled_stories
  FOR ALL USING (get_user_role() = 'super_admin');

CREATE POLICY "scheduled_stories_branch_select" ON scheduled_stories
  FOR SELECT USING (branch_id = get_user_branch_id());

CREATE POLICY "scheduled_stories_branch_manage" ON scheduled_stories
  FOR ALL USING (
    get_user_role() IN ('super_admin', 'admin_sucursal')
    AND (get_user_role() = 'super_admin' OR branch_id = get_user_branch_id())
  );

CREATE POLICY "story_publications_super_admin" ON story_publications
  FOR ALL USING (get_user_role() = 'super_admin');

CREATE POLICY "story_publications_branch_select" ON story_publications
  FOR SELECT USING (branch_id = get_user_branch_id());

CREATE POLICY "story_publications_branch_insert" ON story_publications
  FOR INSERT WITH CHECK (
    get_user_role() IN ('super_admin', 'admin_sucursal')
    AND (get_user_role() = 'super_admin' OR branch_id = get_user_branch_id())
  );
