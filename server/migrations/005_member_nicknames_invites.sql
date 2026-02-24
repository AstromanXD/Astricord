-- Server-Nickname pro Mitglied, Einladung Ablauf/Nutzungen
USE astricord;

-- Server-Nickname (nur für diesen Server)
CREATE TABLE IF NOT EXISTS server_member_nicknames (
  server_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  nickname VARCHAR(32) NOT NULL,
  PRIMARY KEY (server_id, user_id),
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Einladung: Ablauf und max. Nutzungen
ALTER TABLE server_invites
  ADD COLUMN expires_at DATETIME(3) NULL,
  ADD COLUMN max_uses INT NULL,
  ADD COLUMN uses INT NOT NULL DEFAULT 0;
