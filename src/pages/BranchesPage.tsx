import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Branch } from '@/types';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const emptyBranch = {
  name: '', city: '', address: '', phone: '', whatsapp: '', opening_hours: '', brand_color: '#c50000',
};

export default function BranchesPage() {
  const { profile } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [editing, setEditing] = useState<Partial<Branch> | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { loadBranches(); }, []);

  async function loadBranches() {
    const { data } = await supabase.from('branches').select('*').order('name');
    if (data) setBranches(data as Branch[]);
  }

  async function handleSave() {
    if (!editing?.name || !editing?.city) return alert('Nombre y ciudad son requeridos');

    const { error } = editing.id
      ? await supabase.from('branches').update(editing).eq('id', editing.id)
      : await supabase.from('branches').insert(editing);

    if (error) alert(error.message);
    else {
      setShowForm(false);
      setEditing(null);
      loadBranches();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Desactivar esta sucursal?')) return;
    await supabase.from('branches').update({ is_active: false }).eq('id', id);
    loadBranches();
  }

  if (profile?.role !== 'super_admin' && profile?.role !== 'admin_sucursal') {
    return <p className="text-gray-500">No tienes permisos para gestionar sucursales.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Sucursales</h1>
        {profile?.role === 'super_admin' && (
          <Button onClick={() => { setEditing(emptyBranch); setShowForm(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Nueva sucursal
          </Button>
        )}
      </div>

      {showForm && editing && (
        <Card>
          <CardHeader><CardTitle>{editing.id ? 'Editar' : 'Nueva'} sucursal</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div><Label>Nombre</Label><Input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><Label>Ciudad</Label><Input value={editing.city || ''} onChange={(e) => setEditing({ ...editing, city: e.target.value })} /></div>
            <div><Label>Dirección</Label><Input value={editing.address || ''} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></div>
            <div><Label>Teléfono</Label><Input value={editing.phone || ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
            <div><Label>WhatsApp</Label><Input value={editing.whatsapp || ''} onChange={(e) => setEditing({ ...editing, whatsapp: e.target.value })} /></div>
            <div><Label>Horario</Label><Input value={editing.opening_hours || ''} onChange={(e) => setEditing({ ...editing, opening_hours: e.target.value })} /></div>
            <div><Label>Color de marca</Label><Input type="color" value={editing.brand_color || '#c50000'} onChange={(e) => setEditing({ ...editing, brand_color: e.target.value })} /></div>
            <div className="flex gap-2 items-end">
              <Button onClick={handleSave}>Guardar</Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {branches.filter((b) => b.is_active).map((branch) => (
          <Card key={branch.id}>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{branch.name}</h3>
                  <p className="text-sm text-gray-500">📍 {branch.city}</p>
                  <p className="text-sm mt-2">{branch.address}</p>
                  <p className="text-sm">📞 {branch.phone} · WhatsApp: {branch.whatsapp}</p>
                  <p className="text-sm text-gray-500">🕐 {branch.opening_hours}</p>
                </div>
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: branch.brand_color }} />
              </div>
              {profile?.role === 'super_admin' && (
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(branch); setShowForm(true); }}>
                    <Pencil className="w-3 h-3 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(branch.id)}>
                    <Trash2 className="w-3 h-3 mr-1" /> Desactivar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
