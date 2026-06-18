import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Sparkles, Image, Save } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SocialPreview } from '@/components/SocialPreview';
import type { Branch, Platform, PostType } from '@/types';
import { PLATFORM_LABELS, POST_TYPE_LABELS } from '@/types';
import { POLLON_CONTACT } from '@/constants/pollonBrand';

const postSchema = z.object({
  branch_id: z.string().uuid(),
  platform: z.enum(['facebook', 'instagram', 'tiktok', 'google_business']),
  post_type: z.enum(['oferta', 'combo', 'delivery', 'testimonio', 'horario', 'promocion', 'fecha_especial', 'producto_destacado']),
  title: z.string().min(3, 'Mínimo 3 caracteres'),
  caption: z.string().optional(),
  cta: z.string().optional(),
  hashtags: z.string().optional(),
  scheduled_at: z.string().optional(),
  price: z.string().optional(),
  product_name: z.string().optional(),
  template_slug: z.string().optional(),
});

type PostForm = z.infer<typeof postSchema>;

export default function PostCreatorPage() {
  const { id } = useParams();
  const { session, profile } = useAuth();
  const navigate = useNavigate();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [imgLoading, setImgLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<PostForm>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      platform: 'facebook',
      post_type: 'oferta',
      branch_id: profile?.branch_id || '',
    },
  });

  const watched = watch();

  useEffect(() => {
    supabase.from('branches').select('*').eq('is_active', true).then(({ data }) => {
      if (data) setBranches(data as Branch[]);
    });
    if (id) loadPost(id);
  }, [id]);

  async function loadPost(postId: string) {
    const { data } = await supabase.from('posts').select('*').eq('id', postId).single();
    if (data) {
      reset({
        branch_id: data.branch_id,
        platform: data.platform,
        post_type: data.post_type,
        title: data.title,
        caption: data.caption || '',
        cta: data.cta || '',
        hashtags: data.hashtags?.join(', ') || '',
        scheduled_at: data.scheduled_at?.slice(0, 16) || '',
        price: data.price || '',
        product_name: data.product_name || '',
      });
      setImageUrl(data.generated_image_url || data.media_url || '');
    }
  }

  async function generateAI() {
    const branch = branches.find((b) => b.id === watched.branch_id);
    if (!branch || !session?.access_token) return;
    setAiLoading(true);
    try {
      const typeMap: Record<string, string> = {
        facebook: 'facebook', instagram: 'instagram', tiktok: 'tiktok', google_business: 'google_business',
      };
      const result = await apiFetch<{ result: string }>('/api/ai/generate', {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({
          branch_id: branch.id,
          type: typeMap[watched.platform] || 'facebook',
          post_type: watched.post_type,
          branch_name: branch.name,
          city: branch.city,
          product_name: watched.product_name,
          price: watched.price,
        }),
      });
      setValue('caption', result.result);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error generando texto');
    } finally {
      setAiLoading(false);
    }
  }

  async function generateImage() {
    const branch = branches.find((b) => b.id === watched.branch_id);
    if (!branch || !session?.access_token) return;
    if (!watched.title?.trim()) {
      alert('Escribe un título antes de generar la imagen');
      return;
    }
    setImgLoading(true);
    try {
      const slugMap: Record<string, string> = {
        oferta: 'oferta-familiar', combo: 'combo-dos', delivery: 'delivery',
        producto_destacado: 'producto-destacado', promocion: 'promo-fin-semana',
      };
      const result = await apiFetch<{ url: string }>('/api/images/generate', {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({
          template_slug: slugMap[watched.post_type] || 'oferta-familiar',
          branch_id: branch.id,
          branch_name: branch.name,
          offer_title: watched.title,
          price: watched.price || undefined,
          logo_url: branch.logo_url || undefined,
          cta: watched.cta || POLLON_CONTACT.defaultCta,
          brand_color: branch.brand_color || '#c50000',
        }),
      });
      setImageUrl(result.url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error generando imagen. ¿Playwright instalado?');
    } finally {
      setImgLoading(false);
    }
  }

  async function onSubmit(data: PostForm, submitForApproval = false) {
    setSaving(true);
    const hashtags = data.hashtags?.split(',').map((h) => h.trim()).filter(Boolean) || [];
    const payload = {
      branch_id: data.branch_id,
      created_by: profile?.id,
      platform: data.platform,
      post_type: data.post_type,
      title: data.title,
      caption: data.caption,
      cta: data.cta,
      hashtags,
      scheduled_at: data.scheduled_at ? new Date(data.scheduled_at).toISOString() : null,
      price: data.price,
      product_name: data.product_name,
      generated_image_url: imageUrl || null,
      status: submitForApproval ? 'pending_approval' : 'draft',
      approval_status: 'pending',
    };

    const { error } = id
      ? await supabase.from('posts').update(payload).eq('id', id)
      : await supabase.from('posts').insert(payload);

    setSaving(false);
    if (error) {
      alert(error.message);
    } else {
      navigate(submitForApproval ? '/approvals' : '/calendar');
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{id ? 'Editar publicación' : 'Crear publicación'}</h1>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Contenido</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Sucursal</Label>
              <select className="w-full border rounded-md h-10 px-3" {...register('branch_id')}>
                <option value="">Seleccionar...</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Red social</Label>
                <select className="w-full border rounded-md h-10 px-3" {...register('platform')}>
                  {(Object.keys(PLATFORM_LABELS) as Platform[]).map((p) => (
                    <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Tipo</Label>
                <select className="w-full border rounded-md h-10 px-3" {...register('post_type')}>
                  {(Object.keys(POST_TYPE_LABELS) as PostType[]).map((t) => (
                    <option key={t} value={t}>{POST_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label>Título</Label>
              <Input {...register('title')} placeholder="Ej: Combo familiar 4 personas" />
              {errors.title && <p className="text-red-500 text-xs">{errors.title.message}</p>}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <Label>Texto principal</Label>
                <Button type="button" variant="outline" size="sm" onClick={generateAI} disabled={aiLoading}>
                  <Sparkles className="w-4 h-4 mr-1" />
                  {aiLoading ? 'Generando...' : 'Generar con IA'}
                </Button>
              </div>
              <textarea className="w-full border rounded-md p-3 min-h-[120px] text-sm" {...register('caption')} placeholder="Texto del post o pega contenido de ChatGPT..." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div><Label>CTA</Label><Input {...register('cta')} placeholder={POLLON_CONTACT.defaultCta} /></div>
              <div><Label>Precio</Label><Input {...register('price')} placeholder="$19.990" /></div>
            </div>

            <div>
              <Label>Hashtags (separados por coma)</Label>
              <Input {...register('hashtags')} placeholder="ElPollon, PolloALaBrasa, Iquique" />
            </div>

            <div>
              <Label>Fecha y hora programada</Label>
              <Input type="datetime-local" {...register('scheduled_at')} />
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={generateImage} disabled={imgLoading}>
                <Image className="w-4 h-4 mr-1" />
                {imgLoading ? 'Generando...' : 'Generar imagen'}
              </Button>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleSubmit((d) => onSubmit(d, false))} disabled={saving}>
                <Save className="w-4 h-4 mr-1" /> Guardar borrador
              </Button>
              <Button variant="secondary" onClick={handleSubmit((d) => onSubmit(d, true))} disabled={saving}>
                Enviar a aprobación
              </Button>
            </div>
          </CardContent>
        </Card>

        <div>
          <Card>
            <CardHeader><CardTitle>Vista previa</CardTitle></CardHeader>
            <CardContent>
              <SocialPreview
                platform={watched.platform as Platform}
                title={watched.title || 'Título'}
                caption={watched.caption || ''}
                imageUrl={imageUrl}
                hashtags={watched.hashtags?.split(',').map((h) => h.trim())}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
