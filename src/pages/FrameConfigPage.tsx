import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Branch, BrandFrameTemplate } from '@/types';
import { Layers, Plus, Save, Trash2, Eye, Star, Copy } from 'lucide-react';

const emptyTemplate = (): Partial<BrandFrameTemplate> => ({
  name: 'Header y Footer 01',
  description: 'Diseño clásico con footer inteligente, tipografía grande y legible',
  layout_version: 'hf01',
  is_default: false,
  header_style: 'corner',
  header_show_logo: true,
  header_corner_size: 300,
  footer_whatsapp_display: '+56 9 8692 5310',
  footer_website_display: 'www.el-pollon.cl',
  footer_cta_text: 'PIDE AHORA!',
  footer_show_whatsapp: true,
  footer_show_website: true,
  footer_show_cta: true,
  footer_show_footer_logo: true,
  footer_height: 132,
  footer_adaptive_color: true,
  footer_font_family: 'Roboto-Black',
  footer_whatsapp_font_size: 28,
  footer_website_font_size: 26,
  footer_cta_font_size: 26,
  footer_icon_size: 46,
  accent_color: '#c50000',
  footer_bg_color: '#c50000',
  cta_bg_color: '#ffffff',
  cta_text_color: '#c50000',
  whatsapp_icon_color: '#25D366',
  website_icon_color: '#4A7FD6',
  text_color: '#ffffff',
});

