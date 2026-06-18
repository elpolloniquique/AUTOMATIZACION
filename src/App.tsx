import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import CalendarPage from '@/pages/CalendarPage';
import PostCreatorPage from '@/pages/PostCreatorPage';
import TemplatesPage from '@/pages/TemplatesPage';
import ApprovalsPage from '@/pages/ApprovalsPage';
import SocialConfigPage from '@/pages/SocialConfigPage';
import HistoryPage from '@/pages/HistoryPage';
import BranchesPage from '@/pages/BranchesPage';
import UsersPage from '@/pages/UsersPage';
import GalleryPage from '@/pages/GalleryPage';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={
        <ProtectedRoute>
          <DashboardLayout><DashboardPage /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/calendar" element={
        <ProtectedRoute>
          <DashboardLayout><CalendarPage /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/posts/new" element={
        <ProtectedRoute>
          <DashboardLayout><PostCreatorPage /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/posts/:id/edit" element={
        <ProtectedRoute>
          <DashboardLayout><PostCreatorPage /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/templates" element={
        <ProtectedRoute>
          <DashboardLayout><TemplatesPage /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/approvals" element={
        <ProtectedRoute roles={['super_admin', 'admin_sucursal', 'aprobador']}>
          <DashboardLayout><ApprovalsPage /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/social" element={
        <ProtectedRoute roles={['super_admin', 'admin_sucursal']}>
          <DashboardLayout><SocialConfigPage /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/history" element={
        <ProtectedRoute>
          <DashboardLayout><HistoryPage /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/branches" element={
        <ProtectedRoute roles={['super_admin', 'admin_sucursal']}>
          <DashboardLayout><BranchesPage /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/users" element={
        <ProtectedRoute roles={['super_admin']}>
          <DashboardLayout><UsersPage /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/gallery" element={
        <ProtectedRoute>
          <DashboardLayout><GalleryPage /></DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
