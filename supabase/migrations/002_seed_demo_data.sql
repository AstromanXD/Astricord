-- =====================================================
-- Demo-Daten für Chat Demo (idempotent)
-- Führe NACH 001_initial_schema.sql aus
-- =====================================================

INSERT INTO servers (id, name, icon_url) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Allgemein', NULL),
  ('a0000000-0000-0000-0000-000000000002', 'Gaming', NULL),
  ('a0000000-0000-0000-0000-000000000003', 'Projekt X', NULL)
ON CONFLICT (id) DO NOTHING;

-- Channels nur einfügen wenn noch keine existieren
INSERT INTO channels (server_id, name, type)
SELECT 'a0000000-0000-0000-0000-000000000001', 'willkommen', 'text'
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE server_id = 'a0000000-0000-0000-0000-000000000001' AND name = 'willkommen');

INSERT INTO channels (server_id, name, type)
SELECT 'a0000000-0000-0000-0000-000000000001', 'chat', 'text'
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE server_id = 'a0000000-0000-0000-0000-000000000001' AND name = 'chat');

INSERT INTO channels (server_id, name, type)
SELECT 'a0000000-0000-0000-0000-000000000001', 'voice-lobby', 'voice'
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE server_id = 'a0000000-0000-0000-0000-000000000001' AND name = 'voice-lobby');

INSERT INTO channels (server_id, name, type)
SELECT 'a0000000-0000-0000-0000-000000000002', 'allgemein', 'text'
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE server_id = 'a0000000-0000-0000-0000-000000000002' AND name = 'allgemein');

INSERT INTO channels (server_id, name, type)
SELECT 'a0000000-0000-0000-0000-000000000002', 'voice', 'voice'
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE server_id = 'a0000000-0000-0000-0000-000000000002' AND name = 'voice');

INSERT INTO channels (server_id, name, type)
SELECT 'a0000000-0000-0000-0000-000000000003', 'ideen', 'text'
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE server_id = 'a0000000-0000-0000-0000-000000000003' AND name = 'ideen');

INSERT INTO channels (server_id, name, type)
SELECT 'a0000000-0000-0000-0000-000000000003', 'besprechung', 'voice'
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE server_id = 'a0000000-0000-0000-0000-000000000003' AND name = 'besprechung');
