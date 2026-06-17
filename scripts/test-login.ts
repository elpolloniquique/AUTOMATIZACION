import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL?.replace(/\/$/, '')!;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error('Uso: npx tsx scripts/test-login.ts EMAIL CONTRASEÑA');
  process.exit(1);
}

const client = createClient(url, anonKey);

async function main() {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('❌ Login falló:', error.message);
    process.exit(1);
  }
  console.log('✅ Login OK:', data.user?.email);
}

main();
