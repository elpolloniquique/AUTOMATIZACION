import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, CheckCircle, XCircle, Clock, BarChart3 } from 'lucide-react';
import type { DashboardStats, Branch } from '@/types';
import { PLATFORM_LABELS } from '@/types';

export default function DashboardPage() {
  const { session, profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState<string>('all');

  useEffect(() => {
    if (session?.access_token) {
      apiFetch<DashboardStats>('/api/dashboard/stats', { token: session.access_token })
        .then(setStats)
        .catch(console.error);
    }
    supabase.from('branches').select('*').eq('is_active', true).then(({ data }) => {
      if (data) setBranches(data as Branch[]);
    });
  }, [session, branchFilter]);

  const cards = [
    { label: 'Programadas', value: stats?.scheduled ?? 0, icon: Clock, color: 'text-blue-600 bg-blue-50' },
    { label: 'Publicadas', value: stats?.published ?? 0, icon: CheckCircle, color: 'text-green-600 bg-green-50' },
    { label: 'Fallidas', value: stats?.failed ?? 0, icon: XCircle, color: 'text-red-600 bg-red-50' },
    { label: 'Pendientes aprobación', value: stats?.pending_approval ?? 0, icon: Calendar, color: 'text-yellow-600 bg-yellow-50' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-500">Bienvenido, {profile?.full_name || 'usuario'}</p>
        </div>
        {profile?.role === 'super_admin' && (
          <select
            className="border rounded-lg px-3 py-2 text-sm"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
          >
            <option value="all">Todas las sucursales</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-3xl font-bold mt-1">{card.value}</p>
                </div>
                <div className={`p-3 rounded-full ${card.color}`}>
                  <card.icon className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="w-5 h-5" />
            Publicaciones por red social
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats && Object.entries(stats.by_platform).map(([platform, count]) => (
              <div key={platform} className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-pollon-red">{count}</p>
                <p className="text-sm text-gray-600">{PLATFORM_LABELS[platform as keyof typeof PLATFORM_LABELS]}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
