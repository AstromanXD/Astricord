-- Forum-Channel-Typ (neben text und voice)
ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_type_check;
ALTER TABLE channels ADD CONSTRAINT channels_type_check
  CHECK (type IN ('text', 'voice', 'forum'));