export default function FrameConfigPage() {
  const { session, profile } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [templates, setTemplates] = useState<BrandFrameTemplate[]>([]);
  const [editing, setEditing] = useState<Partial<BrandFrameTemplate> | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    supabase.from('branches').select('*').eq('is_active', true).order('name').then(({ data }) => {
      if (data) {
        setBranches(data as Branch[]);
        const defaultBranch = profile?.branch_id || data[0]?.id || '';
        setBranchId(defaultBranch);
      }
    });
  }, [profile]);

  const loadTemplates = useCallback(async () => {
    if (!session?.access_token) return;
    const q = branchId ? `?branch_id=${branchId}` : '';
    const result = await apiFetch<{ templates: BrandFrameTemplate[] }>(
      `/api/frame-templates${q}`,
      { token: session.access_token },
    );
    setTemplates(result.templates);
  }, [session, branchId]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  async function refreshPreview(tpl: Partial<BrandFrameTemplate>) {
    if (!session?.access_token) return;
    setLoadingPreview(true);
    try {
      const result = await apiFetch<{ preview: string }>('/api/frame-templates/preview', {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({ ...tpl, branch_id: branchId || null, name: tpl.name || 'Preview' }),
      });
      setPreview(result.preview);
    } catch {
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  }

  useEffect(() => {
    if (editing) {
      const timer = setTimeout(() => refreshPreview(editing), 400);
      return () => clearTimeout(timer);
    }
  }, [editing, branchId]);

  async function handleSave() {
    if (!editing || !session?.access_token) return;
    if (!editing.name?.trim()) return alert('Nombre requerido');

    setSaving(true);
    try {
      const payload = { ...editing, branch_id: branchId || null };
      if (editing.id) {
        await apiFetch(`/api/frame-templates/${editing.id}`, {
          method: 'PUT',
          token: session.access_token,
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/frame-templates', {
          method: 'POST',
          token: session.access_token,
          body: JSON.stringify(payload),
        });
      }
      setEditing(null);
      loadTemplates();
      alert('Plantilla guardada');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!session?.access_token || !confirm('¿Desactivar esta plantilla?')) return;
    await apiFetch(`/api/frame-templates/${id}`, { method: 'DELETE', token: session.access_token });
    loadTemplates();
    if (editing?.id === id) setEditing(null);
  }

  async function assignToBranch(templateId: string) {
    if (!branchId) return alert('Selecciona una sucursal');
    const { error } = await supabase.from('branches').update({ frame_template_id: templateId }).eq('id', branchId);
    if (error) alert(error.message);
    else alert('Plantilla asignada a la sucursal');
  }

  function duplicateTemplate(tpl: BrandFrameTemplate) {
    const { id, created_at, updated_at, ...rest } = tpl;
    setEditing({ ...rest, name: `${tpl.name} (copia)`, is_default: false });
  }

  const selectedBranch = branches.find((b) => b.id === branchId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="w-7 h-7 text-pollon-red" />
            Configuración Header y Footer
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Personaliza WhatsApp, web, botón PIDE AHORA y diseño de tus publicaciones en redes sociales.
          </p>
        </div>
        <div className="flex gap-2 items-end">
          <div>
            <Label className="text-xs">Sucursal</Label>
            <select
              className="border rounded-md h-10 px-3 min-w-[200px]"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <Button onClick={() => setEditing({ ...emptyTemplate(), branch_id: branchId || null })}>
            <Plus className="w-4 h-4 mr-1" /> Nueva plantilla
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {templates.map((tpl) => (
            <Card key={tpl.id} className={editing?.id === tpl.id ? 'ring-2 ring-pollon-red' : ''}>
              <CardContent className="p-4 flex justify-between items-start gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{tpl.name}</h3>
                    {tpl.is_default && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                    <span className="text-[10px] uppercase tracking-wide bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {(tpl.layout_version || 'hf01').toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{tpl.description || 'Sin descripción'}</p>
                  <div className="text-xs text-gray-600 mt-2 space-y-0.5">
                    <p>WhatsApp: {tpl.footer_whatsapp_display || '—'}</p>
                    <p>Web: {tpl.footer_website_display || '—'}</p>
                    <p>Botón: {tpl.footer_cta_text}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="sm" variant="outline" onClick={() => setEditing({ ...tpl })}>
                    Editar
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => assignToBranch(tpl.id)}>
                    Usar en sucursal
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => duplicateTemplate(tpl)}>
                    <Copy className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(tpl.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {templates.length === 0 && (
            <Card><CardContent className="p-8 text-center text-gray-500">No hay plantillas. Crea una nueva.</CardContent></Card>
          )}
        </div>

        <div className="space-y-4 lg:sticky lg:top-4 self-start">
          {editing ? (
            <>
              <Card>
                <CardHeader><CardTitle className="text-base">Vista previa en vivo</CardTitle></CardHeader>
                <CardContent>
                  {loadingPreview && <p className="text-sm text-gray-400 mb-2">Generando preview...</p>}
                  {preview ? (
                    <img src={preview} alt="Preview footer" className="w-full rounded-lg border shadow-sm" />
                  ) : (
                    <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                      <Eye className="w-8 h-8 opacity-30" />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Datos del footer</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Nombre de plantilla</Label>
                    <Input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                  </div>
                  <div>
                    <Label>WhatsApp (visible en imagen)</Label>
                    <Input
                      value={editing.footer_whatsapp_display || ''}
                      onChange={(e) => setEditing({ ...editing, footer_whatsapp_display: e.target.value })}
                      placeholder="+56 9 8692 5310"
                    />
                  </div>
                  <div>
                    <Label>Página web (visible)</Label>
                    <Input
                      value={editing.footer_website_display || ''}
                      onChange={(e) => setEditing({ ...editing, footer_website_display: e.target.value })}
                      placeholder="www.el-pollon.cl"
                    />
                  </div>
                  <div>
                    <Label>Texto del botón central</Label>
                    <Input
                      value={editing.footer_cta_text || ''}
                      onChange={(e) => setEditing({ ...editing, footer_cta_text: e.target.value })}
                      placeholder="PIDE AHORA!"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={editing.footer_show_whatsapp !== false}
                        onChange={(e) => setEditing({ ...editing, footer_show_whatsapp: e.target.checked })} />
                      WhatsApp
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={editing.footer_show_cta !== false}
                        onChange={(e) => setEditing({ ...editing, footer_show_cta: e.target.checked })} />
                      Botón
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={editing.footer_show_website !== false}
                        onChange={(e) => setEditing({ ...editing, footer_show_website: e.target.checked })} />
                      Web
                    </label>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Tipografía del footer</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Tipo de letra</Label>
                    <select
                      className="w-full border rounded-md h-10 px-3"
                      value={editing.footer_font_family || 'Roboto-Black'}
                      onChange={(e) => setEditing({
                        ...editing,
                        footer_font_family: e.target.value as BrandFrameTemplate['footer_font_family'],
                      })}
                    >
                      <option value="Roboto-Black">Roboto Black (más gruesa)</option>
                      <option value="Roboto-Bold">Roboto Bold</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>Tamaño WhatsApp</Label>
                      <Input type="number" min={14} max={48} value={editing.footer_whatsapp_font_size ?? 28}
                        onChange={(e) => setEditing({ ...editing, footer_whatsapp_font_size: Number(e.target.value) })} />
                    </div>
                    <div>
                      <Label>Tamaño botón</Label>
                      <Input type="number" min={14} max={48} value={editing.footer_cta_font_size ?? 26}
                        onChange={(e) => setEditing({ ...editing, footer_cta_font_size: Number(e.target.value) })} />
                    </div>
                    <div>
                      <Label>Tamaño web</Label>
                      <Input type="number" min={14} max={48} value={editing.footer_website_font_size ?? 26}
                        onChange={(e) => setEditing({ ...editing, footer_website_font_size: Number(e.target.value) })} />
                    </div>
                  </div>
                  <div>
                    <Label>Tamaño iconos (px)</Label>
                    <Input type="number" min={32} max={72} value={editing.footer_icon_size ?? 46}
                      onChange={(e) => setEditing({ ...editing, footer_icon_size: Number(e.target.value) })} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>Color texto WhatsApp</Label>
                      <Input type="color" value={editing.footer_whatsapp_text_color || editing.text_color || '#ffffff'}
                        onChange={(e) => setEditing({ ...editing, footer_whatsapp_text_color: e.target.value })} />
                    </div>
                    <div>
                      <Label>Color texto botón</Label>
                      <Input type="color" value={editing.cta_text_color || '#c50000'}
                        onChange={(e) => setEditing({ ...editing, cta_text_color: e.target.value })} />
                    </div>
                    <div>
                      <Label>Color texto web</Label>
                      <Input type="color" value={editing.footer_website_text_color || editing.text_color || '#ffffff'}
                        onChange={(e) => setEditing({ ...editing, footer_website_text_color: e.target.value })} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editing.footer_adaptive_color !== false}
                      onChange={(e) => setEditing({ ...editing, footer_adaptive_color: e.target.checked })} />
                    Footer inteligente: adaptar color al tono de la foto
                  </label>
                  {editing.footer_adaptive_color === false && (
                    <div>
                      <Label>Color footer fijo</Label>
                      <Input type="color" value={editing.footer_bg_color || editing.accent_color || '#c50000'}
                        onChange={(e) => setEditing({ ...editing, footer_bg_color: e.target.value })} />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Header y colores</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Estilo header</Label>
                    <select
                      className="w-full border rounded-md h-10 px-3"
                      value={editing.header_style || 'corner'}
                      onChange={(e) => setEditing({ ...editing, header_style: e.target.value as BrandFrameTemplate['header_style'] })}
                    >
                      <option value="corner">Esquina diagonal (clásico)</option>
                      <option value="minimal">Sin esquina</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Color acento header</Label>
                      <Input type="color" value={editing.accent_color || '#c50000'}
                        onChange={(e) => setEditing({ ...editing, accent_color: e.target.value })} />
                    </div>
                    <div>
                      <Label>Texto general footer</Label>
                      <Input type="color" value={editing.text_color || '#ffffff'}
                        onChange={(e) => setEditing({ ...editing, text_color: e.target.value })} />
                    </div>
                    <div>
                      <Label>Botón fondo</Label>
                      <Input type="color" value={editing.cta_bg_color || '#ffffff'}
                        onChange={(e) => setEditing({ ...editing, cta_bg_color: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>Altura footer (px)</Label>
                    <Input type="number" min={100} max={200} value={editing.footer_height || 132}
                      onChange={(e) => setEditing({ ...editing, footer_height: Number(e.target.value) })} />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editing.is_default === true}
                      onChange={(e) => setEditing({ ...editing, is_default: e.target.checked })} />
                    Plantilla por defecto {selectedBranch ? `para ${selectedBranch.name}` : 'global'}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editing.header_show_logo !== false}
                      onChange={(e) => setEditing({ ...editing, header_show_logo: e.target.checked })} />
                    Mostrar logo en header
                  </label>
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving} className="flex-1">
                  <Save className="w-4 h-4 mr-1" /> {saving ? 'Guardando...' : 'Guardar plantilla'}
                </Button>
                <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                Selecciona una plantilla para editar o crea una nueva.
                {selectedBranch && (
                  <p className="text-xs mt-2">
                    Sucursal actual: <strong>{selectedBranch.name}</strong>
                    {selectedBranch.whatsapp && ` · WA: ${selectedBranch.whatsapp}`}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
