import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { apiFetch, formatDate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PostLog } from '@/types';
import { RefreshCw } from 'lucide-react';

export default function HistoryPage() {
  const { session, profile } = useAuth();
  const [logs, setLogs] = useState<(PostLog & { posts?: { title: string; branch_id: string } })[]>([]);
  const [retrying, setRetrying] = useState<string | null>(null);

  useEffect(() => { loadLogs(); }, [profile]);

  async function loadLogs() {
    const { data } = await supabase
      .from('post_logs')
      .select('*, posts(title, branch_id)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (data) setLogs(data as typeof logs);
  }

  async function handleRetry(postId: string) {
    if (!session?.access_token) return;
    setRetrying(postId);
    try {
      await apiFetch(`/api/posts/${postId}/retry`, {
        method: 'POST',
        token: session.access_token,
      });
      loadLogs();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al reintentar');
    } finally {
      setRetrying(null);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Historial de publicaciones</h1>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-3 pr-4">Fecha</th>
              <th className="pb-3 pr-4">Publicación</th>
              <th className="pb-3 pr-4">Plataforma</th>
              <th className="pb-3 pr-4">Acción</th>
              <th className="pb-3 pr-4">Estado</th>
              <th className="pb-3 pr-4">Error</th>
              <th className="pb-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b hover:bg-gray-50">
                <td className="py-3 pr-4 whitespace-nowrap">{formatDate(log.created_at)}</td>
                <td className="py-3 pr-4">{log.posts?.title || log.post_id.slice(0, 8)}</td>
                <td className="py-3 pr-4 capitalize">{log.platform}</td>
                <td className="py-3 pr-4">{log.action}</td>
                <td className="py-3 pr-4"><Badge status={log.status} /></td>
                <td className="py-3 pr-4 text-red-600 max-w-xs truncate">{log.error_message || '—'}</td>
                <td className="py-3">
                  {log.status === 'failed' && (
                    <Button size="sm" variant="outline" onClick={() => handleRetry(log.post_id)} disabled={retrying === log.post_id}>
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Reintentar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {logs.length === 0 && (
        <Card><CardContent className="p-8 text-center text-gray-500">Sin registros aún.</CardContent></Card>
      )}
    </div>
  );
}
