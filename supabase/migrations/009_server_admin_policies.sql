-- =====================================================
-- Server-Update und Rollen-Verwaltung nur für Admins (idempotent)
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can update servers" ON servers;
DROP POLICY IF EXISTS "servers_update_admin" ON servers;
CREATE POLICY "servers_update_admin"
  ON servers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM server_members sm
      JOIN server_member_roles smr ON sm.server_id = smr.server_id AND sm.user_id = smr.user_id
      JOIN server_roles sr ON smr.role_id = sr.id
      WHERE sm.server_id = servers.id
        AND sm.user_id = auth.uid()
        AND sr.name = 'Admin'
    )
  );

DROP POLICY IF EXISTS "Authenticated users can manage server roles" ON server_roles;
DROP POLICY IF EXISTS "server_roles_select" ON server_roles;
DROP POLICY IF EXISTS "server_roles_insert_admin" ON server_roles;
DROP POLICY IF EXISTS "server_roles_update_admin" ON server_roles;
DROP POLICY IF EXISTS "server_roles_delete_admin" ON server_roles;

CREATE POLICY "server_roles_select"
  ON server_roles FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "server_roles_insert_admin"
  ON server_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM server_members sm
      JOIN server_member_roles smr ON sm.server_id = smr.server_id AND sm.user_id = smr.user_id
      JOIN server_roles sr ON smr.role_id = sr.id
      WHERE sm.server_id = server_roles.server_id
        AND sm.user_id = auth.uid()
        AND sr.name = 'Admin'
    )
  );

CREATE POLICY "server_roles_update_admin"
  ON server_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM server_members sm
      JOIN server_member_roles smr ON sm.server_id = smr.server_id AND sm.user_id = smr.user_id
      JOIN server_roles sr ON smr.role_id = sr.id
      WHERE sm.server_id = server_roles.server_id
        AND sm.user_id = auth.uid()
        AND sr.name = 'Admin'
    )
  );

CREATE POLICY "server_roles_delete_admin"
  ON server_roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM server_members sm
      JOIN server_member_roles smr ON sm.server_id = smr.server_id AND sm.user_id = smr.user_id
      JOIN server_roles sr ON smr.role_id = sr.id
      WHERE sm.server_id = server_roles.server_id
        AND sm.user_id = auth.uid()
        AND sr.name = 'Admin'
    )
  );

DROP POLICY IF EXISTS "Authenticated users can manage member roles" ON server_member_roles;
DROP POLICY IF EXISTS "server_member_roles_select" ON server_member_roles;
DROP POLICY IF EXISTS "server_member_roles_insert_admin" ON server_member_roles;
DROP POLICY IF EXISTS "server_member_roles_delete_admin" ON server_member_roles;
DROP POLICY IF EXISTS "server_member_roles_delete_own" ON server_member_roles;

CREATE POLICY "server_member_roles_select"
  ON server_member_roles FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "server_member_roles_insert_admin"
  ON server_member_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM server_members sm
      JOIN server_member_roles smr ON sm.server_id = smr.server_id AND sm.user_id = smr.user_id
      JOIN server_roles sr ON smr.role_id = sr.id
      WHERE sm.server_id = server_member_roles.server_id
        AND sm.user_id = auth.uid()
        AND sr.name = 'Admin'
    )
  );

CREATE POLICY "server_member_roles_delete_admin"
  ON server_member_roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM server_members sm
      JOIN server_member_roles smr2 ON sm.server_id = smr2.server_id AND sm.user_id = smr2.user_id
      JOIN server_roles sr ON smr2.role_id = sr.id
      WHERE sm.server_id = server_member_roles.server_id
        AND sm.user_id = auth.uid()
        AND sr.name = 'Admin'
    )
  );

CREATE POLICY "server_member_roles_delete_own"
  ON server_member_roles FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
