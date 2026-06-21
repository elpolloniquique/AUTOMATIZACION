-- Botón "Enlace web" en historias programadas de Facebook
-- Ejecutar en Supabase SQL Editor

ALTER TABLE scheduled_stories ADD COLUMN IF NOT EXISTS link_button_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE scheduled_stories ADD COLUMN IF NOT EXISTS link_button_text TEXT NOT NULL DEFAULT 'Comprar';
ALTER TABLE scheduled_stories ADD COLUMN IF NOT EXISTS link_button_url TEXT;

UPDATE scheduled_stories
SET link_button_url = 'https://www.el-pollon.cl/'
WHERE link_button_enabled = true AND (link_button_url IS NULL OR link_button_url = '');
