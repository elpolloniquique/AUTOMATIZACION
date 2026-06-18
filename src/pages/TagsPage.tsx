import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { Branch, ContentTag, ContentTagCategory } from '@/types';
import { TAG_CATEGORY_LABELS } from '@/types';
import { Tag, Plus, Trash2, Pencil } from 'lucide-react';

const CATEGORIES = Object.keys(TAG_CATEGORY_LABELS) as ContentTagCategory[];

export default function TagsPage() {
  const { profile } = useAuth();
  const [tags, setTags] = useState<ContentTag[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filterCategory, setFilterCategory] = useState<ContentTagCategory | 'all'>('all');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<ContentTagCategory>('general');
  const [newBranch, setNewBranch] = useState('');
  const [editing, setEditing] = useState<ContentTag | null>(null);

  useEffect(() => {
    supabase.from('branches').select('*').eq('is_active', true).then(({ data }) => {
      if (data) setBranches(data as Branch[]);
    });
    loadTags();
  }, [profile]);

  async function loadTags() {
    const { data } = await supabase
      .from('content_tags')
      .select('*')
      .order('sort_order')
      .order('name');
    if (data) setTags(data as ContentTag[]);
  }

  async function addTag() {
    const name = newName.trim().replace(/^#/, '');
    if (!name) return alert('Escribe un nombre para la etiqueta');

    const { error } = await supabase.from('content_tags').insert({
      name,
      category: newCategory,
      branch_id: newBranch || null,
    });

    if (error) alert(error.message);
    else {
      setNewName('');
      loadTags();
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const { error } = await supabase
      .from('content_tags')
      .update({
        name: editing.name.replace(/^#/, ''),
        category: editing.category,
        branch_id: editing.branch_id,
      })
      .eq('id', editing.id);

    if (error) alert(error.message);
    else {
      setEditing(null);
      loadTags();
    }
  }

  async function toggleActive(tag: ContentTag) {
    await supabase.from('content_tags').update({ is_active: !tag.is_active }).eq('id', tag.id);
    loadTags();
  }

  async function deleteTag(tag: ContentTag) {
    if (!confirm(`¿Eliminar etiqueta "${tag.name}"?`)) return;
    await supabase.from('content_tags').delete().eq('id', tag.id);
    loadTags();
  }

  const filtered = tags.filter((t) => filterCategory === 'all' || t.category === filterCategory);
  const grouped = CATEGORIES.map((cat) => ({
    cat,
    items: filtered.filter((t) => t.category === cat),
  })).filter((g) => g.items.length > 0);

  const canManage = profile?.role === 'super_admin' || profile?.role === 'admin_sucursal';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Tag className="w-7 h-7 text-pollon-red" />
          Etiquetas para publicaciones
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Catálogo de hashtags y etiquetas para IA, galería y publicaciones profesionales.
        </p>
      </div>

      {canManage && (
        <Card>
          <CardHeader><CardTitle className="text-base">Agregar etiqueta</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-4 gap-3 items-end">
            <div className="md:col-span-2">
              <Label>Nombre</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej: PolloBroaster" />
            </div>
            <div>
              <Label>Categoría</Label>
              <select className="w-full border rounded-md h-10 px-3" value={newCategory} onChange={(e) => setNewCategory(e.target.value as ContentTagCategory)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{TAG_CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <Label>Sucursal</Label>
              <select className="w-full border rounded-md h-10 px-3" value={newBranch} onChange={(e) => setNewBranch(e.target.value)}>
                <option value="">Global</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <Button onClick={addTag} className="md:col-span-4 w-fit">
              <Plus className="w-4 h-4 mr-1" /> Agregar etiqueta
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilterCategory('all')}
          className={`text-sm px-3 py-1.5 rounded-full ${filterCategory === 'all' ? 'bg-pollon-red text-white' : 'bg-gray-100'}`}
        >
          Todas ({tags.length})
        </button>
        {CATEGORIES.map((cat) => {
          const count = tags.filter((t) => t.category === cat).length;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setFilterCategory(cat)}
              className={`text-sm px-3 py-1.5 rounded-full ${filterCategory === cat ? 'bg-pollon-red text-white' : 'bg-gray-100'}`}
            >
              {TAG_CATEGORY_LABELS[cat]} ({count})
            </button>
          );
        })}
      </div>

      {filterCategory === 'all' ? (
        grouped.map(({ cat, items }) => (
          <Card key={cat}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{TAG_CATEGORY_LABELS[cat]}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {items.map((tag) => renderTagChip(tag))}
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-2">
              {filtered.map((tag) => renderTagChip(tag))}
            </div>
          </CardContent>
        </Card>
      )}

      {filtered.length === 0 && (
        <Card><CardContent className="py-12 text-center text-gray-500">No hay etiquetas en esta categoría.</CardContent></Card>
      )}
    </div>
  );

  function renderTagChip(tag: ContentTag) {
    if (editing?.id === tag.id) {
      return (
        <div key={tag.id} className="flex flex-wrap gap-2 items-center p-2 border rounded-lg bg-yellow-50 w-full max-w-md">
          <Input
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            className="flex-1 min-w-[120px]"
          />
          <select
            className="border rounded-md h-10 px-2 text-sm"
            value={editing.category}
            onChange={(e) => setEditing({ ...editing, category: e.target.value as ContentTagCategory })}
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{TAG_CATEGORY_LABELS[c]}</option>)}
          </select>
          <Button size="sm" onClick={saveEdit}>Guardar</Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
        </div>
      );
    }

    return (
      <div
        key={tag.id}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
          tag.is_active ? 'bg-white border-gray-200' : 'bg-gray-100 border-gray-100 opacity-60'
        }`}
      >
        <span className="font-medium">#{tag.name}</span>
        {tag.branch_id && <Badge status="scheduled" label="Sucursal" />}
        {!tag.is_active && <Badge status="failed" label="Inactiva" />}
        {canManage && (
          <div className="flex gap-1 ml-1">
            <button type="button" onClick={() => setEditing(tag)} className="text-gray-400 hover:text-blue-600">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => toggleActive(tag)} className="text-gray-400 hover:text-amber-600 text-xs">
              {tag.is_active ? 'Off' : 'On'}
            </button>
            <button type="button" onClick={() => deleteTag(tag)} className="text-gray-400 hover:text-red-600">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  }
}
