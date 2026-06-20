/**
 * Verifica que el cron de publicaciones programadas responda en producción.
 * Uso: node scripts/verify-cron.mjs
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const raw = readFileSync(join(__dirname, '../.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    }
  } catch { /* optional */ }
}

loadEnv();

const APP_URL = process.env.APP_URL || 'https://automatizacion-seven.vercel.app';
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.error('❌ CRON_SECRET no encontrado en .env');
  process.exit(1);
}

const res = await fetch(`${APP_URL}/api/cron/publish-due-posts`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${CRON_SECRET}`,
    'Content-Type': 'application/json',
  },
});

const body = await res.json();
console.log(`HTTP ${res.status}`, JSON.stringify(body, null, 2));

if (!res.ok) {
  console.error('❌ Cron falló');
  process.exit(1);
}

console.log('✅ Cron de publicaciones OK');
if (body.published > 0) {
  console.log(`   Publicadas ahora: ${body.published}`);
}
