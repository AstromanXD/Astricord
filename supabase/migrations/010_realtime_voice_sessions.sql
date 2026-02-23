-- voice_sessions für Supabase Realtime aktivieren
-- Ermöglicht postgres_changes für die Anzeige von Nutzern in Voice-Channels

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'voice_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE voice_sessions;
  END IF;
END $$;
