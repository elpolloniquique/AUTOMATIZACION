import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isSupabaseConfigured, getSupabaseStatus } from '@/lib/supabase';

const loginSchema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;

function translateAuthError(message: string): string {
  const map: Record<string, string> = {
    'Invalid login credentials': 'Correo o contraseña incorrectos',
    'Email not confirmed': 'Confirma tu correo en Supabase (Authentication → Users)',
    'User not found': 'Usuario no encontrado',
  };
  return map[message] || message;
}

export default function LoginPage() {
  const { signIn, resetPassword, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors }, getValues } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'tutacanehuillca@gmail.com',
    },
  });

  const supabaseStatus = getSupabaseStatus();

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  async function onSubmit(data: LoginForm) {
    if (!isSupabaseConfigured) {
      setError('Supabase no configurado. Revisa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env y reinicia npm run dev');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await signIn(data.email.trim(), data.password);
      navigate('/', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar sesión';
      setError(translateAuthError(msg));
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    const email = getValues('email');
    if (!email) {
      setError('Ingresa tu correo para recuperar contraseña');
      return;
    }
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar correo');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-pollon-red text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4">EP</div>
          <CardTitle>El Pollón Social Automation</CardTitle>
          <p className="text-sm text-gray-500">Inicia sesión en tu panel</p>
          <p className={`text-xs mt-2 ${supabaseStatus.ok ? 'text-green-600' : 'text-red-600'}`}>
            {supabaseStatus.ok ? '✓' : '✗'} {supabaseStatus.hint}
          </p>
          {!isSupabaseConfigured && (
            <p className="text-xs text-red-600 mt-1">
              En Vercel: Settings → Environment Variables → agrega VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY → Redeploy
            </p>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="email">Correo electrónico</Label>
              <Input id="email" type="email" placeholder="admin@elpollon.cl" {...register('email')} />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}
            {resetSent && <p className="text-green-600 text-sm">Correo de recuperación enviado.</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Ingresando...' : 'Iniciar sesión'}
            </Button>

            <button type="button" onClick={handleReset} className="text-sm text-pollon-red hover:underline w-full text-center">
              ¿Olvidaste tu contraseña?
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
