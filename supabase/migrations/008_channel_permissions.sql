-- =====================================================
-- Kanalrechte (Discord-ähnlich) - idempotent
-- =====================================================

ALTER TABLE server_roles ADD COLUMN IF NOT EXISTS permissions BIGINT NOT NULL DEFAULT 0;

UPDATE server_roles SET permissions = 3147264 WHERE name = 'Member';
UPDATE server_roles SET permissions = 8 WHERE name = 'Admin';

CREATE OR REPLACE FUNCTION create_default_server_roles()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO server_roles (server_id, name, color, position, permissions)
  SELECT NEW.id, 'Admin', '#5865f2', 100, 8
  WHERE NOT EXISTS (SELECT 1 FROM server_roles WHERE server_id = NEW.id AND name = 'Admin');
  INSERT INTO server_roles (server_id, name, color, position, permissions)
  SELECT NEW.id, 'Member', '#57f287', 0, 3147264
  WHERE NOT EXISTS (SELECT 1 FROM server_roles WHERE server_id = NEW.id AND name = 'Member');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- CHANNEL PERMISSION OVERWRITES
-- =====================================================
CREATE TABLE IF NOT EXISTS channel_permission_overwrites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  role_id UUID REFERENCES server_roles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  allow BIGINT NOT NULL DEFAULT 0,
  deny BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT overwrite_target CHECK (
    (role_id IS NOT NULL AND user_id IS NULL) OR
    (role_id IS NULL AND user_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_overwrite_channel_role ON channel_permission_overwrites (channel_id, role_id) WHERE role_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_overwrite_channel_user ON channel_permission_overwrites (channel_id, user_id) WHERE user_id IS NOT NULL;

ALTER TABLE channel_permission_overwrites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view overwrites" ON channel_permission_overwrites;
CREATE POLICY "Authenticated users can view overwrites"
  ON channel_permission_overwrites FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can manage overwrites" ON channel_permission_overwrites;
CREATE POLICY "Admins can manage overwrites"
  ON channel_permission_overwrites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM channels c
      JOIN server_members sm ON sm.server_id = c.server_id AND sm.user_id = auth.uid()
      JOIN server_member_roles smr ON smr.server_id = sm.server_id AND smr.user_id = sm.user_id
      JOIN server_roles sr ON sr.id = smr.role_id
      WHERE c.id = channel_permission_overwrites.channel_id AND sr.name = 'Admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_overwrites_channel ON channel_permission_overwrites(channel_id);

-- =====================================================
-- Funktion: Effektive Kanalrechte berechnen
-- =====================================================
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
  v_channel_type TEXT;
BEGIN
  SELECT c.server_id, c.type INTO v_server_id, v_channel_type
  FROM channels c WHERE c.id = p_channel_id;
  IF v_server_id IS NULL THEN
    RETURN 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM server_members WHERE server_id = v_server_id AND user_id = p_user_id) THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(BIT_OR(sr.permissions), 0) INTO v_base
  FROM server_member_roles smr
  JOIN server_roles sr ON sr.id = smr.role_id
  WHERE smr.server_id = v_server_id AND smr.user_id = p_user_id;

  IF (v_base & 8) = 8 THEN
    RETURN 2147483647;
  END IF;

  v_perms := v_base;

  FOR v_ow IN
    SELECT cpo.allow, cpo.deny
    FROM channel_permission_overwrites cpo
    WHERE cpo.channel_id = p_channel_id
      AND cpo.role_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM server_member_roles smr
        WHERE smr.server_id = v_server_id AND smr.user_id = p_user_id AND smr.role_id = cpo.role_id
      )
  LOOP
    v_perms := (v_perms & ~v_ow.deny) | v_ow.allow;
  END LOOP;

  SELECT allow, deny INTO v_ow
  FROM channel_permission_overwrites
  WHERE channel_id = p_channel_id AND user_id = p_user_id;
  IF FOUND THEN
    v_perms := (v_perms & ~v_ow.deny) | v_ow.allow;
  END IF;

  RETURN v_perms;
END;
$$;

GRANT EXECUTE ON FUNCTION get_channel_permissions(UUID, UUID) TO authenticated;

-- =====================================================
-- RLS: Channels, Messages, Voice
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view channels" ON channels;
DROP POLICY IF EXISTS "channels_select_with_permission" ON channels;
CREATE POLICY "channels_select_with_permission"
  ON channels FOR SELECT
  TO authenticated
  USING (
    (get_channel_permissions(auth.uid(), id) & 1024) = 1024
  );

DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_select"
  ON messages FOR SELECT
  TO authenticated
  USING (
    (channel_id IS NOT NULL AND (get_channel_permissions(auth.uid(), channel_id) & 1024) = 1024) OR
    (dm_conversation_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM dm_participants WHERE conversation_id = messages.dm_conversation_id AND user_id = auth.uid()
    ))
  );

CREATE POLICY "messages_insert"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    (channel_id IS NOT NULL AND (get_channel_permissions(auth.uid(), channel_id) & 2048) = 2048) OR
    (dm_conversation_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM dm_participants WHERE conversation_id = dm_conversation_id AND user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Authenticated users can view voice sessions" ON voice_sessions;
DROP POLICY IF EXISTS "Users can manage own voice session" ON voice_sessions;
DROP POLICY IF EXISTS "voice_sessions_select" ON voice_sessions;
DROP POLICY IF EXISTS "voice_sessions_manage_own" ON voice_sessions;

CREATE POLICY "voice_sessions_select"
  ON voice_sessions FOR SELECT
  TO authenticated
  USING ((get_channel_permissions(auth.uid(), channel_id) & 1048576) = 1048576);

CREATE POLICY "voice_sessions_manage_own"
  ON voice_sessions FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid() AND (get_channel_permissions(auth.uid(), channel_id) & 1048576) = 1048576
  )
  WITH CHECK (
    user_id = auth.uid() AND (get_channel_permissions(auth.uid(), channel_id) & 1048576) = 1048576
  );
