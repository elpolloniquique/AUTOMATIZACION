import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { apiFetch, formatDate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Post } from '@/types';
import { PLATFORM_LABELS } from '@/types';
import { Check, X } from 'lucide-react';

export default function ApprovalsPage() {
  const { session, profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => { loadPosts(); }, [profile]);

  async function loadPosts() {
    let query = supabase
      .from('posts')
      .select('*, branches(name)')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false });

    if (profile?.role !== 'super_admin' && profile?.branch_id) {
      query = query.eq('branch_id', profile.branch_id);
    }

    const { data } = await query;
    if (data) setPosts(data as Post[]);
  }

  async function handleApprove(postId: string) {
    if (!session?.access_token) return;
    setLoading(postId);
    try {
      await apiFetch(`/api/posts/${postId}/approve`, {
        method: 'POST',
        token: session.access_token,
      });
      loadPosts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(null);
    }
  }

  async function handleReject(postId: string) {
    if (!session?.access_token) return;
    setLoading(postId);
    try {
      await apiFetch(`/api/posts/${postId}/reject`, {
        method: 'POST',
        token: session.access_token,
      });
      loadPosts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Aprobaciones pendientes</h1>

      {posts.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-gray-500">No hay publicaciones pendientes de aprobación.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id}>
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-4 justify-between">
                  <div className="flex gap-4">
                    {(post.generated_image_url || post.media_url) && (
                      <img src={post.generated_image_url || post.media_url || ''} alt="" className="w-24 h-24 object-cover rounded-lg" />
                    )}
                    <div>
                      <h3 className="font-semibold">{post.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {(post as Post & { branches?: { name: string } }).branches?.name} · {PLATFORM_LABELS[post.platform]}
                      </p>
                      <p className="text-sm mt-2 line-clamp-2">{post.caption}</p>
                      <p className="text-xs text-gray-400 mt-1">Programada: {formatDate(post.scheduled_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge status={post.status} />
                    <Button size="sm" onClick={() => handleApprove(post.id)} disabled={loading === post.id}>
                      <Check className="w-4 h-4 mr-1" /> Aprobar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleReject(post.id)} disabled={loading === post.id}>
                      <X className="w-4 h-4 mr-1" /> Rechazar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
