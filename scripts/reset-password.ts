/**
 * Restablecer contraseña sin correo (usa Service Role Key)
 * Uso: npx tsx scripts/reset-password.ts tu@email.com TuNuevaClave123
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.error('Uso: npx tsx scripts/reset-password.ts EMAIL NUEVA_CONTRASEÑA');
  console.error('Ejemplo: npx tsx scripts/reset-password.ts tutacanehuillca@gmail.com Pollon2026');
  process.exit(1);
}

if (newPassword.length < 6) {
  console.error('La contraseña debe tener al menos 6 caracteres.');
  process.exit(1);
}

const url = process.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: list, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('Error listando usuarios:', listError.message);
    process.exit(1);
  }

  const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    console.error(`No se encontró usuario con email: ${email}`);
    process.exit(1);
  }

  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });

  if (error) {
    console.error('Error actualizando contraseña:', error.message);
    process.exit(1);
  }

  console.log('✅ Contraseña actualizada correctamente para:', email);
  console.log('Ahora inicia sesión en http://localhost:5173/login');
}

main();
