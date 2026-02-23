-- Einladungslinks und angeheftete Nachrichten

-- server_invites: Einladungscodes für Server
CREATE TABLE IF NOT EXISTS server_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_server_invites_server_id ON server_invites(server_id);
CREATE INDEX IF NOT EXISTS idx_server_invites_code ON server_invites(code);

ALTER TABLE server_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view invites" ON server_invites;
CREATE POLICY "Authenticated can view invites" ON server_invites FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated can insert invites" ON server_invites;
CREATE POLICY "Authenticated can insert invites" ON server_invites FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated can delete invites" ON server_invites;
CREATE POLICY "Authenticated can delete invites" ON server_invites FOR DELETE USING (auth.role() = 'authenticated');

-- is_pinned zu messages hinzufügen
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;

-- User können eigene Nachrichten aktualisieren (z.B. anheften)
DROP POLICY IF EXISTS "messages_update_own" ON messages;
CREATE POLICY "messages_update_own" ON messages FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Server löschen erlauben (für authentifizierte User)
DROP POLICY IF EXISTS "Authenticated users can delete servers" ON servers;
CREATE POLICY "Authenticated users can delete servers" ON servers FOR DELETE USING (auth.role() = 'authenticated');
