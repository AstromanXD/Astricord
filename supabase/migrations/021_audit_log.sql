-- Audit-Log: Server-Aktionen protokollieren
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_server ON audit_log(server_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view audit log" ON audit_log;
CREATE POLICY "Members can view audit log" ON audit_log FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM server_members WHERE server_id = audit_log.server_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "System inserts audit log" ON audit_log;
CREATE POLICY "System inserts audit log" ON audit_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);
