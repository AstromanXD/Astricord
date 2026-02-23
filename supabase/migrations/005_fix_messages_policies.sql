-- =====================================================
-- Fix: 500 Error bei messages - RLS-Policies (idempotent)
-- =====================================================

DROP POLICY IF EXISTS "Users can view channel or DM messages" ON messages;
DROP POLICY IF EXISTS "Users can insert channel or DM messages" ON messages;
DROP POLICY IF EXISTS "Authenticated users can view messages" ON messages;
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON messages;
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
