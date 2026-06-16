import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '').replace(/\/rest\/v1\/?$/, '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.includes('supabase.co'));

/** Para diagnóstico en pantalla de login (sin exponer keys) */
export function getSupabaseStatus() {
  if (!supabaseUrl) return { ok: false, hint: 'VITE_SUPABASE_URL no está en el build de Vercel. Agrégala y haz Redeploy.' };
  if (!supabaseAnonKey) return { ok: false, hint: 'VITE_SUPABASE_ANON_KEY no está en el build. Agrégala y haz Redeploy.' };
  if (!supabaseUrl.includes('supabase.co')) return { ok: false, hint: 'URL de Supabase incorrecta.' };
  const project = supabaseUrl.match(/https:\/\/([^.]+)/)?.[1] || 'ok';
  return { ok: true, hint: `Conectado a Supabase (${project}...)` };
}
