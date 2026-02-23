-- =====================================================
-- Channel-Verwaltung: Nur Server-Admins (idempotent)
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can insert channels" ON channels;
DROP POLICY IF EXISTS "Authenticated users can update channels" ON channels;
DROP POLICY IF EXISTS "channels_insert_admin" ON channels;
DROP POLICY IF EXISTS "channels_update_admin" ON channels;
DROP POLICY IF EXISTS "channels_delete_admin" ON channels;

CREATE POLICY "channels_insert_admin"
  ON channels FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM server_members sm
      JOIN server_member_roles smr ON sm.server_id = smr.server_id AND sm.user_id = smr.user_id
      JOIN server_roles sr ON smr.role_id = sr.id
      WHERE sm.server_id = channels.server_id
        AND sm.user_id = auth.uid()
        AND sr.name = 'Admin'
    )
  );

CREATE POLICY "channels_update_admin"
  ON channels FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM server_members sm
      JOIN server_member_roles smr ON sm.server_id = smr.server_id AND sm.user_id = smr.user_id
      JOIN server_roles sr ON smr.role_id = sr.id
      WHERE sm.server_id = channels.server_id
        AND sm.user_id = auth.uid()
        AND sr.name = 'Admin'
    )
  );

CREATE POLICY "channels_delete_admin"
  ON channels FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM server_members sm
      JOIN server_member_roles smr ON sm.server_id = smr.server_id AND sm.user_id = smr.user_id
      JOIN server_roles sr ON smr.role_id = sr.id
      WHERE sm.server_id = channels.server_id
        AND sm.user_id = auth.uid()
        AND sr.name = 'Admin'
    )
  );
