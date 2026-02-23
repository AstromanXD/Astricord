-- has_video und is_screen_sharing für Voice-Sessions (Kamera/Bildschirm-Anzeige)
ALTER TABLE voice_sessions
  ADD COLUMN IF NOT EXISTS has_video BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_screen_sharing BOOLEAN NOT NULL DEFAULT false;
