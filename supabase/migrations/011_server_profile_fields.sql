-- Server-Profil: Beschreibung und Banner-Farbe für Server-Einstellungen
ALTER TABLE servers ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS banner_color TEXT DEFAULT '#4f545c';
