-- Historias: modo recurrente o una sola fecha/hora
-- Ejecutar en Supabase SQL Editor

ALTER TABLE scheduled_stories ADD COLUMN IF NOT EXISTS schedule_mode TEXT NOT NULL DEFAULT 'recurring';
ALTER TABLE scheduled_stories ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

ALTER TABLE scheduled_stories DROP CONSTRAINT IF EXISTS scheduled_stories_schedule_mode_check;
ALTER TABLE scheduled_stories ADD CONSTRAINT scheduled_stories_schedule_mode_check
  CHECK (schedule_mode IN ('recurring', 'once'));

CREATE INDEX IF NOT EXISTS idx_scheduled_stories_once_due
  ON scheduled_stories (scheduled_at)
  WHERE schedule_mode = 'once' AND is_active = true;
