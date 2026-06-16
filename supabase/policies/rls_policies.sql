-- Row Level Security - El Pollón Social Automation

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;

-- Helper: obtener rol del usuario actual
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_branch_id()
RETURNS UUID AS $$
  SELECT branch_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- BRANCHES
CREATE POLICY "super_admin_all_branches" ON branches
  FOR ALL USING (get_user_role() = 'super_admin');

CREATE POLICY "users_view_own_branch" ON branches
  FOR SELECT USING (
    get_user_role() = 'super_admin'
    OR id = get_user_branch_id()
  );

CREATE POLICY "admin_manage_own_branch" ON branches
  FOR UPDATE USING (
    get_user_role() IN ('super_admin', 'admin_sucursal')
    AND (get_user_role() = 'super_admin' OR id = get_user_branch_id())
  );

-- PROFILES
CREATE POLICY "users_view_profiles" ON profiles
  FOR SELECT USING (
    get_user_role() = 'super_admin'
    OR id = auth.uid()
    OR (branch_id = get_user_branch_id() AND get_user_role() IN ('admin_sucursal', 'aprobador'))
  );

CREATE POLICY "super_admin_manage_profiles" ON profiles
  FOR ALL USING (get_user_role() = 'super_admin');

CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- SOCIAL ACCOUNTS
CREATE POLICY "super_admin_social" ON social_accounts
  FOR ALL USING (get_user_role() = 'super_admin');

CREATE POLICY "branch_social_select" ON social_accounts
  FOR SELECT USING (branch_id = get_user_branch_id());

CREATE POLICY "branch_social_manage" ON social_accounts
  FOR ALL USING (
    get_user_role() IN ('super_admin', 'admin_sucursal')
    AND (get_user_role() = 'super_admin' OR branch_id = get_user_branch_id())
  );

-- POST TEMPLATES (todos pueden leer activas)
CREATE POLICY "templates_select" ON post_templates
  FOR SELECT USING (is_active = true OR get_user_role() = 'super_admin');

CREATE POLICY "super_admin_templates" ON post_templates
  FOR ALL USING (get_user_role() = 'super_admin');

-- POSTS
CREATE POLICY "super_admin_posts" ON posts
  FOR ALL USING (get_user_role() = 'super_admin');

CREATE POLICY "branch_posts_select" ON posts
  FOR SELECT USING (branch_id = get_user_branch_id());

CREATE POLICY "branch_posts_insert" ON posts
  FOR INSERT WITH CHECK (
    branch_id = get_user_branch_id()
    AND get_user_role() IN ('creador_contenido', 'admin_sucursal', 'aprobador')
  );

CREATE POLICY "branch_posts_update" ON posts
  FOR UPDATE USING (
    branch_id = get_user_branch_id()
    AND get_user_role() IN ('creador_contenido', 'admin_sucursal', 'aprobador')
  );

CREATE POLICY "approver_update_approval" ON posts
  FOR UPDATE USING (
    branch_id = get_user_branch_id()
    AND get_user_role() IN ('aprobador', 'admin_sucursal')
  );

-- POST LOGS
CREATE POLICY "super_admin_logs" ON post_logs
  FOR ALL USING (get_user_role() = 'super_admin');

CREATE POLICY "branch_logs_select" ON post_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_logs.post_id
      AND p.branch_id = get_user_branch_id()
    )
  );

-- AI GENERATIONS
CREATE POLICY "super_admin_ai" ON ai_generations
  FOR ALL USING (get_user_role() = 'super_admin');

CREATE POLICY "branch_ai" ON ai_generations
  FOR ALL USING (branch_id = get_user_branch_id());

-- Storage bucket policies (ejecutar después de crear bucket 'social-posts')
-- INSERT INTO storage.buckets (id, name, public) VALUES ('social-posts', 'social-posts', true);
