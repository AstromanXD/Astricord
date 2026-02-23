-- Threads: Antwort-Threads zu Nachrichten
CREATE TABLE IF NOT EXISTS message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE UNIQUE,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_threads_channel ON message_threads(channel_id);

ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view threads" ON message_threads;
CREATE POLICY "Users can view threads" ON message_threads FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can create threads" ON message_threads;
CREATE POLICY "Users can create threads" ON message_threads FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Thread-Nachrichten: parent_message_id für Thread-Antworten
ALTER TABLE messages ADD COLUMN IF NOT EXISTS parent_message_id UUID REFERENCES messages(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_message_id);
