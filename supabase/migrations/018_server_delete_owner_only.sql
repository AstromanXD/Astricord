-- Server löschen nur für Owner erlauben
DROP POLICY IF EXISTS "Authenticated users can delete servers" ON servers;
CREATE POLICY "servers_delete_owner_only"
  ON servers FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM server_member_roles smr
      JOIN server_roles sr ON sr.id = smr.role_id AND sr.server_id = smr.server_id
      WHERE smr.server_id = servers.id AND smr.user_id = auth.uid() AND sr.name = 'Owner'
    )
  );
