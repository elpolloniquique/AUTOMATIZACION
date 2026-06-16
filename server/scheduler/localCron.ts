/**
 * Scheduler local con node-cron — solo para desarrollo.
 * En producción usa GitHub Actions → POST /api/cron/publish-due-posts
 */
import cron from 'node-cron';
import { publishDuePosts } from '../jobs/publishDuePosts.js';

const CRON_SCHEDULE = '*/15 * * * *'; // cada 15 minutos

export function startLocalCron() {
  if (process.env.NODE_ENV === 'production') {
    console.log('[scheduler] Cron local deshabilitado en producción. Usa GitHub Actions.');
    return;
  }

  if (process.env.ENABLE_LOCAL_CRON !== 'true') {
    console.log('[scheduler] Cron local inactivo. Activa con ENABLE_LOCAL_CRON=true');
    return;
  }

  cron.schedule(CRON_SCHEDULE, async () => {
    console.log('[scheduler] Ejecutando publishDuePosts...');
    try {
      const result = await publishDuePosts();
      console.log('[scheduler] Resultado:', result);
    } catch (err) {
      console.error('[scheduler] Error:', err);
    }
  });

  console.log(`[scheduler] Cron local activo: ${CRON_SCHEDULE}`);
}
