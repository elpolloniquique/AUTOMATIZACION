import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Profile, Branch } from '@/types';
import { ROLE_LABELS } from '@/types';

export default function UsersPage() {
  const [users, setUsers] = useState<(Profile & { branches?: Branch })[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    supabase.from('profiles').select('*, branches(*)').order('created_at').then(({ data }) => {
      if (data) setUsers(data as typeof users);
    });
    supabase.from('branches').select('*').eq('is_active', true).then(({ data }) => {
      if (data) setBranches(data as Branch[]);
    });
  }, []);

  async function updateUserRole(userId: string, role: string, branchId: string | null) {
    const { error } = await supabase
      .from('profiles')
      .update({ role, branch_id: branchId })
      .eq('id', userId);

    if (error) alert(error.message);
    else {
      const { data } = await supabase.from('profiles').select('*, branches(*)').order('created_at');
      if (data) setUsers(data as typeof users);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Usuarios y roles</h1>
      <p className="text-gray-500">Gestiona permisos de cada usuario del sistema.</p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-3 pr-4">Nombre</th>
              <th className="pb-3 pr-4">Email</th>
              <th className="pb-3 pr-4">Rol</th>
              <th className="pb-3 pr-4">Sucursal</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b">
                <td className="py-3 pr-4">{user.full_name || '—'}</td>
                <td className="py-3 pr-4">{user.email}</td>
                <td className="py-3 pr-4">
                  <select
                    className="border rounded px-2 py-1"
                    value={user.role}
                    onChange={(e) => updateUserRole(user.id, e.target.value, user.branch_id)}
                  >
                    {Object.entries(ROLE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </td>
                <td className="py-3 pr-4">
                  <select
                    className="border rounded px-2 py-1"
                    value={user.branch_id || ''}
                    onChange={(e) => updateUserRole(user.id, user.role, e.target.value || null)}
                  >
                    <option value="">Sin sucursal (super admin)</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <Card><CardContent className="p-8 text-center text-gray-500">No hay usuarios registrados.</CardContent></Card>
      )}
    </div>
  );
}
