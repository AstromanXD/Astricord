-- Astricord MySQL Schema (Migration von Supabase/PostgreSQL)
-- Führe zuerst aus: CREATE DATABASE astricord;
-- Benötigt MySQL 8.0.13+ (für CREATE INDEX IF NOT EXISTS)
-- Bei MySQL 5.7: Entferne "IF NOT EXISTS" bei den CREATE INDEX Zeilen

USE astricord;

-- Users (ersetzt auth.users - wir verwalten Auth selbst)
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

-- Profiles (verknüpft mit users)
CREATE TABLE IF NOT EXISTS profiles (
  id CHAR(36) PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  theme VARCHAR(20) NOT NULL DEFAULT 'dark',
  status VARCHAR(20) DEFAULT 'online',
  status_message TEXT,
  custom_status TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
);

-- Servers
CREATE TABLE IF NOT EXISTS servers (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  icon_url TEXT,
  description TEXT,
  banner_color VARCHAR(20) DEFAULT '#4f545c',
  owner_id CHAR(36),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Channel Categories
CREATE TABLE IF NOT EXISTS channel_categories (
  id CHAR(36) PRIMARY KEY,
  server_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

-- Channels
CREATE TABLE IF NOT EXISTS channels (
  id CHAR(36) PRIMARY KEY,
  server_id CHAR(36) NOT NULL,
  category_id CHAR(36),
  name VARCHAR(255) NOT NULL,
  type ENUM('text', 'voice', 'forum') NOT NULL DEFAULT 'text',
  position INT NOT NULL DEFAULT 0,
  slow_mode_seconds INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES channel_categories(id) ON DELETE SET NULL
);

-- Channel Permission Overwrites
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
CREATE INDEX IF NOT EXISTS idx_overwrites_channel ON channel_permission_overwrites(channel_id);

-- DM Conversations (vor messages, da messages darauf verweist)
CREATE TABLE IF NOT EXISTS dm_conversations (
  id CHAR(36) PRIMARY KEY,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

-- DM Participants
CREATE TABLE IF NOT EXISTS dm_participants (
  conversation_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  PRIMARY KEY (conversation_id, user_id),
  FOREIGN KEY (conversation_id) REFERENCES dm_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id CHAR(36) PRIMARY KEY,
  channel_id CHAR(36),
  dm_conversation_id CHAR(36),
  user_id CHAR(36) NOT NULL,
  content TEXT NOT NULL,
  attachments JSON DEFAULT ('[]'),
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  edited_at DATETIME(3),
  parent_message_id CHAR(36),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (dm_conversation_id) REFERENCES dm_conversations(id) ON DELETE CASCADE,
  CHECK ((channel_id IS NOT NULL AND dm_conversation_id IS NULL) OR (channel_id IS NULL AND dm_conversation_id IS NOT NULL))
);

-- Message Reactions
CREATE TABLE IF NOT EXISTS message_reactions (
  id CHAR(36) PRIMARY KEY,
  message_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  emoji VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY (message_id, user_id, emoji),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Friend Requests
CREATE TABLE IF NOT EXISTS friend_requests (
  id CHAR(36) PRIMARY KEY,
  from_user_id CHAR(36) NOT NULL,
  to_user_id CHAR(36) NOT NULL,
  status ENUM('pending', 'accepted', 'blocked') NOT NULL DEFAULT 'pending',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY (from_user_id, to_user_id),
  FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Server Roles
CREATE TABLE IF NOT EXISTS server_roles (
  id CHAR(36) PRIMARY KEY,
  server_id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#99aab5',
  position INT NOT NULL DEFAULT 0,
  permissions BIGINT DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

-- Server Members
CREATE TABLE IF NOT EXISTS server_members (
  server_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  joined_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  timeout_until DATETIME(3) NULL,
  PRIMARY KEY (server_id, user_id),
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Server Member Roles
CREATE TABLE IF NOT EXISTS server_member_roles (
  server_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  role_id CHAR(36) NOT NULL,
  PRIMARY KEY (server_id, user_id, role_id),
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES server_roles(id) ON DELETE CASCADE
);

-- Server Invites
CREATE TABLE IF NOT EXISTS server_invites (
  id CHAR(36) PRIMARY KEY,
  server_id CHAR(36) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  created_by CHAR(36),
  expires_at DATETIME(3) NULL,
  max_uses INT NULL,
  uses INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Server Member Nicknames
CREATE TABLE IF NOT EXISTS server_member_nicknames (
  server_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  nickname VARCHAR(32) NOT NULL,
  PRIMARY KEY (server_id, user_id),
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Channel Notification Settings
CREATE TABLE IF NOT EXISTS channel_notification_settings (
  channel_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  mute BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (channel_id, user_id),
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Server Emojis
CREATE TABLE IF NOT EXISTS server_emojis (
  id CHAR(36) PRIMARY KEY,
  server_id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  image_url TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY (server_id, name),
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

-- Server Bans
CREATE TABLE IF NOT EXISTS server_bans (
  server_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  banned_by CHAR(36),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (server_id, user_id),
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (banned_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Blocked Users (global block list per user)
CREATE TABLE IF NOT EXISTS blocked_users (
  user_id CHAR(36) NOT NULL,
  blocked_user_id CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, blocked_user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Voice Sessions
CREATE TABLE IF NOT EXISTS voice_sessions (
  id CHAR(36) PRIMARY KEY,
  channel_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  joined_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  is_muted BOOLEAN NOT NULL DEFAULT FALSE,
  has_video BOOLEAN NOT NULL DEFAULT FALSE,
  is_screen_sharing BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE KEY (channel_id, user_id),
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indizes (IF NOT EXISTS ab MySQL 8.0.13)
CREATE INDEX IF NOT EXISTS idx_channels_server ON channels(server_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_dm ON messages(dm_conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_message_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_channel ON voice_sessions(channel_id);
CREATE INDEX IF NOT EXISTS idx_member_roles_server ON server_member_roles(server_id);
CREATE INDEX IF NOT EXISTS idx_member_roles_user ON server_member_roles(user_id);
