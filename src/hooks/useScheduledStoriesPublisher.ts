import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/utils';

const POLL_MS = 20_000;

/** Publica historias programadas vencidas mientras la app está abierta. */
export function useScheduledStoriesPublisher() {
  const { session, profile } = useAuth();
  const running = useRef(false);

  useEffect(() => {
    if (!session?.access_token || !profile) return;

    let cancelled = false;

    async function tick() {
      if (cancelled || running.current) return;
      running.current = true;
      try {
        let q = supabase
          .from('scheduled_stories')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true);

        if (profile.role !== 'super_admin' && profile.branch_id) {
          q = q.eq('branch_id', profile.branch_id);
        }

        const { count } = await q;
        if (cancelled || !count) return;

        await apiFetch('/api/scheduled-stories/publish-due', {
          method: 'POST',
          token: session.access_token,
        });
        window.dispatchEvent(new CustomEvent('stories-auto-published'));
      } catch {
        // cron externo también intentará
      } finally {
        running.current = false;
      }
    }

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [session?.access_token, profile?.id, profile?.role, profile?.branch_id]);
}
