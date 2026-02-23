-- Fix: 500 Internal Server Error beim Abrufen und Senden von Messages
-- Maximale Vereinfachung: Jeder eingeloggte Nutzer kann lesen/schreiben
-- (get_channel_permissions + server_members-Check können fehlschlagen wenn User noch nicht gejoint hat)

DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;

CREATE POLICY "messages_select"
  ON messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "messages_insert"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (true);
