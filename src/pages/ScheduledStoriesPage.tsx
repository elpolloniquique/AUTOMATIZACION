import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Clock, History, Plus, Save, Send, Trash2, BookImage } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GallerySelectionBar } from '@/components/GallerySelectionBar';
import type { Branch, MediaGalleryItem, ScheduledStory, StoryPublication } from '@/types';

const DAY_OPTIONS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

interface GalleryPickState {
  selectedGalleryItems?: MediaGalleryItem[];
}

const emptyForm = (branchId: string) => ({
  title: '',
  branch_id: branchId,
  image_url: '',
  gallery_item_id: null as string | null,
  days_of_week: [1, 2, 3, 4, 5, 6, 0] as number[],
  publish_time: '10:00',
  is_active: true,
});

export default function ScheduledStoriesPage() {
  const { session, profile } = useAuth();
  const location = useLocation();
  const [tab, setTab] = useState<'schedule' | 'history'>('schedule');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [stories, setStories] = useState<ScheduledStory[]>([]);
  const [publications, setPublications] = useState<StoryPublication[]>([]);
  const [editing, setEditing] = useState<ScheduledStory | null>(null);
  const [form, setForm] = useState(emptyForm(''));
  const [selectedGallery, setSelectedGallery] = useState<MediaGalleryItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const canManage = profile?.role === 'super_admin' || profile?.role === 'admin_sucursal';
  const returnPath = '/stories';
  const branchesLoaded = useRef(false);

  function applyGalleryItem(item: MediaGalleryItem) {
    setSelectedGallery([item]);
    setForm((f) => ({
      ...f,
      image_url: item.public_url,
      gallery_item_id: item.id,
      title: f.title || item.title,
    }));
  }

  useEffect(() => {
    supabase.from('branches').select('*').eq('is_active', true).order('name').then(({ data }) => {
      if (!data?.length) return;
      setBranches(data as Branch[]);
      const def = profile?.branch_id || data[0]?.id || '';
      setBranchId((prev) => prev || def);
      if (!branchesLoaded.current) {
        branchesLoaded.current = true;
        setForm((prev) => {
          if (prev.image_url || prev.title.trim()) {
            return { ...prev, branch_id: prev.branch_id || def };
          }
          return emptyForm(def);
        });
      }
    });
  }, [profile]);

  useEffect(() => {
    const pick = location.state as GalleryPickState | null;
    if (pick?.selectedGalleryItems?.length) {
      applyGalleryItem(pick.selectedGalleryItems[0]);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    const url = selectedGallery[0]?.public_url;
    const id = selectedGallery[0]?.id;
    if (url && (form.image_url !== url || form.gallery_item_id !== id)) {
      setForm((f) => ({ ...f, image_url: url, gallery_item_id: id }));
    }
  }, [selectedGallery, form.image_url, form.gallery_item_id]);

  const loadStories = useCallback(async () => {
    if (!session?.access_token || !branchId) return;
    const res = await apiFetch<{ stories: ScheduledStory[] }>(
      `/api/scheduled-stories?branch_id=${branchId}`,
      { token: session.access_token },
    );
    setStories(res.stories.filter((s) => s.is_active));
  }, [session, branchId]);

  const loadPublications = useCallback(async () => {
    if (!session?.access_token || !branchId) return;
    const res = await apiFetch<{ publications: StoryPublication[] }>(
      `/api/story-publications?branch_id=${branchId}`,
      { token: session.access_token },
    );
    setPublications(res.publications);
  }, [session, branchId]);

  useEffect(() => { loadStories(); }, [loadStories]);
  useEffect(() => { loadPublications(); }, [loadPublications]);

  function startNew() {
    setEditing(null);
    setForm(emptyForm(branchId));
    setSelectedGallery([]);
  }

  function startEdit(story: ScheduledStory) {
    setEditing(story);
    setForm({
      title: story.title,
      branch_id: story.branch_id,
      image_url: story.image_url,
      gallery_item_id: story.gallery_item_id,
      days_of_week: story.days_of_week,
      publish_time: story.publish_time.slice(0, 5),
      is_active: story.is_active,
    });
    if (story.image_url) {
      setSelectedGallery([{
        id: story.gallery_item_id || story.id,
        title: story.title,
        public_url: story.image_url,
      } as MediaGalleryItem]);
    }
  }

  function toggleDay(day: number) {
    setForm((f) => ({
      ...f,
      days_of_week: f.days_of_week.includes(day)
        ? f.days_of_week.filter((d) => d !== day)
        : [...f.days_of_week, day].sort((a, b) => a - b),
    }));
  }

  async function handleSave() {
    if (!session?.access_token || !canManage) return;
    const imageUrl = selectedGallery[0]?.public_url || form.image_url;
    const galleryItemId = selectedGallery[0]?.id || form.gallery_item_id || null;

    if (!form.title.trim()) return alert('Nombre requerido');
    if (!imageUrl) return alert('Selecciona una imagen de la galería');
    if (form.days_of_week.length === 0) return alert('Selecciona al menos un día');

    setSaving(true);
    try {
      const payload = {
        ...form,
        branch_id: branchId,
        image_url: imageUrl,
        gallery_item_id: galleryItemId,
        publish_time: form.publish_time.length === 5 ? `${form.publish_time}:00` : form.publish_time,
        timezone: 'America/Santiago',
      };

      if (editing) {
        await apiFetch(`/api/scheduled-stories/${editing.id}`, {
          method: 'PUT',
          token: session.access_token,
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/scheduled-stories', {
          method: 'POST',
          token: session.access_token,
          body: JSON.stringify(payload),
        });
      }

      startNew();
      loadStories();
      alert('Historia programada guardada');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!session?.access_token || !confirm('¿Desactivar esta historia programada?')) return;
    await apiFetch(`/api/scheduled-stories/${id}`, { method: 'DELETE', token: session.access_token });
    loadStories();
    if (editing?.id === id) startNew();
  }

  async function handlePublishNow(id: string) {
    if (!session?.access_token) return;
    setPublishingId(id);
    try {
      await apiFetch(`/api/scheduled-stories/${id}/publish-now`, {
        method: 'POST',
        token: session.access_token,
      });
      alert('Historia publicada en Facebook');
      loadStories();
      loadPublications();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al publicar');
    } finally {
      setPublishingId(null);
    }
  }

  function formatDays(days: number[]) {
    return DAY_OPTIONS.filter((d) => days.includes(d.value)).map((d) => d.label).join(', ');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookImage className="w-7 h-7 text-pollon-red" />
            Historias programadas — Facebook
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Publica automáticamente en la Historia de tu Página de Facebook. Para varias historias al día, crea una plantilla por cada hora.
          </p>
        </div>
        <div className="flex gap-2 items-end">
          <div>
            <Label className="text-xs">Sucursal</Label>
            <select
              className="border rounded-md h-10 px-3 min-w-[200px]"
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value);
                setForm((f) => ({ ...emptyForm(e.target.value), title: f.title, image_url: f.image_url, gallery_item_id: f.gallery_item_id, days_of_week: f.days_of_week, publish_time: f.publish_time, is_active: f.is_active }));
                setEditing(null);
              }}
            >
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          {canManage && (
            <Button onClick={startNew}><Plus className="w-4 h-4 mr-1" /> Nueva</Button>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-b">
        <button
          type="button"
          onClick={() => setTab('schedule')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'schedule' ? 'border-pollon-red text-pollon-red' : 'border-transparent text-gray-500'}`}
        >
          <Clock className="w-4 h-4 inline mr-1" /> Programadas
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'history' ? 'border-pollon-red text-pollon-red' : 'border-transparent text-gray-500'}`}
        >
          <History className="w-4 h-4 inline mr-1" /> Historial
        </button>
      </div>

      {tab === 'schedule' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {stories.map((s) => (
              <Card key={s.id} className={editing?.id === s.id ? 'ring-2 ring-pollon-red' : ''}>
                <CardContent className="p-4 flex gap-4">
                  <img src={s.image_url} alt={s.title} className="w-16 h-28 object-cover rounded-lg border" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{s.title}</h3>
                    <p className="text-xs text-gray-500 mt-1">{formatDays(s.days_of_week)} · {s.publish_time.slice(0, 5)}</p>
                    {s.last_published_at && (
                      <p className="text-xs text-green-700 mt-1">Última: {new Date(s.last_published_at).toLocaleString('es-CL')}</p>
                    )}
                    {s.last_publish_error && (
                      <p className="text-xs text-red-600 mt-1 truncate">{s.last_publish_error}</p>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex flex-col gap-1">
                      <Button size="sm" variant="outline" onClick={() => startEdit(s)}>Editar</Button>
                      <Button size="sm" variant="secondary" disabled={publishingId === s.id}
                        onClick={() => handlePublishNow(s.id)}>
                        <Send className="w-3 h-3 mr-1" />
                        {publishingId === s.id ? '...' : 'Ahora'}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(s.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {stories.length === 0 && (
              <Card><CardContent className="p-8 text-center text-gray-500">No hay historias programadas.</CardContent></Card>
            )}
          </div>

          {canManage && (
            <Card className="lg:sticky lg:top-4 self-start">
              <CardHeader>
                <CardTitle className="text-base">{editing ? 'Editar historia' : 'Nueva historia programada'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Nombre / referencia</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Ej: Promo lunes mañana" />
                </div>

                <GallerySelectionBar
                  selected={selectedGallery}
                  maxPhotos={1}
                  onRemove={() => {
                    setSelectedGallery([]);
                    setForm((f) => ({ ...f, image_url: '', gallery_item_id: null }));
                  }}
                  returnPath={returnPath}
                />

                <div>
                  <Label className="mb-2 block">Días de publicación</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAY_OPTIONS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleDay(d.value)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                          form.days_of_week.includes(d.value)
                            ? 'bg-pollon-red text-white border-pollon-red'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-pollon-red'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Hora de publicación (Chile)</Label>
                  <Input type="time" value={form.publish_time}
                    onChange={(e) => setForm({ ...form, publish_time: e.target.value })} />
                  <p className="text-xs text-gray-500 mt-1">Zona horaria: America/Santiago. El cron revisa cada 5 minutos.</p>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                  Activa (publicar automáticamente)
                </label>

                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={saving} className="flex-1">
                    <Save className="w-4 h-4 mr-1" /> {saving ? 'Guardando...' : 'Guardar'}
                  </Button>
                  {editing && (
                    <Button variant="outline" onClick={startNew}>Cancelar</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          {publications.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4 flex gap-4 items-center">
                <img src={p.image_url} alt="" className="w-12 h-20 object-cover rounded border" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{p.title || p.scheduled_stories?.title || 'Historia'}</p>
                  <p className="text-xs text-gray-500">
                    {p.published_at ? new Date(p.published_at).toLocaleString('es-CL') : new Date(p.created_at).toLocaleString('es-CL')}
                  </p>
                  {p.error_message && <p className="text-xs text-red-600 truncate">{p.error_message}</p>}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  p.status === 'success' ? 'bg-green-100 text-green-800'
                    : p.status === 'failed' ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {p.status === 'success' ? 'Publicada' : p.status === 'failed' ? 'Error' : 'Pendiente'}
                </span>
                {p.story_url && (
                  <a href={p.story_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">Ver</a>
                )}
              </CardContent>
            </Card>
          ))}
          {publications.length === 0 && (
            <Card><CardContent className="p-8 text-center text-gray-500">Aún no hay historias publicadas.</CardContent></Card>
          )}
        </div>
      )}
    </div>
  );
}
