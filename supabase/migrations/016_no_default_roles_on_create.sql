-- Neue Server: Keine Rollen mehr automatisch erstellen
-- Creator wird nur als Mitglied hinzugefügt, ohne Rolle

-- Trigger-Funktion: Keine Default-Rollen mehr bei neuem Server
CREATE OR REPLACE FUNCTION create_default_server_roles()
RETURNS TRIGGER AS $$
BEGIN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_channel_permissions: Server-Mitglieder ohne Rolle erhalten Basis-Rechte (Kanäle sehen, schreiben, Voice)
CREATE OR REPLACE FUNCTION get_channel_permissions(p_user_id UUID, p_channel_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base BIGINT := 0;
  v_perms BIGINT;
  v_ow RECORD;
  v_server_id UUID;
BEGIN
  SELECT c.server_id INTO v_server_id FROM channels c WHERE c.id = p_channel_id;
  IF v_server_id IS NULL THEN RETURN 0; END IF;

  IF NOT EXISTS (SELECT 1 FROM server_members WHERE server_id = v_server_id AND user_id = p_user_id) THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(BIT_OR(sr.permissions), 0) INTO v_base
  FROM server_member_roles smr
  JOIN server_roles sr ON sr.id = smr.role_id
  WHERE smr.server_id = v_server_id AND smr.user_id = p_user_id;

  IF v_base = 0 THEN
    v_base := 1024 | 2048 | 1048576;
  ELSIF (v_base & 8) = 8 THEN
    RETURN 2147483647;
  END IF;

  v_perms := v_base;

  FOR v_ow IN
    SELECT cpo.allow, cpo.deny FROM channel_permission_overwrites cpo
    WHERE cpo.channel_id = p_channel_id AND cpo.role_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM server_member_roles smr WHERE smr.server_id = v_server_id AND smr.user_id = p_user_id AND smr.role_id = cpo.role_id)
  LOOP
    v_perms := (v_perms & ~v_ow.deny) | v_ow.allow;
  END LOOP;

  SELECT allow, deny INTO v_ow FROM channel_permission_overwrites WHERE channel_id = p_channel_id AND user_id = p_user_id;
  IF FOUND THEN v_perms := (v_perms & ~v_ow.deny) | v_ow.allow; END IF;

  RETURN v_perms;
END;
$$;

-- create_server: Nur Mitglied + Kanal, keine Rolle
CREATE OR REPLACE FUNCTION create_server(p_name TEXT, p_icon_url TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_server_id UUID;
BEGIN
  INSERT INTO servers (name, icon_url) VALUES (p_name, p_icon_url)
  RETURNING id INTO v_server_id;

  INSERT INTO server_members (server_id, user_id) VALUES (v_server_id, auth.uid())
  ON CONFLICT (server_id, user_id) DO NOTHING;

  INSERT INTO channels (server_id, name, type) VALUES (v_server_id, 'allgemein', 'text');

  RETURN v_server_id;
END;
$$;
