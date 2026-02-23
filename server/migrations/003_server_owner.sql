-- Server Owner: Owner hat volle Rechte ohne spezielle Rolle
ALTER TABLE servers ADD COLUMN owner_id CHAR(36) NULL;
CREATE INDEX IF NOT EXISTS idx_servers_owner ON servers(owner_id);

-- Bestehende Server: Owner = erster Mitglied (ältestes joined_at)
UPDATE servers s
SET owner_id = (
  SELECT user_id FROM server_members
  WHERE server_id = s.id
  ORDER BY joined_at ASC
  LIMIT 1
)
WHERE owner_id IS NULL;
