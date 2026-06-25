-- Historias programadas: soporte de video y audio/música
-- Ejecutar en Supabase SQL Editor

ALTER TABLE scheduled_stories
  ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'image'
    CHECK (media_type IN ('image', 'video')),
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS audio_mode TEXT NOT NULL DEFAULT 'original'
    CHECK (audio_mode IN ('original', 'muted', 'music')),
  ADD COLUMN IF NOT EXISTS music_url TEXT;

ALTER TABLE scheduled_stories
  ALTER COLUMN image_url DROP NOT NULL;

ALTER TABLE story_publications
  ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'image'
    CHECK (media_type IN ('image', 'video')),
  ADD COLUMN IF NOT EXISTS video_url TEXT;

ALTER TABLE story_publications
  ALTER COLUMN image_url DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_stories_media_type
  ON scheduled_stories(media_type);
