import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, FileEdit,   LayoutTemplate, CheckCircle,
  Share2, History, Building2, Users, LogOut, Menu, X, Images, Tag, Layers, BookImage,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useScheduledPostsPublisher } from '@/hooks/useScheduledPostsPublisher';
import { useScheduledStoriesPublisher } from '@/hooks/useScheduledStoriesPublisher';
import { cn } from '@/lib/utils';
import { ROLE_LABELS } from '@/types';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/calendar', icon: Calendar, label: 'Calendario' },
  { to: '/posts/new', icon: FileEdit, label: 'Crear publicación' },
  { to: '/gallery', icon: Images, label: 'Galería' },
  { to: '/tags', icon: Tag, label: 'Etiquetas' },
  { to: '/templates', icon: LayoutTemplate, label: 'Plantillas' },
  { to: '/frame-config', icon: Layers, label: 'Header y Footer', roles: ['super_admin', 'admin_sucursal'] },
  { to: '/stories', icon: BookImage, label: 'Historias programadas', roles: ['super_admin', 'admin_sucursal'] },
  { to: '/approvals', icon: CheckCircle, label: 'Aprobaciones' },
  { to: '/social', icon: Share2, label: 'Redes sociales' },
  { to: '/history', icon: History, label: 'Historial' },
  { to: '/branches', icon: Building2, label: 'Sucursales', roles: ['super_admin', 'admin_sucursal'] },
  { to: '/users', icon: Users, label: 'Usuarios', roles: ['super_admin'] },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  useScheduledPostsPublisher();
  useScheduledStoriesPublisher();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filteredNav = navItems.filter(
    (item) => !item.roles || (profile && item.roles.includes(profile.role))
  );

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white transform transition-transform lg:translate-x-0 lg:static',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center gap-3 p-6 border-b border-gray-800">
          <div className="w-10 h-10 rounded-full bg-pollon-red flex items-center justify-center font-bold text-lg">EP</div>
          <div>
            <h1 className="font-bold text-sm">El Pollón</h1>
            <p className="text-xs text-gray-400">Social Automation</p>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {filteredNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive ? 'bg-pollon-red text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
          <button onClick={handleSignOut} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-400 hover:text-white w-full">
            <LogOut className="w-5 h-5" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b px-4 lg:px-8 py-4 flex items-center justify-between">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-4 ml-auto">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{profile?.full_name || profile?.email}</p>
              <p className="text-xs text-gray-500">{profile ? ROLE_LABELS[profile.role] : ''}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-pollon-red text-white flex items-center justify-center text-sm font-bold">
              {(profile?.full_name || profile?.email || 'U')[0].toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
