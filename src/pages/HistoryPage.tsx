import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { apiFetch, formatDate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Post, PostLog, Platform } from '@/types';
import { PLATFORM_LABELS, STATUS_LABELS } from '@/types';
import { RefreshCw, Pencil, Copy, Calendar, ImageIcon } from 'lucide-react';

type Tab = 'publications' | 'logs';

export default function HistoryPage() {
  const { session, profile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('publications');
  const [posts, setPosts] = useState<(Post & { branches?: { name: string } })[]>([]);
  const [logs, setLogs] = useState<(PostLog & { posts?: { title: string; branch_id: string } })[]>([]);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [republishing, setRepublishing] = useState<string | null>(null);
  const [republishPost, setRepublishPost] = useState<Post | null>(null);
  const [republishDate, setRepublishDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadPosts();
    loadLogs();
  }, [profile]);

  async function loadPosts() {
    let query = supabase
      .from('posts')
      .select('*, branches(name)')
      .order('updated_at', { ascending: false })
      .limit(100);

    if (profile?.branch_id && profile.role !== 'super_admin') {
      query = query.eq('branch_id', profile.branch_id);
    }

    const { data } = await query;
    if (data) setPosts(data as typeof posts);
  }

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
      await apiFetch(`/api/posts/${postId}/retry`, { method: 'POST', token: session.access_token });
      loadPosts();
      loadLogs();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al reintentar');
    } finally {
      setRetrying(null);
    }
  }

  async function handleRepublish() {
    if (!republishPost || !session?.access_token) return;
    setRepublishing(republishPost.id);
    try {
      const result = await apiFetch<{ post: Post }>(`/api/posts/${republishPost.id}/republish`, {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({
          scheduled_at: republishDate || undefined,
        }),
      });
      setRepublishPost(null);
      setRepublishDate('');
      loadPosts();
      navigate(`/posts/${result.post.id}/edit`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al republicar');
    } finally {
      setRepublishing(null);
    }
  }

  const filteredPosts = statusFilter === 'all'
    ? posts
    : posts.filter((p) => p.status === statusFilter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Historial de publicaciones</h1>
        <p className="text-gray-500 text-sm mt-1">
          Revisa, edita o republica publicaciones anteriores con el mismo formato.
        </p>
      </div>

      <div className="flex gap-2 border-b pb-2">
        <button
          type="button"
          onClick={() => setTab('publications')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg ${tab === 'publications' ? 'bg-pollon-red text-white' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          Mis publicaciones
        </button>
        <button
          type="button"
          onClick={() => setTab('logs')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg ${tab === 'logs' ? 'bg-pollon-red text-white' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          Registro técnico
        </button>
      </div>

      {tab === 'publications' && (
        <>
          <div className="flex flex-wrap gap-2">
            {['all', 'published', 'scheduled', 'draft', 'failed', 'pending_approval'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-3 py-1.5 rounded-full ${statusFilter === s ? 'bg-gray-900 text-white' : 'bg-gray-100'}`}
              >
                {s === 'all' ? 'Todas' : STATUS_LABELS[s as keyof typeof STATUS_LABELS] || s}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredPosts.map((post) => (
              <Card key={post.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="aspect-video bg-gray-100 relative">
                  {post.generated_image_url || post.media_url ? (
                    <img
                      src={post.generated_image_url || post.media_url || ''}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <ImageIcon className="w-10 h-10 opacity-30" />
                    </div>
                  )}
                  <Badge status={post.status} className="absolute top-2 left-2" />
                </div>
                <CardContent className="p-4 space-y-2">
                  <h3 className="font-semibold text-sm line-clamp-2">{post.title}</h3>
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <p>{PLATFORM_LABELS[post.platform as Platform]}</p>
                    <p>{post.branches?.name}</p>
                    {post.published_at && <p>Publicada: {formatDate(post.published_at)}</p>}
                    {post.scheduled_at && post.status !== 'published' && (
                      <p>Programada: {formatDate(post.scheduled_at)}</p>
                    )}
                    {post.media_urls && post.media_urls.length > 1 && (
                      <p className="text-green-600">{post.media_urls.length} fotos en collage</p>
                    )}
                  </div>
                  {post.hashtags && post.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {post.hashtags.slice(0, 4).map((h) => (
                        <span key={h} className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">#{h}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={() => navigate(`/posts/${post.id}/edit`)}>
                      <Pencil className="w-3 h-3 mr-1" /> Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setRepublishPost(post);
                        setRepublishDate('');
                      }}
                    >
                      <Copy className="w-3 h-3 mr-1" /> Republicar
                    </Button>
                    {post.status === 'failed' && (
                      <Button size="sm" variant="outline" onClick={() => handleRetry(post.id)} disabled={retrying === post.id}>
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Reintentar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredPosts.length === 0 && (
            <Card><CardContent className="p-8 text-center text-gray-500">No hay publicaciones en este filtro.</CardContent></Card>
          )}
        </>
      )}

      {tab === 'logs' && (
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
                        <RefreshCw className="w-3 h-3 mr-1" /> Reintentar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && (
            <Card><CardContent className="p-8 text-center text-gray-500">Sin registros técnicos.</CardContent></Card>
          )}
        </div>
      )}

      {republishPost && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 space-y-4">
              <h3 className="font-bold text-lg">Republicar publicación</h3>
              <p className="text-sm text-gray-600">
                Se creará una copia de <strong>{republishPost.title}</strong> con el mismo texto, imagen y hashtags.
              </p>
              <div>
                <Label className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" /> Nueva fecha (opcional)
                </Label>
                <Input
                  type="datetime-local"
                  value={republishDate}
                  onChange={(e) => setRepublishDate(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-gray-400 mt-1">Si la dejas vacía, se guardará como borrador.</p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setRepublishPost(null)}>Cancelar</Button>
                <Button onClick={handleRepublish} disabled={republishing === republishPost.id}>
                  {republishing ? 'Creando...' : 'Republicar y editar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
