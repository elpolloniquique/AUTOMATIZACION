import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL?.replace(/\/$/, '')!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const email = 'tutacanehuillca@gmail.com';

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: list } = await admin.auth.admin.listUsers();
  const user = list?.users.find((u) => u.email?.toLowerCase() === email);

  if (!user) {
    console.log('Creando usuario...');
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: 'Pollon123',
      email_confirm: true,
      user_metadata: { full_name: 'Admin El Pollón', role: 'super_admin' },
    });
    if (error) throw error;
    await ensureProfile(data.user!.id);
    console.log('✅ Usuario creado:', email, '/ Pollon123');
    return;
  }

  await admin.auth.admin.updateUserById(user.id, {
    password: 'Pollon123',
    email_confirm: true,
  });

  await ensureProfile(user.id);
  console.log('✅ Usuario listo:', email, '/ Pollon123 / super_admin');
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
    console.log('   Perfil creado');
  } else {
    await admin.from('profiles').update({
      role: 'super_admin',
      branch_id: null,
      full_name: 'Admin El Pollón',
    }).eq('id', userId);
    console.log('   Perfil actualizado a super_admin');
  }
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
