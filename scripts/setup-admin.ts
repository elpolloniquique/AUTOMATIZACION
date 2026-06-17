import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL?.replace(/\/$/, '')!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const email = process.argv[2] || process.env.ADMIN_EMAIL;
const password = process.argv[3] || process.env.ADMIN_PASSWORD;

if (!url || !serviceKey) {
  console.error('Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

if (!email || !password) {
  console.error('Uso: npm run setup:admin -- EMAIL CONTRASEÑA');
  console.error('O define ADMIN_EMAIL y ADMIN_PASSWORD en .env');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: list } = await admin.auth.admin.listUsers();
  const user = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Admin El Pollón' },
    });
    if (error) throw error;
    await ensureProfile(data.user!.id);
    console.log('✅ Usuario creado:', email);
    return;
  }

  await admin.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
  });

  await ensureProfile(user.id);
  console.log('✅ Usuario listo como super_admin:', email);
}

async function ensureProfile(userId: string) {
  const { data: existing } = await admin.from('profiles').select('id').eq('id', userId).single();

  if (!existing) {
    await admin.from('profiles').insert({
      id: userId,
      email,
      full_name: 'Admin El Pollón',
      role: 'super_admin',
      branch_id: null,
    });
  } else {
    await admin.from('profiles').update({
      role: 'super_admin',
      branch_id: null,
    }).eq('id', userId);
  }
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
