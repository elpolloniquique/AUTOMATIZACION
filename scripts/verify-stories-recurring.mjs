/**
 * Verifica lógica de historias recurrentes y endpoints en producción.
 * Uso: node scripts/verify-stories-recurring.mjs
 */
import dotenv from 'dotenv';

dotenv.config();

const PROD = 'https://automatizacion-seven.vercel.app';

function ok(msg) { console.log('✅', msg); }
function fail(msg) { console.error('❌', msg); process.exit(1); }

async function main() {
  const health = await fetch(`${PROD}/api/health`).then((r) => r.json());
  if (health.status !== 'ok') fail('Health check falló');
  ok('Health OK');

  const { isPublishTimeReached, alreadyPublishedToday, isDayScheduled } = await import('../dist/server/utils/santiagoTime.js');

  const dueCase = {
    hour: 18, minute: 0, dayOfWeek: 1,
    dateKey: '2026-06-23',
    year: 2026, month: 6, day: 23,
    timeKey: '18:00',
  };
  if (!isPublishTimeReached(dueCase, '17:43:00')) fail('17:43 debería estar vencido a las 18:00');
  ok('Hora 17:43 alcanzada a las 18:00');

  if (isPublishTimeReached({ ...dueCase, hour: 17, minute: 30 }, '17:43:00')) {
    fail('17:30 no debería alcanzar 17:43');
  }
  ok('Antes de la hora programada no publica');

  if (alreadyPublishedToday('2026-06-23T20:44:00.000Z', dueCase)) {
    ok('Detecta ya publicado hoy');
  } else {
    fail('No detectó publicación del mismo día');
  }

  if (!alreadyPublishedToday('2026-06-22T20:44:00.000Z', dueCase)) {
    ok('Permite publicar al día siguiente');
  } else {
    fail('Bloqueó incorrectamente el día siguiente');
  }

  if (!isDayScheduled([1, 2, 3, 4, 5, 6, 0], 1)) fail('Lunes no detectado');
  ok('Días de la semana OK');

  const cron = await fetch(`${PROD}/api/cron/publish-due-stories`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
      'Content-Type': 'application/json',
    },
  }).then((r) => r.json());

  if (!cron.success) fail(`Cron historias: ${JSON.stringify(cron)}`);
  ok(`Cron historias OK (skipped=${cron.skipped ?? 0})`);

  console.log('\n🎉 Verificación de historias recurrentes completada.');
}

main().catch((e) => fail(e.message || String(e)));
