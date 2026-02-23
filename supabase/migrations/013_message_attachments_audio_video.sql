-- Message-Attachments: Audio (MP3 etc.) und Video unterstützen
-- Erhöht file_size_limit auf 50MB für Videos
UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/x-wav',
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'
  ],
  file_size_limit = 52428800
WHERE id = 'message-attachments';
