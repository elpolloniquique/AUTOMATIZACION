import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Clock, History, Plus, Save, Send, Trash2, BookImage, Link2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { apiFetch, formatDate, fromDatetimeLocalValue, toDatetimeLocalValue } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GallerySelectionBar } from '@/components/GallerySelectionBar';
import type { Branch, MediaGalleryItem, ScheduledStory, StoryPublication } from '@/types';
import {
  DEFAULT_STORY_LINK_URL,
  normalizeStoryLinkUrl,
  resolveBranchWebsiteUrl,
  STORY_LINK_BUTTON_LABELS,
} from '@/constants/storyLinkButton';

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

const emptyForm = (branchId: string, branchWebsite?: string | null) => ({
  title: '',
  branch_id: branchId,
  image_url: '',
  gallery_item_id: null as string | null,
  schedule_mode: 'recurring' as 'recurring' | 'once',
  scheduled_at: '',
  days_of_week: [1, 2, 3, 4, 5, 6, 0] as number[],
  publish_time: '10:00',
  is_active: true,
  link_button_enabled: true,
  link_button_text: 'Comprar',
  link_button_url: resolveBranchWebsiteUrl(branchWebsite),
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
  const selectedBranch = branches.find((b) => b.id === branchId);
  const previewImageUrl = selectedGallery[0]?.public_url || form.image_url;

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
          return emptyForm(def, data.find((b) => b.id === def)?.website);
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

  useEffect(() => {
    const onAuto = () => {
      loadStories();
      loadPublications();
    };
    window.addEventListener('stories-auto-published', onAuto);
    return () => window.removeEventListener('stories-auto-published', onAuto);
  }, [loadStories, loadPublications]);

  function startNew() {
    setEditing(null);
    setForm(emptyForm(branchId, selectedBranch?.website));
    setSelectedGallery([]);
  }

  function startEdit(story: ScheduledStory) {
    setEditing(story);
    const mode = story.schedule_mode || 'recurring';
    setForm({
      title: story.title,
      branch_id: story.branch_id,
      image_url: story.image_url,
      gallery_item_id: story.gallery_item_id,
      schedule_mode: mode,
      scheduled_at: mode === 'once' ? toDatetimeLocalValue(story.scheduled_at) : '',
      days_of_week: story.days_of_week,
      publish_time: story.publish_time.slice(0, 5),
      is_active: story.is_active,
      link_button_enabled: story.link_button_enabled !== false,
      link_button_text: story.link_button_text || 'Comprar',
      link_button_url: story.link_button_url || DEFAULT_STORY_LINK_URL,
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
    if (form.schedule_mode === 'recurring' && form.days_of_week.length === 0) {
      return alert('Selecciona al menos un día');
    }
    if (form.schedule_mode === 'once' && !form.scheduled_at) {
      return alert('Indica fecha y hora de publicación');
    }
    if (form.link_button_enabled) {
      const normalized = normalizeStoryLinkUrl(form.link_button_url);
      if (!form.link_button_url?.trim()) {
        return alert('Indica el enlace de tu página web para el botón');
      }
      try {
        new URL(normalized);
      } catch {
        return alert('El enlace del botón no es una URL válida');
      }
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        branch_id: branchId,
        image_url: imageUrl,
        gallery_item_id: galleryItemId,
        link_button_url: form.link_button_enabled
          ? normalizeStoryLinkUrl(form.link_button_url)
          : null,
        publish_time: form.schedule_mode === 'recurring'
          ? (form.publish_time.length === 5 ? `${form.publish_time}:00` : form.publish_time)
          : undefined,
        scheduled_at: form.schedule_mode === 'once'
          ? fromDatetimeLocalValue(form.scheduled_at)
          : null,
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

  function formatSchedule(story: ScheduledStory) {
    if ((story.schedule_mode || 'recurring') === 'once' && story.scheduled_at) {
      return `Una vez: ${formatDate(story.scheduled_at)}`;
    }
    return `${formatDays(story.days_of_week)} · ${story.publish_time.slice(0, 5)}`;
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
                const nextBranchId = e.target.value;
                const nextBranch = branches.find((b) => b.id === nextBranchId);
                setBranchId(nextBranchId);
                setForm((f) => ({
                  ...emptyForm(nextBranchId, nextBranch?.website),
                  title: f.title,
                  image_url: f.image_url,
                  gallery_item_id: f.gallery_item_id,
                  days_of_week: f.days_of_week,
                  publish_time: f.publish_time,
                  is_active: f.is_active,
                  schedule_mode: f.schedule_mode,
                  scheduled_at: f.scheduled_at,
                  link_button_enabled: f.link_button_enabled,
                  link_button_text: f.link_button_text,
                  link_button_url: f.link_button_url || resolveBranchWebsiteUrl(nextBranch?.website),
                }));
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
                    <p className="text-xs text-gray-500 mt-1">{formatSchedule(s)}</p>
                    {s.link_button_enabled !== false && (
                      <p className="text-xs text-blue-700 mt-1 flex items-center gap-1 truncate">
                        <Link2 className="w-3 h-3 shrink-0" />
                        {s.link_button_text || 'Comprar'} · {s.link_button_url || DEFAULT_STORY_LINK_URL}
                      </p>
                    )}
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

                <div className="rounded-xl border bg-gray-50/80 p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-pollon-red" />
                        Añadir botón
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Botón &quot;Enlace web&quot; con código QR escaneable hacia tu página (la API de Facebook no permite enlace clickeable directo en historias automáticas).
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-sm shrink-0">
                      <input
                        type="checkbox"
                        checked={form.link_button_enabled}
                        onChange={(e) => setForm({ ...form, link_button_enabled: e.target.checked })}
                      />
                      Activar
                    </label>
                  </div>

                  {form.link_button_enabled && (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-gray-600">Tipo de botón</Label>
                        <div className="mt-1 px-3 py-2 rounded-lg border bg-white text-sm text-gray-700">
                          Botón &quot;Enlace web&quot;
                        </div>
                      </div>

                      <div>
                        <Label>Texto del botón</Label>
                        <select
                          className="mt-1 w-full border rounded-md h-10 px-3 bg-white"
                          value={form.link_button_text}
                          onChange={(e) => setForm({ ...form, link_button_text: e.target.value })}
                        >
                          {STORY_LINK_BUTTON_LABELS.map((label) => (
                            <option key={label} value={label}>{label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <Label>Introducir enlace</Label>
                        <div className="relative mt-1">
                          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            className="pl-9"
                            value={form.link_button_url}
                            onChange={(e) => setForm({ ...form, link_button_url: e.target.value })}
                            placeholder="https://www.el-pollon.cl/"
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          URL de tu página web. Se incluye código QR escaneable en la historia publicada.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {previewImageUrl && (
                  <div>
                    <Label className="mb-2 block">Vista previa</Label>
                    <div className="mx-auto w-full max-w-[220px]">
                      <div className="relative aspect-[9/16] rounded-2xl overflow-hidden border shadow-md bg-black">
                        <img
                          src={previewImageUrl}
                          alt="Vista previa historia"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        {form.link_button_enabled && (
                          <div className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-2 px-4 pointer-events-none">
                            <span className="bg-white text-[#050505] text-sm font-semibold px-6 py-2.5 rounded-full shadow-lg">
                              {form.link_button_text || 'Comprar'}
                            </span>
                            <span className="w-10 h-10 bg-white rounded border-2 border-gray-300 flex items-center justify-center text-[8px] text-gray-500 font-bold">QR</span>
                            <span className="text-white text-[10px] drop-shadow">Escanea para abrir enlace</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <Label className="mb-2 block">Tipo de programación</Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, schedule_mode: 'recurring' })}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border ${
                        form.schedule_mode === 'recurring'
                          ? 'bg-pollon-red text-white border-pollon-red'
                          : 'bg-white text-gray-600 border-gray-300'
                      }`}
                    >
                      Recurrente (días + hora)
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, schedule_mode: 'once' })}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border ${
                        form.schedule_mode === 'once'
                          ? 'bg-pollon-red text-white border-pollon-red'
                          : 'bg-white text-gray-600 border-gray-300'
                      }`}
                    >
                      Una sola fecha y hora
                    </button>
                  </div>
                </div>

                {form.schedule_mode === 'once' ? (
                  <div>
                    <Label>Fecha y hora de publicación (hora Chile)</Label>
                    <Input
                      type="datetime-local"
                      value={form.scheduled_at}
                      onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Se publica automáticamente en esa fecha y hora (máx. ~1 minuto). Zona: America/Santiago.
                    </p>
                  </div>
                ) : (
                  <>
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
                      <p className="text-xs text-gray-500 mt-1">
                        Se repite en los días seleccionados. Publicación automática cada minuto; si se pierde la hora exacta, publica en cuanto detecta que ya pasó (mismo día).
                      </p>
                    </div>
                  </>
                )}

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
