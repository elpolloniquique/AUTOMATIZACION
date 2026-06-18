import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PostTemplate, PostType } from '@/types';
import { POST_TYPE_LABELS } from '@/types';
import { LayoutTemplate, Plus, Pencil, Trash2, X, Eye, EyeOff, Code2 } from 'lucide-react';

const PLATFORMS = [
  { value: 'all', label: 'Todas las redes' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'google_business', label: 'Google Business' },
];

const emptyForm = {
  name: '',
  type: 'oferta' as PostType,
  platform: 'all',
  html_template: 'oferta-familiar',
  default_caption: '',
  html_content: '',
  is_active: true,
};

export default function TemplatesPage() {
  const { profile, session } = useAuth();
  const [templates, setTemplates] = useState<PostTemplate[]>([]);
  const [htmlSlugs, setHtmlSlugs] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<PostType | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PostTemplate | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const canManage = profile?.role === 'super_admin' || profile?.role === 'admin_sucursal';

  useEffect(() => {
    loadTemplates();
    if (session?.access_token) {
      apiFetch<{ slugs: string[] }>('/api/templates/html-slugs', { token: session.access_token })
        .then((r) => setHtmlSlugs(r.slugs))
        .catch(() => setHtmlSlugs(['oferta-familiar', 'combo-dos', 'delivery', 'producto-destacado', 'promo-fin-semana']));
    }
  }, [session, profile]);

  async function loadTemplates() {
    let query = supabase.from('post_templates').select('*').order('name');
    if (!canManage) query = query.eq('is_active', true);
    const { data } = await query;
    if (data) setTemplates(data as PostTemplate[]);
  }

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setShowAdvanced(false);
    setShowForm(true);
  }

  function openEdit(t: PostTemplate) {
    setEditing(t);
    setForm({
      name: t.name,
      type: t.type,
      platform: t.platform || 'all',
      html_template: t.html_template || 'oferta-familiar',
      default_caption: t.default_caption || '',
      html_content: t.html_content || '',
      is_active: t.is_active,
    });
    setShowAdvanced(Boolean(t.html_content));
    setShowForm(true);
  }

  async function saveTemplate() {
    if (!form.name.trim()) return alert('El nombre es obligatorio');
    if (!form.html_template.trim()) return alert('Selecciona un diseño HTML');

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      type: form.type,
      platform: form.platform,
      html_template: form.html_template.trim(),
      default_caption: form.default_caption.trim() || null,
      html_content: form.html_content.trim() || null,
      is_active: form.is_active,
    };

    const { error } = editing
      ? await supabase.from('post_templates').update(payload).eq('id', editing.id)
      : await supabase.from('post_templates').insert(payload);

    setSaving(false);
    if (error) {
      alert(error.message);
    } else {
      setShowForm(false);
      setEditing(null);
      loadTemplates();
    }
  }

  async function deleteTemplate(t: PostTemplate) {
    if (!confirm(`¿Eliminar la plantilla "${t.name}"?\n\nEsta acción no se puede deshacer.`)) return;

    const { count } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('template_id', t.id);

    if (count && count > 0) {
      if (!confirm(`Hay ${count} publicación(es) usando esta plantilla. ¿Desactivar en lugar de eliminar?`)) return;
      await supabase.from('post_templates').update({ is_active: false }).eq('id', t.id);
    } else {
      await supabase.from('post_templates').delete().eq('id', t.id);
    }
    loadTemplates();
  }

  async function toggleActive(t: PostTemplate) {
    await supabase.from('post_templates').update({ is_active: !t.is_active }).eq('id', t.id);
    loadTemplates();
  }

  const filtered = filterType === 'all' ? templates : templates.filter((t) => t.type === filterType);
  const previewTemplate = templates.find((t) => t.id === previewId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutTemplate className="w-7 h-7 text-pollon-red" />
            Plantillas de contenido
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Gestiona captions predeterminados y diseños HTML para generar imágenes profesionales.
          </p>
        </div>
        {canManage && (
          <Button onClick={openNew}>
            <Plus className="w-4 h-4 mr-1" /> Nueva plantilla
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={() => setFilterType('all')}
          className={`text-sm px-3 py-1.5 rounded-full ${filterType === 'all' ? 'bg-pollon-red text-white' : 'bg-gray-100'}`}
        >
          Todas ({templates.length})
        </button>
        {(Object.keys(POST_TYPE_LABELS) as PostType[]).map((type) => {
          const count = templates.filter((t) => t.type === type).length;
          if (count === 0) return null;
          return (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(type)}
              className={`text-sm px-3 py-1.5 rounded-full ${filterType === type ? 'bg-pollon-red text-white' : 'bg-gray-100'}`}
            >
              {POST_TYPE_LABELS[type]} ({count})
            </button>
          );
        })}
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((t) => (
          <Card key={t.id} className={`overflow-hidden transition-shadow hover:shadow-md group ${!t.is_active ? 'opacity-60' : ''}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-start justify-between gap-2">
                <span className="line-clamp-1">{t.name}</span>
                <Badge status={t.type} label={POST_TYPE_LABELS[t.type]} />
              </CardTitle>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono">
                  HTML: {t.html_template}
                </span>
                {t.html_content && (
                  <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                    HTML personalizado
                  </span>
                )}
                {!t.is_active && (
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Inactiva</span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-600 line-clamp-4 whitespace-pre-wrap leading-relaxed">
                {t.default_caption || 'Sin caption predeterminado'}
              </p>
              <p className="text-xs text-gray-400">
                Plataforma: {PLATFORMS.find((p) => p.value === t.platform)?.label || t.platform}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => setPreviewId(t.id)}>
                  <Eye className="w-3 h-3 mr-1" /> Ver caption
                </Button>
                {canManage && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => openEdit(t)}>
                      <Pencil className="w-3 h-3 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleActive(t)}>
                      {t.is_active ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteTemplate(t)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center text-gray-500">
            <LayoutTemplate className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No hay plantillas en esta categoría.</p>
            {canManage && (
              <Button className="mt-4" onClick={openNew}>
                <Plus className="w-4 h-4 mr-1" /> Crear primera plantilla
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <Card className="w-full max-w-2xl my-8">
            <CardHeader className="flex flex-row items-center justify-between border-b">
              <CardTitle>{editing ? 'Editar plantilla' : 'Nueva plantilla'}</CardTitle>
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>Nombre de la plantilla *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ej: Oferta Familiar Verano"
                  />
                </div>
                <div>
                  <Label>Tipo de publicación *</Label>
                  <select
                    className="w-full border rounded-md h-10 px-3 mt-1"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as PostType })}
                  >
                    {(Object.keys(POST_TYPE_LABELS) as PostType[]).map((type) => (
                      <option key={type} value={type}>{POST_TYPE_LABELS[type]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Plataforma</Label>
                  <select
                    className="w-full border rounded-md h-10 px-3 mt-1"
                    value={form.platform}
                    onChange={(e) => setForm({ ...form, platform: e.target.value })}
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <Label>Diseño HTML para imagen *</Label>
                  <select
                    className="w-full border rounded-md h-10 px-3 mt-1"
                    value={form.html_template}
                    onChange={(e) => setForm({ ...form, html_template: e.target.value })}
                  >
                    {htmlSlugs.map((slug) => (
                      <option key={slug} value={slug}>{slug}</option>
                    ))}
                    {!htmlSlugs.includes(form.html_template) && form.html_template && (
                      <option value={form.html_template}>{form.html_template}</option>
                    )}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Define el layout visual al generar imágenes con plantilla HTML.
                  </p>
                </div>
              </div>

              <div>
                <Label>Caption predeterminado</Label>
                <textarea
                  className="w-full border rounded-md p-3 text-sm min-h-[160px] mt-1 font-mono leading-relaxed"
                  value={form.default_caption}
                  onChange={(e) => setForm({ ...form, default_caption: e.target.value })}
                  placeholder="Texto que se sugiere al crear publicaciones de este tipo. Incluye emojis, WhatsApp, web..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                <Label htmlFor="is_active">Plantilla activa (visible al crear publicaciones)</Label>
              </div>

              <button
                type="button"
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-pollon-red"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <Code2 className="w-4 h-4" />
                {showAdvanced ? 'Ocultar HTML avanzado' : 'HTML personalizado (avanzado)'}
              </button>

              {showAdvanced && (
                <div className="border rounded-lg p-4 bg-gray-50 space-y-2">
                  <Label>HTML personalizado (opcional)</Label>
                  <textarea
                    className="w-full border rounded-md p-3 text-xs min-h-[200px] font-mono"
                    value={form.html_content}
                    onChange={(e) => setForm({ ...form, html_content: e.target.value })}
                    placeholder="<!DOCTYPE html>... Usa variables: {{offerTitle}}, {{price}}, {{branchName}}, {{brandColor}}, {{cta}}, {{productImageUrl}}"
                  />
                  <p className="text-[11px] text-gray-500">
                    Si lo completas, reemplaza el archivo HTML del diseño seleccionado. Tamaño recomendado: 1080×1080 px.
                  </p>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>
                  Cancelar
                </Button>
                <Button onClick={saveTemplate} disabled={saving}>
                  {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear plantilla'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {previewTemplate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreviewId(null)}>
          <Card className="w-full max-w-lg max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="flex flex-row items-center justify-between border-b">
              <CardTitle className="text-base">{previewTemplate.name}</CardTitle>
              <button type="button" onClick={() => setPreviewId(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </CardHeader>
            <CardContent className="p-6 overflow-y-auto max-h-[60vh]">
              <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-gray-700">
                {previewTemplate.default_caption || 'Sin caption'}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
