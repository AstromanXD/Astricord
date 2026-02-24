-- Timeout (MODERATE_MEMBERS), Benachrichtigungen pro Kanal
USE astricord;

-- Timeout: bis wann ist User stumm (NULL = kein Timeout)
ALTER TABLE server_members ADD COLUMN timeout_until DATETIME(3) NULL;

-- Benachrichtigungseinstellungen pro Kanal pro User
CREATE TABLE IF NOT EXISTS channel_notification_settings (
  channel_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  mute BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (channel_id, user_id),
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
