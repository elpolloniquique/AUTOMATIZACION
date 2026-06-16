import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PostTemplate } from '@/types';
import { POST_TYPE_LABELS } from '@/types';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<PostTemplate[]>([]);

  useEffect(() => {
    supabase.from('post_templates').select('*').eq('is_active', true).then(({ data }) => {
      if (data) setTemplates(data as PostTemplate[]);
    });
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Plantillas de contenido</h1>
      <p className="text-gray-500">Plantillas HTML para generar imágenes y captions predeterminados.</p>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((t) => (
          <Card key={t.id}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                {t.name}
                <Badge status={t.type} label={POST_TYPE_LABELS[t.type as keyof typeof POST_TYPE_LABELS]} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 line-clamp-3">{t.default_caption}</p>
              <p className="text-xs text-gray-400 mt-2">HTML: {t.html_template}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {templates.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            No hay plantillas. Ejecuta el seed SQL en Supabase.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
