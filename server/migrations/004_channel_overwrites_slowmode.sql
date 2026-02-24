-- Kanal-Berechtigungen (Overwrites) + Slow-Modus
USE astricord;

-- Channel Permission Overwrites (role_id ODER user_id gesetzt)
CREATE TABLE IF NOT EXISTS channel_permission_overwrites (
  id CHAR(36) PRIMARY KEY,
  channel_id CHAR(36) NOT NULL,
  role_id CHAR(36) NULL,
  user_id CHAR(36) NULL,
  allow BIGINT NOT NULL DEFAULT 0,
  deny BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT chk_overwrite_target CHECK (
    (role_id IS NOT NULL AND user_id IS NULL) OR
    (role_id IS NULL AND user_id IS NOT NULL)
  ),
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES server_roles(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_overwrites_channel ON channel_permission_overwrites(channel_id);

-- Slow-Modus pro Kanal (Sekunden zwischen Nachrichten, 0 = aus)
ALTER TABLE channels ADD COLUMN slow_mode_seconds INT NOT NULL DEFAULT 0;
