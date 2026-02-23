-- =====================================================
-- Freunde & Private Chats (DMs) - idempotent
-- =====================================================

CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(from_user_id, to_user_id)
);

ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own friend requests" ON friend_requests;
CREATE POLICY "Users can view own friend requests"
  ON friend_requests FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

DROP POLICY IF EXISTS "Users can send friend requests" ON friend_requests;
CREATE POLICY "Users can send friend requests"
  ON friend_requests FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

DROP POLICY IF EXISTS "Users can update received requests (accept/block)" ON friend_requests;
CREATE POLICY "Users can update received requests (accept/block)"
  ON friend_requests FOR UPDATE
  USING (auth.uid() = to_user_id);

CREATE INDEX IF NOT EXISTS idx_friend_requests_from ON friend_requests(from_user_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON friend_requests(to_user_id);

-- =====================================================
-- DM CONVERSATIONS (Private Chats)
-- =====================================================
CREATE TABLE IF NOT EXISTS dm_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dm_participants (
  conversation_id UUID NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE dm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view DMs they participate in" ON dm_conversations;
CREATE POLICY "Users can view DMs they participate in"
  ON dm_conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dm_participants
      WHERE conversation_id = dm_conversations.id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create DM conversations" ON dm_conversations;
CREATE POLICY "Users can create DM conversations"
  ON dm_conversations FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view DM participants" ON dm_participants;
CREATE POLICY "Users can view DM participants"
  ON dm_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dm_participants dp2
      WHERE dp2.conversation_id = dm_participants.conversation_id AND dp2.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION create_dm_conversation(other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_conv_id UUID;
  my_id UUID := auth.uid();
BEGIN
  IF my_id = other_user_id THEN
    RAISE EXCEPTION 'Cannot create DM with yourself';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM friend_requests
    WHERE status = 'accepted'
    AND ((from_user_id = my_id AND to_user_id = other_user_id)
      OR (from_user_id = other_user_id AND to_user_id = my_id))
  ) THEN
    RAISE EXCEPTION 'Can only DM with friends';
  END IF;

  INSERT INTO dm_conversations DEFAULT VALUES RETURNING id INTO new_conv_id;
  INSERT INTO dm_participants (conversation_id, user_id) VALUES
    (new_conv_id, my_id),
    (new_conv_id, other_user_id);
  RETURN new_conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_dm_conversation(UUID) TO authenticated;

DROP POLICY IF EXISTS "Users can add themselves to DM" ON dm_participants;
CREATE POLICY "Users can add themselves to DM"
  ON dm_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- DM MESSAGES (messages erweitern)
-- =====================================================
ALTER TABLE messages ALTER COLUMN channel_id DROP NOT NULL;

ALTER TABLE messages ADD COLUMN IF NOT EXISTS dm_conversation_id UUID REFERENCES dm_conversations(id) ON DELETE CASCADE;

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_channel_or_dm;
ALTER TABLE messages ADD CONSTRAINT messages_channel_or_dm CHECK (
  (channel_id IS NOT NULL AND dm_conversation_id IS NULL) OR
  (channel_id IS NULL AND dm_conversation_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_messages_dm_conversation ON messages(dm_conversation_id);

DROP POLICY IF EXISTS "Authenticated users can view messages" ON messages;
DROP POLICY IF EXISTS "Users can view channel or DM messages" ON messages;
CREATE POLICY "Users can view channel or DM messages"
  ON messages FOR SELECT
  USING (
    (channel_id IS NOT NULL AND auth.role() = 'authenticated') OR
    (dm_conversation_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM dm_participants
      WHERE conversation_id = messages.dm_conversation_id AND user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Authenticated users can insert messages" ON messages;
DROP POLICY IF EXISTS "Users can insert channel or DM messages" ON messages;
CREATE POLICY "Users can insert channel or DM messages"
  ON messages FOR INSERT
  WITH CHECK (
    (channel_id IS NOT NULL AND auth.role() = 'authenticated') OR
    (dm_conversation_id IS NOT NULL AND auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM dm_participants
      WHERE conversation_id = dm_conversation_id AND user_id = auth.uid()
    ))
  );
