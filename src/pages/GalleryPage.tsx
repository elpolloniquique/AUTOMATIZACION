import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { Branch, MediaGalleryItem, PostType } from '@/types';
import { POST_TYPE_LABELS } from '@/types';
import { Upload, Link2, Trash2, Pencil, ImageIcon, X, Check, ArrowLeft } from 'lucide-react';

const GALLERY_BUCKET = 'media-gallery';

const emptyForm = {
  title: '',
  description: '',
  tags: '',
  dish_type: '' as PostType | '',
  branch_id: '',
};

export default function GalleryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectMode = searchParams.get('select') === '1';
  const maxSelect = Math.min(4, Math.max(1, parseInt(searchParams.get('max') || '4', 10)));
  const returnPath = searchParams.get('return') || '/posts/new';

  const { profile, session } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [items, setItems] = useState<MediaGalleryItem[]>([]);
  const [filterBranch, setFilterBranch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<MediaGalleryItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('branches').select('*').eq('is_active', true).then(({ data }) => {
      if (data) {
        setBranches(data as Branch[]);
        const defaultBranch = profile?.branch_id || data[0]?.id || '';
        setFilterBranch(defaultBranch);
        setForm((f) => ({ ...f, branch_id: defaultBranch }));
      }
    });
  }, [profile]);

  useEffect(() => {
    loadGallery();
  }, [filterBranch]);

  async function loadGallery() {
    let query = supabase
      .from('media_gallery')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (filterBranch) {
      query = query.or(`branch_id.eq.${filterBranch},branch_id.is.null`);
    }

    const { data } = await query;
    if (data) setItems(data as MediaGalleryItem[]);
  }

  async function uploadFile(file: File) {
    if (!form.title.trim()) return alert('Escribe un título para la foto');
    setUploading(true);
    try {
      const branchPart = form.branch_id || 'global';
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${branchPart}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(GALLERY_BUCKET)
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage.from(GALLERY_BUCKET).getPublicUrl(filePath);
      const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);

      const { error } = await supabase.from('media_gallery').insert({
        branch_id: form.branch_id || null,
        title: form.title,
        description: form.description || null,
        tags,
        dish_type: form.dish_type || null,
        file_path: filePath,
        public_url: urlData.publicUrl,
        source: 'upload',
        created_by: profile?.id,
      });

      if (error) throw new Error(error.message);

      setForm(emptyForm);
      setShowForm(false);
      if (fileRef.current) fileRef.current.value = '';
      loadGallery();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al subir');
    } finally {
      setUploading(false);
    }
  }

  async function importFromUrl() {
    if (!importUrl.trim() || !form.title.trim()) return alert('URL y título son requeridos');
    if (!session?.access_token) return;
    setUploading(true);
    try {
      await apiFetch('/api/gallery/import-url', {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({
          url: importUrl,
          title: form.title,
          description: form.description || undefined,
          tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
          dish_type: form.dish_type || undefined,
          branch_id: form.branch_id || undefined,
        }),
      });
      setImportUrl('');
      setForm(emptyForm);
      setShowForm(false);
      loadGallery();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error importando URL');
    } finally {
      setUploading(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
    const { error } = await supabase
      .from('media_gallery')
      .update({
        title: form.title,
        description: form.description || null,
        tags,
        dish_type: form.dish_type || null,
        branch_id: form.branch_id || null,
      })
      .eq('id', editing.id);

    if (error) alert(error.message);
    else {
      setEditing(null);
      setShowForm(false);
      setForm(emptyForm);
      loadGallery();
    }
  }

  async function deleteItem(item: MediaGalleryItem) {
    if (!confirm(`¿Eliminar "${item.title}"?`)) return;
    await supabase.storage.from(GALLERY_BUCKET).remove([item.file_path]);
    await supabase.from('media_gallery').delete().eq('id', item.id);
    loadGallery();
  }

  function openEdit(item: MediaGalleryItem) {
    setEditing(item);
    setForm({
      title: item.title,
      description: item.description || '',
      tags: (item.tags || []).join(', '),
      dish_type: (item.dish_type as PostType) || '',
      branch_id: item.branch_id || '',
    });
    setShowForm(true);
  }

  function openNew() {
    setEditing(null);
    setForm({ ...emptyForm, branch_id: filterBranch || profile?.branch_id || '' });
    setShowForm(true);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= maxSelect) {
        alert(`Máximo ${maxSelect} fotos por publicación`);
        return prev;
      }
      return [...prev, id];
    });
  }

  function confirmSelection() {
    if (selectedIds.length === 0) return alert('Selecciona al menos 1 foto');
    const selectedItems = selectedIds
      .map((sid) => items.find((i) => i.id === sid))
      .filter(Boolean) as MediaGalleryItem[];
    navigate(returnPath, {
      state: { selectedGalleryIds: selectedIds, selectedGalleryItems: selectedItems },
    });
  }

  return (
    <div className="space-y-6">
      {selectMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-blue-900">Modo selección para publicación</p>
            <p className="text-sm text-blue-700">Elige hasta {maxSelect} fotos. {selectedIds.length} seleccionada(s).</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(returnPath)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Volver
            </Button>
            <Button size="sm" onClick={confirmSelection} disabled={selectedIds.length === 0}>
              <Check className="w-4 h-4 mr-1" /> Confirmar ({selectedIds.length})
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ImageIcon className="w-7 h-7 text-pollon-red" />
            Galería de fotos reales
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Sube fotos de tus platos. La IA las usará automáticamente al generar publicaciones.
          </p>
        </div>
        {!selectMode && (
          <Button onClick={openNew}>
            <Upload className="w-4 h-4 mr-1" /> Agregar foto
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <Label>Filtrar por sucursal</Label>
          <select
            className="border rounded-md h-10 px-3 mt-1 min-w-[200px]"
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
          >
            <option value="">Todas</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <Badge status="published" label={`${items.length} fotos`} />
      </div>

      {showForm && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{editing ? 'Editar foto' : 'Nueva foto en galería'}</CardTitle>
            <button onClick={() => { setShowForm(false); setEditing(null); }}>
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div><Label>Título del plato *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej: Ofertón familiar 4 personas" /></div>
            <div><Label>Tipo de plato</Label>
              <select className="w-full border rounded-md h-10 px-3" value={form.dish_type} onChange={(e) => setForm({ ...form, dish_type: e.target.value as PostType })}>
                <option value="">Auto (sin tipo)</option>
                {Object.entries(POST_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div className="md:col-span-2"><Label>Descripción</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ej: Pollo a la brasa con papas y ensalada" /></div>
            <div className="md:col-span-2"><Label>Etiquetas (separadas por coma)</Label>
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="oferta, familiar, pollo, brasa, combo" /></div>
            <div><Label>Sucursal</Label>
              <select className="w-full border rounded-md h-10 px-3" value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
                <option value="">Global (todas las sucursales)</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select></div>

            {!editing && (
              <>
                <div className="md:col-span-2 border-t pt-4">
                  <Label className="flex items-center gap-1"><Upload className="w-4 h-4" /> Subir desde tu PC</Label>
                  <input ref={fileRef} type="file" accept="image/*" className="mt-2 block w-full text-sm"
                    onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
                </div>
                <div className="md:col-span-2 border-t pt-4">
                  <Label className="flex items-center gap-1"><Link2 className="w-4 h-4" /> Importar desde URL</Label>
                  <div className="flex gap-2 mt-2">
                    <Input value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder="https://..." />
                    <Button variant="outline" onClick={importFromUrl} disabled={uploading}>Importar</Button>
                  </div>
                </div>
              </>
            )}

            {editing && (
              <div className="md:col-span-2 flex gap-2">
                <Button onClick={saveEdit}>Guardar cambios</Button>
                <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>Cancelar</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-500">
            <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No hay fotos en la galería.</p>
            <p className="text-sm mt-2">Sube fotos reales de tus platos con título y etiquetas para que la IA las encuentre.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            return (
            <Card
              key={item.id}
              className={`overflow-hidden group cursor-pointer transition-all ${selectMode && isSelected ? 'ring-4 ring-pollon-red scale-[1.02]' : ''}`}
              onClick={selectMode ? () => toggleSelect(item.id) : undefined}
            >
              <div className="aspect-square relative bg-gray-100">
                <img src={item.public_url} alt={item.title} className="w-full h-full object-cover" />
                {selectMode && (
                  <div className={`absolute top-2 right-2 w-7 h-7 rounded-full border-2 flex items-center justify-center ${
                    isSelected ? 'bg-pollon-red border-pollon-red text-white' : 'bg-white/90 border-gray-300'
                  }`}>
                    {isSelected && <Check className="w-4 h-4" />}
                  </div>
                )}
                {!selectMode && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); openEdit(item); }}><Pencil className="w-3 h-3" /></Button>
                  <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); deleteItem(item); }}><Trash2 className="w-3 h-3" /></Button>
                </div>
                )}
              </div>
              <CardContent className="p-3">
                <p className="font-semibold text-sm truncate">{item.title}</p>
                {item.dish_type && <p className="text-xs text-pollon-red">{POST_TYPE_LABELS[item.dish_type as PostType]}</p>}
                <div className="flex flex-wrap gap-1 mt-1">
                  {(item.tags || []).slice(0, 3).map((t) => (
                    <span key={t} className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">{t}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
