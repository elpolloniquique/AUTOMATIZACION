-- Security fixes - ejecutar en Supabase SQL Editor después de 001

-- 1. Nuevos usuarios siempre creador_contenido (no confiar en user_metadata)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'creador_contenido'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Evitar escalada de privilegios en profiles
CREATE OR REPLACE FUNCTION prevent_profile_privilege_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() = OLD.id AND get_user_role() != 'super_admin' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      NEW.role := OLD.role;
    END IF;
    IF NEW.branch_id IS DISTINCT FROM OLD.branch_id THEN
      NEW.branch_id := OLD.branch_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS profiles_prevent_escalation ON profiles;
CREATE TRIGGER profiles_prevent_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_profile_privilege_escalation();

-- 3. Tokens de redes solo visibles para admin_sucursal y super_admin
DROP POLICY IF EXISTS "branch_social_select" ON social_accounts;
CREATE POLICY "branch_social_select_admin" ON social_accounts
  FOR SELECT USING (
    get_user_role() = 'super_admin'
    OR (
      branch_id = get_user_branch_id()
      AND get_user_role() = 'admin_sucursal'
    )
  );

-- 4. Storage policies para bucket social-posts
CREATE POLICY "social_posts_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'social-posts');

CREATE POLICY "social_posts_authenticated_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'social-posts'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "social_posts_service_upload" ON storage.objects
  FOR ALL USING (bucket_id = 'social-posts' AND auth.role() = 'service_role');
