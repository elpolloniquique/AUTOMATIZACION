import { useEffect, useState } from 'react';
import { Sparkles, X, Plus, Tag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ContentTag, ContentTagCategory } from '@/types';
import { TAG_CATEGORY_LABELS } from '@/types';

interface HashtagEditorProps {
  value: string;
  onChange: (value: string) => void;
  branchId?: string;
  onGenerateAI?: () => void;
  aiLoading?: boolean;
}

function parseTags(raw: string): string[] {
  return raw.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean);
}

function toDisplay(tag: string): string {
  return tag.startsWith('#') ? tag : tag;
}

export function HashtagEditor({ value, onChange, branchId, onGenerateAI, aiLoading }: HashtagEditorProps) {
  const [catalog, setCatalog] = useState<ContentTag[]>([]);
  const [newTag, setNewTag] = useState('');
  const [filter, setFilter] = useState<ContentTagCategory | 'all'>('all');
  const selected = parseTags(value);

  useEffect(() => {
    loadCatalog();
  }, [branchId]);

  async function loadCatalog() {
    let query = supabase
      .from('content_tags')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .order('name');

    if (branchId) {
      query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
    }

    const { data } = await query;
    if (data) setCatalog(data as ContentTag[]);
  }

  function setSelected(tags: string[]) {
    const unique = [...new Set(tags.map((t) => t.replace(/^#/, '')))];
    onChange(unique.join(', '));
  }

  function addTag(tag: string) {
    const clean = tag.trim().replace(/^#/, '');
    if (!clean || selected.includes(clean)) return;
    setSelected([...selected, clean]);
  }

  function removeTag(tag: string) {
    setSelected(selected.filter((t) => t !== tag));
  }

  function handleAddCustom() {
    if (!newTag.trim()) return;
    addTag(newTag);
    setNewTag('');
  }

  const filteredCatalog = catalog.filter(
    (t) => filter === 'all' || t.category === filter
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Label className="flex items-center gap-1">
          <Tag className="w-4 h-4" /> Hashtags y etiquetas
        </Label>
        {onGenerateAI && (
          <Button type="button" variant="outline" size="sm" onClick={onGenerateAI} disabled={aiLoading}>
            <Sparkles className="w-4 h-4 mr-1" />
            {aiLoading ? 'Generando...' : 'Generar con IA'}
          </Button>
        )}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg border min-h-[44px]">
          {selected.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-pollon-red/10 text-pollon-red text-sm font-medium border border-pollon-red/20"
            >
              #{tag}
              <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-800">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder="Agregar etiqueta personalizada..."
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustom())}
        />
        <Button type="button" variant="outline" onClick={handleAddCustom}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {catalog.length > 0 && (
        <div className="border rounded-lg p-3 bg-white space-y-2">
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`text-xs px-2 py-1 rounded-full ${filter === 'all' ? 'bg-pollon-red text-white' : 'bg-gray-100'}`}
            >
              Todas
            </button>
            {(Object.keys(TAG_CATEGORY_LABELS) as ContentTagCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilter(cat)}
                className={`text-xs px-2 py-1 rounded-full ${filter === cat ? 'bg-pollon-red text-white' : 'bg-gray-100'}`}
              >
                {TAG_CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {filteredCatalog.map((tag) => {
              const isSelected = selected.includes(tag.name);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => (isSelected ? removeTag(tag.name) : addTag(tag.name))}
                  className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                    isSelected
                      ? 'bg-green-100 border-green-300 text-green-800'
                      : 'bg-gray-50 border-gray-200 hover:border-pollon-red hover:text-pollon-red'
                  }`}
                >
                  {toDisplay(tag.name)}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-gray-400">
            Clic para agregar o quitar. Administra el catálogo en <strong>Etiquetas</strong>.
          </p>
        </div>
      )}
    </div>
  );
}
