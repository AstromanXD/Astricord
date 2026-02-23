-- Server löschen: Owner UND Admin erlauben (406-Fix)
DROP POLICY IF EXISTS "servers_delete_owner_only" ON servers;
CREATE POLICY "servers_delete_owner_or_admin"
  ON servers FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM server_member_roles smr
      JOIN server_roles sr ON sr.id = smr.role_id AND sr.server_id = smr.server_id
      WHERE smr.server_id = servers.id AND smr.user_id = auth.uid()
      AND sr.name IN ('Owner', 'Admin')
    )
  );
