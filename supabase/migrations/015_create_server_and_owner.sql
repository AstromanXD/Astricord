-- Server erstellen: RPC-Funktion + Creator wird automatisch Owner
-- Owner-Rolle mit vollen Rechten, Creator erhält sie beim Erstellen

-- Owner-Rolle zu Default-Rollen hinzufügen (falls noch nicht vorhanden)
CREATE OR REPLACE FUNCTION create_default_server_roles()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO server_roles (server_id, name, color, position, permissions)
  SELECT NEW.id, 'Owner', '#faa61a', 200, 2147483647
  WHERE NOT EXISTS (SELECT 1 FROM server_roles WHERE server_id = NEW.id AND name = 'Owner');
  INSERT INTO server_roles (server_id, name, color, position, permissions)
  SELECT NEW.id, 'Admin', '#5865f2', 100, 8
  WHERE NOT EXISTS (SELECT 1 FROM server_roles WHERE server_id = NEW.id AND name = 'Admin');
  INSERT INTO server_roles (server_id, name, color, position, permissions)
  SELECT NEW.id, 'Member', '#57f287', 0, 3147264
  WHERE NOT EXISTS (SELECT 1 FROM server_roles WHERE server_id = NEW.id AND name = 'Member');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Server erstellen – Creator wird automatisch Owner, Standard-Kanal wird erstellt
CREATE OR REPLACE FUNCTION create_server(p_name TEXT, p_icon_url TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_server_id UUID;
  v_owner_role_id UUID;
BEGIN
  INSERT INTO servers (name, icon_url) VALUES (p_name, p_icon_url)
  RETURNING id INTO v_server_id;

  INSERT INTO server_members (server_id, user_id) VALUES (v_server_id, auth.uid())
  ON CONFLICT (server_id, user_id) DO NOTHING;

  SELECT id INTO v_owner_role_id FROM server_roles WHERE server_id = v_server_id AND name = 'Owner' LIMIT 1;
  IF v_owner_role_id IS NOT NULL THEN
    INSERT INTO server_member_roles (server_id, user_id, role_id) VALUES (v_server_id, auth.uid(), v_owner_role_id)
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO channels (server_id, name, type) VALUES (v_server_id, 'allgemein', 'text');

  RETURN v_server_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_server(TEXT, TEXT) TO authenticated;

-- Owner-Rolle für bestehende Server (falls noch nicht vorhanden)
INSERT INTO server_roles (server_id, name, color, position, permissions)
SELECT id, 'Owner', '#faa61a', 200, 2147483647 FROM servers
WHERE NOT EXISTS (SELECT 1 FROM server_roles sr WHERE sr.server_id = servers.id AND sr.name = 'Owner');
