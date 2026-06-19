import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Branch } from '@/types';
import { Plus, Pencil, Trash2, Upload, ImageIcon, X, Building2 } from 'lucide-react';

const GALLERY_BUCKET = 'media-gallery';

const emptyBranch = {
  name: '',
  city: '',
  address: '',
  phone: '',
  whatsapp: '',
  website: '',
  opening_hours: '',
  brand_color: '#c50000',
  logo_url: null as string | null,
};

function buildPayload(editing: Partial<Branch>) {
  return {
    name: editing.name?.trim(),
    city: editing.city?.trim(),
    address: editing.address?.trim() || null,
    phone: editing.phone?.trim() || null,
    whatsapp: editing.whatsapp?.trim() || null,
    website: editing.website?.trim() || null,
    opening_hours: editing.opening_hours?.trim() || null,
    brand_color: editing.brand_color || '#c50000',
    logo_url: editing.logo_url || null,
  };
}

export default function BranchesPage() {
  const { profile } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [editing, setEditing] = useState<Partial<Branch> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isSuperAdmin = profile?.role === 'super_admin';
  const isAdminSucursal = profile?.role === 'admin_sucursal';
  const canManage = isSuperAdmin || isAdminSucursal;

  useEffect(() => {
    loadBranches();
  }, [profile]);

  async function loadBranches() {
    let query = supabase.from('branches').select('*').eq('is_active', true).order('name');
    if (!isSuperAdmin && profile?.branch_id) {
      query = query.eq('id', profile.branch_id);
    }
    const { data } = await query;
    if (data) setBranches(data as Branch[]);
  }

  async function uploadBranchLogo(file: File, branchId: string): Promise<string> {
    const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const safeExt = ['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext) ? ext : 'png';
    const path = `branch-logos/${branchId}/logo-${Date.now()}.${safeExt}`;

    const { error } = await supabase.storage
      .from(GALLERY_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type || 'image/png' });

    if (error) throw new Error(`Error subiendo logo: ${error.message}`);

    const { data } = supabase.storage.from(GALLERY_BUCKET).getPublicUrl(path);
    return `${data.publicUrl}?v=${Date.now()}`;
  }

  async function handleSave() {
    if (!editing?.name?.trim() || !editing?.city?.trim()) {
      return alert('Nombre y ciudad son requeridos');
    }

    setSaving(true);
    try {
      const payload = buildPayload(editing);
      let branchId = editing.id;

      if (branchId) {
        const { error } = await supabase.from('branches').update(payload).eq('id', branchId);
        if (error) throw new Error(error.message);
      } else {
        if (!isSuperAdmin) throw new Error('Solo super admin puede crear sucursales');
        const { data, error } = await supabase.from('branches').insert(payload).select().single();
        if (error || !data) throw new Error(error?.message || 'Error al crear sucursal');
        branchId = data.id;
      }

      if (logoFile && branchId) {
        const logoUrl = await uploadBranchLogo(logoFile, branchId);
        const { error } = await supabase.from('branches').update({ logo_url: logoUrl }).eq('id', branchId);
        if (error) throw new Error(error.message);
      }

      setShowForm(false);
      setEditing(null);
      setLogoFile(null);
      setLogoPreview(null);
      if (fileRef.current) fileRef.current.value = '';
      loadBranches();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Desactivar esta sucursal?')) return;
    await supabase.from('branches').update({ is_active: false }).eq('id', id);
    loadBranches();
  }

  function openEdit(branch: Branch) {
    setEditing(branch);
    setLogoFile(null);
    setLogoPreview(branch.logo_url);
    setShowForm(true);
  }

  function openNew() {
    setEditing({ ...emptyBranch });
    setLogoFile(null);
    setLogoPreview(null);
    setShowForm(true);
  }

  function handleLogoSelect(file: File) {
    if (!file.type.startsWith('image/')) {
      alert('Selecciona una imagen PNG, JPG o WEBP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('El logo debe pesar menos de 5 MB');
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function removeLogo() {
    setLogoFile(null);
    setLogoPreview(null);
    setEditing((e) => (e ? { ...e, logo_url: null } : e));
    if (fileRef.current) fileRef.current.value = '';
  }

  function canEditBranch(branch: Branch): boolean {
    if (isSuperAdmin) return true;
    if (isAdminSucursal && profile?.branch_id === branch.id) return true;
    return false;
  }

  if (!canManage) {
    return <p className="text-gray-500">No tienes permisos para gestionar sucursales.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-7 h-7 text-pollon-red" />
            Sucursales
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Configura el logo de cada sucursal. Se usa automaticamente en el header de tus publicaciones.
          </p>
        </div>
        {isSuperAdmin && (
          <Button onClick={openNew}>
            <Plus className="w-4 h-4 mr-1" /> Nueva sucursal
          </Button>
        )}
      </div>

      {showForm && editing && (
        <Card className="border-pollon-red/20">
          <CardHeader>
            <CardTitle>{editing.id ? 'Editar sucursal' : 'Nueva sucursal'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Nombre *</Label>
                <Input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label>Ciudad *</Label>
                <Input value={editing.city || ''} onChange={(e) => setEditing({ ...editing, city: e.target.value })} />
              </div>
              <div>
                <Label>Direccion</Label>
                <Input value={editing.address || ''} onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
              </div>
              <div>
                <Label>Telefono</Label>
                <Input value={editing.phone || ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input value={editing.whatsapp || ''} onChange={(e) => setEditing({ ...editing, whatsapp: e.target.value })} placeholder="+56986925310" />
              </div>
              <div>
                <Label>Pagina web</Label>
                <Input value={editing.website || ''} onChange={(e) => setEditing({ ...editing, website: e.target.value })} placeholder="www.el-pollon.cl" />
              </div>
              <div>
                <Label>Horario</Label>
                <Input value={editing.opening_hours || ''} onChange={(e) => setEditing({ ...editing, opening_hours: e.target.value })} placeholder="Lun-Dom 11:30 - 23:00" />
              </div>
              <div>
                <Label>Color de marca</Label>
                <div className="flex gap-2 mt-1">
                  <Input type="color" className="w-16 h-10 p-1" value={editing.brand_color || '#c50000'} onChange={(e) => setEditing({ ...editing, brand_color: e.target.value })} />
                  <Input value={editing.brand_color || '#c50000'} onChange={(e) => setEditing({ ...editing, brand_color: e.target.value })} className="flex-1 font-mono text-sm" />
                </div>
              </div>
            </div>

            <div className="border rounded-xl p-5 bg-gray-50 space-y-4">
              <div>
                <Label className="text-base font-semibold flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-pollon-red" />
                  Logotipo de la sucursal
                </Label>
                <p className="text-xs text-gray-500 mt-1">
                  Sube tu logo real (PNG con fondo transparente recomendado). Aparecera en el header y footer de las imagenes generadas.
                </p>
              </div>

              <div className="flex flex-wrap items-start gap-6">
                <div className="relative">
                  <div className="w-32 h-32 rounded-full border-4 border-white shadow-lg bg-white flex items-center justify-center overflow-hidden">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-gray-400 p-2">
                        <ImageIcon className="w-10 h-10 mx-auto mb-1 opacity-40" />
                        <span className="text-[10px]">Sin logo</span>
                      </div>
                    )}
                  </div>
                  {logoPreview && (
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center shadow"
                      title="Quitar logo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex-1 min-w-[200px] space-y-3">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleLogoSelect(e.target.files[0])}
                  />
                  <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" />
                    {logoPreview ? 'Cambiar logo' : 'Subir logo desde PC'}
                  </Button>
                  <div>
                    <Label className="text-xs text-gray-500">O pegar URL del logo</Label>
                    <Input
                      className="mt-1 text-sm"
                      placeholder="https://..."
                      value={editing.logo_url && !logoFile ? editing.logo_url.split('?')[0] : ''}
                      onChange={(e) => {
                        const url = e.target.value.trim();
                        setEditing({ ...editing, logo_url: url || null });
                        setLogoPreview(url || null);
                        setLogoFile(null);
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Recomendado: 400x400 px, PNG transparente, max 5 MB
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar sucursal'}
              </Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); setLogoFile(null); setLogoPreview(null); }}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {branches.map((branch) => (
          <Card key={branch.id} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex">
                <div className="w-24 shrink-0 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center p-3 border-r">
                  {branch.logo_url ? (
                    <img src={branch.logo_url} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-white shadow" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-pollon-red/10 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-pollon-red/40" />
                    </div>
                  )}
                </div>
                <div className="flex-1 p-5">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h3 className="font-semibold text-lg">{branch.name}</h3>
                      <p className="text-sm text-gray-500">{branch.city}</p>
                    </div>
                    <div className="w-5 h-5 rounded-full border-2 border-white shadow shrink-0" style={{ backgroundColor: branch.brand_color }} title="Color de marca" />
                  </div>
                  {branch.address && <p className="text-sm mt-2 text-gray-600">{branch.address}</p>}
                  <p className="text-sm mt-1 text-gray-500">
                    {branch.phone && `Tel: ${branch.phone}`}
                    {branch.whatsapp && ` · WA: ${branch.whatsapp}`}
                  </p>
                  {branch.opening_hours && <p className="text-xs text-gray-400 mt-1">{branch.opening_hours}</p>}
                  {!branch.logo_url && (
                    <p className="text-xs text-amber-600 mt-2">Sin logo — sube uno para personalizar publicaciones</p>
                  )}
                  {canEditBranch(branch) && (
                    <div className="flex gap-2 mt-4">
                      <Button size="sm" variant="outline" onClick={() => openEdit(branch)}>
                        <Pencil className="w-3 h-3 mr-1" /> Editar
                      </Button>
                      {isSuperAdmin && (
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(branch.id)}>
                          <Trash2 className="w-3 h-3 mr-1" /> Desactivar
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {branches.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">No hay sucursales activas.</CardContent>
        </Card>
      )}
    </div>
  );
}
