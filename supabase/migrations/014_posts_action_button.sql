-- Botón de acción (web / WhatsApp) en publicaciones Facebook programadas
-- Ejecutar en Supabase SQL Editor

ALTER TABLE posts ADD COLUMN IF NOT EXISTS action_button_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS action_button_type TEXT NOT NULL DEFAULT 'website';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS action_button_text TEXT NOT NULL DEFAULT 'Comprar';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS action_button_url TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS action_button_whatsapp_message TEXT;

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_action_button_type_check;
ALTER TABLE posts ADD CONSTRAINT posts_action_button_type_check
  CHECK (action_button_type IN ('website', 'whatsapp'));
