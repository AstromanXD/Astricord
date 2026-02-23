-- Server-Bans: Gebannte Mitglieder pro Server
CREATE TABLE IF NOT EXISTS server_bans (
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (server_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_server_bans_server ON server_bans(server_id);

ALTER TABLE server_bans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view bans" ON server_bans;
CREATE POLICY "Admins can view bans" ON server_bans FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM server_member_roles smr
      JOIN server_roles sr ON sr.id = smr.role_id AND sr.server_id = smr.server_id
      WHERE smr.server_id = server_bans.server_id AND smr.user_id = auth.uid()
      AND sr.name IN ('Admin', 'Owner')
    )
  );

DROP POLICY IF EXISTS "Admins can ban" ON server_bans;
CREATE POLICY "Admins can ban" ON server_bans FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND banned_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM server_member_roles smr
      JOIN server_roles sr ON sr.id = smr.role_id AND sr.server_id = smr.server_id
      WHERE smr.server_id = server_bans.server_id AND smr.user_id = auth.uid()
      AND sr.name IN ('Admin', 'Owner')
    )
  );

DROP POLICY IF EXISTS "Admins can unban" ON server_bans;
CREATE POLICY "Admins can unban" ON server_bans FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM server_member_roles smr
      JOIN server_roles sr ON sr.id = smr.role_id AND sr.server_id = smr.server_id
      WHERE smr.server_id = server_bans.server_id AND smr.user_id = auth.uid()
      AND sr.name IN ('Admin', 'Owner')
    )
  );

-- Nachrichten bearbeiten: edited_at Spalte
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
