-- =====================================================
-- Erster Server-Mitglied wird Admin (idempotent)
-- =====================================================

INSERT INTO server_member_roles (server_id, user_id, role_id)
SELECT sm.server_id, sm.user_id, sr.id
FROM server_members sm
JOIN server_roles sr ON sr.server_id = sm.server_id AND sr.name = 'Admin'
WHERE NOT EXISTS (
  SELECT 1 FROM server_member_roles smr
  WHERE smr.server_id = sm.server_id AND smr.user_id = sm.user_id AND smr.role_id = sr.id
)
AND sm.user_id = (
  SELECT user_id FROM server_members WHERE server_id = sm.server_id ORDER BY joined_at ASC LIMIT 1
)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION join_server(p_server_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_role_id UUID;
  member_role_id UUID;
  member_count INTEGER;
BEGIN
  INSERT INTO server_members (server_id, user_id) VALUES (p_server_id, auth.uid())
  ON CONFLICT (server_id, user_id) DO NOTHING;

  SELECT COUNT(*) INTO member_count FROM server_members WHERE server_id = p_server_id;

  IF member_count = 1 THEN
    SELECT id INTO admin_role_id FROM server_roles WHERE server_id = p_server_id AND name = 'Admin' LIMIT 1;
    IF admin_role_id IS NOT NULL THEN
      INSERT INTO server_member_roles (server_id, user_id, role_id) VALUES (p_server_id, auth.uid(), admin_role_id)
      ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    SELECT id INTO member_role_id FROM server_roles WHERE server_id = p_server_id AND name = 'Member' LIMIT 1;
    IF member_role_id IS NOT NULL THEN
      INSERT INTO server_member_roles (server_id, user_id, role_id) VALUES (p_server_id, auth.uid(), member_role_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END;
$$;
