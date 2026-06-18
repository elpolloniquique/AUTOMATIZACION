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
import type { Branch, Platform, PostType, ImageGenerateMode, ImageGenerateResult } from '@/types';
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
  const [imageMode, setImageMode] = useState<ImageGenerateMode>('gallery_auto');
  const [imagePrompt, setImagePrompt] = useState('');
  const [lastMatch, setLastMatch] = useState<ImageGenerateResult | null>(null);
  const [openAiReady, setOpenAiReady] = useState<boolean | null>(null);
  const [aiProvider, setAiProvider] = useState<string | null>(null);
  const [aiHint, setAiHint] = useState<string | null>(null);

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
    if (session?.access_token) {
      apiFetch<{
        ai_configured?: boolean;
        ai_provider?: string;
        hint?: string;
        gemini_key_set?: boolean;
        gemini_key_valid?: boolean;
      }>('/api/images/templates', { token: session.access_token })
        .then((r) => {
          setOpenAiReady(Boolean(r.ai_configured));
          setAiProvider(r.ai_provider || null);
          setAiHint(r.hint || (r.gemini_key_set && !r.gemini_key_valid
            ? 'GEMINI_API_KEY inválida: usa Copiar clave en aistudio.google.com (formato AIzaSy... o AQ....)'
            : null));
        })
        .catch(() => setOpenAiReady(false));
    }
  }, [session]);

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
      const result = await apiFetch<ImageGenerateResult>('/api/images/generate', {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({
          mode: imageMode,
          template_slug: slugMap[watched.post_type] || 'oferta-familiar',
          branch_id: branch.id,
          branch_name: branch.name,
          offer_title: watched.title,
          caption: watched.caption || undefined,
          post_type: watched.post_type,
          image_prompt: imageMode === 'gallery_prompt' ? imagePrompt : undefined,
          price: watched.price || undefined,
          logo_url: branch.logo_url || undefined,
          cta: watched.cta || POLLON_CONTACT.defaultCta,
          brand_color: branch.brand_color || '#c50000',
        }),
      });
      setImageUrl(result.url);
      setLastMatch(result);
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

            <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
              <Label className="font-semibold">Generación de imagen</Label>
              <div className="space-y-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="radio" name="imageMode" checked={imageMode === 'gallery_auto'} onChange={() => setImageMode('gallery_auto')} className="mt-1" />
                  <div>
                    <span className="text-sm font-medium">Galería automática (recomendado)</span>
                    <p className="text-xs text-gray-500">Busca en tu galería la foto que más coincide con el título y texto</p>
                  </div>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="radio" name="imageMode" checked={imageMode === 'gallery_prompt'} onChange={() => setImageMode('gallery_prompt')} className="mt-1" />
                  <div>
                    <span className="text-sm font-medium">Galería + prompt creativo</span>
                    <p className="text-xs text-gray-500">Usa foto de galería y la edita según tu instrucción (ej: sobre una mesa)</p>
                  </div>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="radio" name="imageMode" checked={imageMode === 'template'} onChange={() => setImageMode('template')} className="mt-1" />
                  <div>
                    <span className="text-sm font-medium">Solo plantilla HTML</span>
                    <p className="text-xs text-gray-500">Diseño gráfico sin foto real de galería</p>
                  </div>
                </label>
              </div>
              {imageMode === 'gallery_prompt' && aiHint && (
                <div className="text-xs bg-red-50 border border-red-300 rounded-lg p-3 text-red-800">
                  <strong>Problema con la API:</strong> {aiHint}
                </div>
              )}
              {imageMode === 'gallery_prompt' && !aiHint && openAiReady === false && (
                <div className="text-xs bg-amber-50 border border-amber-300 rounded-lg p-3 text-amber-900">
                  <strong>IA avanzada no configurada.</strong> Agrega <code className="bg-amber-100 px-1 rounded">GEMINI_API_KEY</code> gratis en Vercel (recomendado) o <code className="bg-amber-100 px-1 rounded">OPENAI_API_KEY</code> de pago.
                </div>
              )}
              {imageMode === 'gallery_prompt' && openAiReady === true && (
                <div className="text-xs bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-800">
                  <strong>IA avanzada activa</strong>
                  {aiProvider === 'gemini' && ' (Google Gemini — gratis)'}
                  {aiProvider === 'openai' && ' (OpenAI — de pago)'}
                  . Edita la foto según tu prompt (como Gemini en chat).
                </div>
              )}
              {imageMode === 'gallery_prompt' && (
                <div>
                  <Label>Prompt de edición</Label>
                  <textarea
                    className="w-full border rounded-md p-2 text-sm min-h-[80px] mt-1"
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    placeholder="Ej: Ofertón familiar encima de una mesa de madera en restaurante, iluminación cálida..."
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={generateImage} disabled={imgLoading}>
                <Image className="w-4 h-4 mr-1" />
                {imgLoading ? 'Generando...' : 'Generar imagen'}
              </Button>
            </div>

            {lastMatch?.galleryItem && (
              <div className="text-xs bg-green-50 border border-green-200 rounded-lg p-3 text-green-800">
                <strong>Foto usada:</strong> {lastMatch.galleryItem.title}
                {lastMatch.matchReason && <span className="block text-green-600 mt-1">Coincidencia: {lastMatch.matchReason}</span>}
                {lastMatch.aiSource === 'gemini' && (
                  <span className="block text-green-700 mt-1 font-medium">✓ Generado con Google Gemini (gratis)</span>
                )}
                {lastMatch.aiSource === 'openai' && (
                  <span className="block text-green-700 mt-1 font-medium">✓ Generado con OpenAI (de pago)</span>
                )}
                {lastMatch.aiSource === 'composer' && (
                  <span className="block text-amber-700 mt-1">
                    {lastMatch.aiWarning || 'Compositor básico. Configura GEMINI_API_KEY válida (AIzaSy...) en Vercel.'}
                  </span>
                )}
              </div>
            )}

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
