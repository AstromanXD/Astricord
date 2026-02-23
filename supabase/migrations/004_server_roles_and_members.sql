-- =====================================================
-- Server-Rollen & Mitglieder (Discord-ähnlich) - idempotent
-- =====================================================

CREATE TABLE IF NOT EXISTS channel_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE channel_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view categories" ON channel_categories;
CREATE POLICY "Authenticated users can view categories"
  ON channel_categories FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage categories" ON channel_categories;
CREATE POLICY "Authenticated users can manage categories"
  ON channel_categories FOR ALL
  USING (auth.role() = 'authenticated');

ALTER TABLE channels ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES channel_categories(id) ON DELETE SET NULL;

-- =====================================================
-- SERVER ROLES (mit Farbe)
-- =====================================================
CREATE TABLE IF NOT EXISTS server_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#99aab5',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE server_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view server roles" ON server_roles;
CREATE POLICY "Authenticated users can view server roles"
  ON server_roles FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage server roles" ON server_roles;
CREATE POLICY "Authenticated users can manage server roles"
  ON server_roles FOR ALL
  USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_server_roles_server_id ON server_roles(server_id);

-- =====================================================
-- SERVER MEMBERS (Mitglieder pro Server)
-- =====================================================
CREATE TABLE IF NOT EXISTS server_members (
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (server_id, user_id)
);

ALTER TABLE server_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view server members" ON server_members;
CREATE POLICY "Authenticated users can view server members"
  ON server_members FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can join servers" ON server_members;
CREATE POLICY "Users can join servers"
  ON server_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave servers" ON server_members;
CREATE POLICY "Users can leave servers"
  ON server_members FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_server_members_server ON server_members(server_id);
CREATE INDEX IF NOT EXISTS idx_server_members_user ON server_members(user_id);

-- =====================================================
-- SERVER MEMBER ROLES (User hat Rolle auf Server)
-- =====================================================
CREATE TABLE IF NOT EXISTS server_member_roles (
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES server_roles(id) ON DELETE CASCADE,
  PRIMARY KEY (server_id, user_id, role_id)
);

ALTER TABLE server_member_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view member roles" ON server_member_roles;
CREATE POLICY "Authenticated users can view member roles"
  ON server_member_roles FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage member roles" ON server_member_roles;
CREATE POLICY "Authenticated users can manage member roles"
  ON server_member_roles FOR ALL
  USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_member_roles_server ON server_member_roles(server_id);

-- =====================================================
-- Funktion: Server beitreten (mit Default-Rolle)
-- =====================================================
CREATE OR REPLACE FUNCTION join_server(p_server_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_role_id UUID;
BEGIN
  INSERT INTO server_members (server_id, user_id) VALUES (p_server_id, auth.uid())
  ON CONFLICT (server_id, user_id) DO NOTHING;

  SELECT id INTO default_role_id FROM server_roles WHERE server_id = p_server_id AND name = 'Member' LIMIT 1;
  IF default_role_id IS NOT NULL THEN
    INSERT INTO server_member_roles (server_id, user_id, role_id) VALUES (p_server_id, auth.uid(), default_role_id)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION join_server(UUID) TO authenticated;

-- =====================================================
-- Trigger: Default-Rollen bei neuem Server
-- =====================================================
CREATE OR REPLACE FUNCTION create_default_server_roles()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO server_roles (server_id, name, color, position)
  SELECT NEW.id, 'Admin', '#5865f2', 100
  WHERE NOT EXISTS (SELECT 1 FROM server_roles WHERE server_id = NEW.id AND name = 'Admin');
  INSERT INTO server_roles (server_id, name, color, position)
  SELECT NEW.id, 'Member', '#57f287', 0
  WHERE NOT EXISTS (SELECT 1 FROM server_roles WHERE server_id = NEW.id AND name = 'Member');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_server_created ON servers;
CREATE TRIGGER on_server_created
  AFTER INSERT ON servers
  FOR EACH ROW EXECUTE FUNCTION create_default_server_roles();

-- =====================================================
-- Default-Rollen für bestehende Server erstellen
-- =====================================================
INSERT INTO server_roles (server_id, name, color, position)
SELECT id, 'Admin', '#5865f2', 100 FROM servers
WHERE NOT EXISTS (SELECT 1 FROM server_roles sr WHERE sr.server_id = servers.id AND sr.name = 'Admin');

INSERT INTO server_roles (server_id, name, color, position)
SELECT id, 'Member', '#57f287', 0 FROM servers
WHERE NOT EXISTS (SELECT 1 FROM server_roles sr WHERE sr.server_id = servers.id AND sr.name = 'Member');
