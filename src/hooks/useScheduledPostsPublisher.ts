import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/utils';

const POLL_MS = 20_000;

/**
 * Publica automáticamente posts programados vencidos mientras la app está abierta.
 * Respaldo cuando GitHub Actions tiene retraso (puede tardar varios minutos).
 */
export function useScheduledPostsPublisher() {
  const { session, profile } = useAuth();
  const running = useRef(false);

  useEffect(() => {
    if (!session?.access_token || !profile) return;

    let cancelled = false;

    async function tick() {
      if (cancelled || running.current) return;
      running.current = true;
      try {
        const now = new Date().toISOString();
        let q = supabase
          .from('posts')
          .select('id')
          .eq('status', 'scheduled')
          .eq('approval_status', 'approved')
          .lte('scheduled_at', now)
          .limit(1);

        if (profile.role !== 'super_admin' && profile.branch_id) {
          q = q.eq('branch_id', profile.branch_id);
        }

        const { data } = await q;
        if (cancelled || !data?.length) return;

        await apiFetch('/api/posts/publish-due', {
          method: 'POST',
          token: session.access_token,
        });
        window.dispatchEvent(new CustomEvent('posts-auto-published'));
      } catch {
        // silencioso — el cron externo también intentará
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
