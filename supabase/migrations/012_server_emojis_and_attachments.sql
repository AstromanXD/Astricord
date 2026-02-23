-- Server-Emojis: Jeder Server kann eigene Emojis hochladen
CREATE TABLE IF NOT EXISTS server_emojis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(server_id, name)
);

CREATE INDEX IF NOT EXISTS idx_server_emojis_server_id ON server_emojis(server_id);

ALTER TABLE server_emojis ENABLE ROW LEVEL SECURITY;

-- Server-Mitglieder können Emojis ihres Servers sehen
CREATE POLICY "server_emojis_select"
  ON server_emojis FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM server_members sm
      WHERE sm.server_id = server_emojis.server_id AND sm.user_id = auth.uid()
    )
  );

-- Nur Admins können Emojis erstellen/löschen
CREATE POLICY "server_emojis_insert_admin"
  ON server_emojis FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM server_members sm
      JOIN server_member_roles smr ON sm.server_id = smr.server_id AND sm.user_id = smr.user_id
      JOIN server_roles sr ON smr.role_id = sr.id
      WHERE sm.server_id = server_emojis.server_id AND sm.user_id = auth.uid()
        AND sr.name = 'Admin'
    )
  );

CREATE POLICY "server_emojis_delete_admin"
  ON server_emojis FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM server_members sm
      JOIN server_member_roles smr ON sm.server_id = smr.server_id AND sm.user_id = smr.user_id
      JOIN server_roles sr ON smr.role_id = sr.id
      WHERE sm.server_id = server_emojis.server_id AND sm.user_id = auth.uid()
        AND sr.name = 'Admin'
    )
  );

-- Messages: Anhänge (Bilder etc.)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';

-- Storage-Buckets für Emojis und Chat-Anhänge (falls noch nicht vorhanden)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'server-emojis', 'server-emojis', true, 524288, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'server-emojis');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'message-attachments', 'message-attachments', true, 8388608, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'message-attachments');

-- Storage Policies
DROP POLICY IF EXISTS "server_emojis_upload" ON storage.objects;
CREATE POLICY "server_emojis_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'server-emojis');

DROP POLICY IF EXISTS "server_emojis_read" ON storage.objects;
CREATE POLICY "server_emojis_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'server-emojis');

DROP POLICY IF EXISTS "server_emojis_delete" ON storage.objects;
CREATE POLICY "server_emojis_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'server-emojis');

DROP POLICY IF EXISTS "message_attachments_upload" ON storage.objects;
CREATE POLICY "message_attachments_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'message-attachments');

DROP POLICY IF EXISTS "message_attachments_read" ON storage.objects;
CREATE POLICY "message_attachments_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'message-attachments');
