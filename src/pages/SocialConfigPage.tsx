import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { Branch, SocialAccount, Platform } from '@/types';
import { PLATFORM_LABELS } from '@/types';
import { Wifi, WifiOff, TestTube } from 'lucide-react';

export default function SocialConfigPage() {
  const { session, profile } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [forms, setForms] = useState<Record<string, { account_id: string; access_token: string; account_name: string }>>({});
  const [testing, setTesting] = useState<string | null>(null);

  const platforms: Platform[] = ['facebook', 'instagram', 'tiktok', 'google_business'];

  useEffect(() => {
    supabase.from('branches').select('*').eq('is_active', true).then(({ data }) => {
      if (data) {
        setBranches(data as Branch[]);
        const defaultBranch = profile?.branch_id || data[0]?.id;
        if (defaultBranch) setSelectedBranch(defaultBranch);
      }
    });
  }, [profile]);

  useEffect(() => {
    if (selectedBranch) loadAccounts();
  }, [selectedBranch]);

  async function loadAccounts() {
    const { data } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('branch_id', selectedBranch);

    if (data) {
      setAccounts(data as SocialAccount[]);
      const formState: typeof forms = {};
      platforms.forEach((p) => {
        const acc = (data as SocialAccount[]).find((a) => a.platform === p);
        formState[p] = {
          account_id: acc?.account_id || '',
          access_token: acc?.access_token || '',
          account_name: acc?.account_name || '',
        };
      });
      setForms(formState);
    }
  }

  async function saveAccount(platform: Platform) {
    const form = forms[platform];
    const { error } = await supabase.from('social_accounts').upsert({
      branch_id: selectedBranch,
      platform,
      account_id: form.account_id,
      access_token: form.access_token,
      account_name: form.account_name,
      is_connected: Boolean(form.account_id && form.access_token),
    }, { onConflict: 'branch_id,platform' });

    if (error) alert(error.message);
    else loadAccounts();
  }

  async function testConnection(platform: Platform) {
    if (!session?.access_token) return;
    setTesting(platform);
    try {
      const form = forms[platform];
      const result = await apiFetch<{ ok: boolean; name?: string; username?: string; error?: string }>(
        '/api/social/test',
        {
          method: 'POST',
          token: session.access_token,
          body: JSON.stringify({
            platform,
            account_id: form.account_id,
            access_token: form.access_token,
            branch_id: selectedBranch,
          }),
        }
      );
      if (result.ok) {
        alert(`Conexión exitosa: ${result.name || result.username || 'OK'}`);
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error de conexión');
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configuración de redes sociales</h1>

      <div>
        <Label>Sucursal</Label>
        <select
          className="border rounded-md h-10 px-3 mt-1"
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
        >
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div className="grid gap-4">
        {platforms.map((platform) => {
          const acc = accounts.find((a) => a.platform === platform);
          const isPending = platform === 'tiktok' || platform === 'google_business';

          return (
            <Card key={platform}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {PLATFORM_LABELS[platform]}
                  {acc?.is_connected ? (
                    <Badge status="published" label="Conectado" />
                  ) : isPending ? (
                    <Badge status="manual_required" label="Pendiente configuración" />
                  ) : (
                    <Badge status="draft" label="Desconectado" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isPending && (
                  <p className="text-sm text-orange-600 bg-orange-50 p-3 rounded-lg">
                    {platform === 'tiktok'
                      ? 'TikTok Content Posting API requiere aprobación. Configura OAuth cuando esté disponible.'
                      : 'Google Business Profile API requiere permisos en Google Cloud Console.'}
                  </p>
                )}
                <div>
                  <Label>Nombre de cuenta</Label>
                  <Input
                    value={forms[platform]?.account_name || ''}
                    onChange={(e) => setForms({ ...forms, [platform]: { ...forms[platform], account_name: e.target.value } })}
                  />
                </div>
                <div>
                  <Label>{platform === 'facebook' ? 'Page ID' : platform === 'instagram' ? 'IG Business Account ID' : platform === 'tiktok' ? 'TikTok Account ID' : 'Location ID'}</Label>
                  <Input
                    value={forms[platform]?.account_id || ''}
                    onChange={(e) => setForms({ ...forms, [platform]: { ...forms[platform], account_id: e.target.value } })}
                  />
                </div>
                <div>
                  <Label>Access Token</Label>
                  <Input
                    type="password"
                    value={forms[platform]?.access_token || ''}
                    onChange={(e) => setForms({ ...forms, [platform]: { ...forms[platform], access_token: e.target.value } })}
                    placeholder="Token seguro (nunca visible en frontend en producción)"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => saveAccount(platform)}>Guardar</Button>
                  <Button variant="outline" onClick={() => testConnection(platform)} disabled={testing === platform}>
                    <TestTube className="w-4 h-4 mr-1" />
                    {testing === platform ? 'Probando...' : 'Probar conexión'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
