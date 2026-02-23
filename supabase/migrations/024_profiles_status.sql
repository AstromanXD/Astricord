-- Rich Presence / Custom Status für Profile
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'online';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status_message TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS custom_status TEXT;
