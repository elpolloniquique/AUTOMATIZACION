import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL?.replace(/\/$/, '')!;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const email = process.argv[2] || 'tutacanehuillca@gmail.com';
const password = process.argv[3] || 'Pollon2026';

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const client = createClient(url, anonKey);

async function main() {
  console.log('URL:', url);
  console.log('Email a probar:', email);

  const { data: list, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) {
    console.error('Error listando usuarios:', listErr.message);
    return;
  }

  const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    console.error('❌ Usuario NO existe en este proyecto Supabase');
    console.log('Usuarios encontrados:', list.users.map((u) => u.email).join(', '));
    return;
  }

  console.log('✅ Usuario existe');
  console.log('   ID:', user.id);
  console.log('   Email confirmado:', user.email_confirmed_at ? 'SÍ' : 'NO');
  console.log('   Último sign in:', user.last_sign_in_at || 'nunca');

  const { data: profile } = await admin.from('profiles').select('*').eq('id', user.id).single();
  console.log('   Perfil:', profile ? `rol=${profile.role}` : 'NO EXISTE en tabla profiles');

  if (!user.email_confirmed_at) {
    console.log('\n⚠️  Email no confirmado. Confirmando...');
    await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
    console.log('   Email confirmado manualmente.');
  }

  console.log('\n🔐 Probando login con contraseña proporcionada...');
  const { data: signIn, error: signInErr } = await client.auth.signInWithPassword({ email, password });

  if (signInErr) {
    console.error('❌ Login falló:', signInErr.message);
    console.log('\nPosibles causas:');
    console.log('  - Contraseña incorrecta (la que escribes ≠ la del script)');
    console.log('  - Reinicia npm run dev después de cambiar .env');
  } else {
    console.log('✅ Login OK — sesión creada para:', signIn.user?.email);
  }
}

main();
