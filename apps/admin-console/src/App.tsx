import { Navigate, Route, Routes } from 'react-router-dom';

import { SuperAdminRoute } from '../../../frontend/src/components/SuperAdminRoute';
import { AdminLayout } from './components/AdminLayout';
import { AdminAnnouncements } from './pages/AdminAnnouncements';
import { AdminAudit } from './pages/AdminAudit';
import { AdminCatalogs } from './pages/AdminCatalogs';
import { AdminFeedback } from './pages/AdminFeedback';
import { AdminObservability } from './pages/AdminObservability';
import { AdminPlans } from './pages/AdminPlans';
import { AdminTenantDetail } from './pages/AdminTenantDetail';
import { AdminTenants } from './pages/AdminTenants';
import { AdminUsage } from './pages/AdminUsage';
import { ChoosePanel } from '../../../frontend/src/pages/ChoosePanel';
import { Login } from '../../../frontend/src/pages/Login';

export default function AdminApp() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/escolher-painel" element={<ChoosePanel />} />
      <Route
        element={
          <SuperAdminRoute>
            <AdminLayout />
          </SuperAdminRoute>
        }
      >
        <Route index element={<Navigate to="clinicas" replace />} />
        <Route path="clinicas" element={<AdminTenants />} />
        <Route path="clinicas/:id" element={<AdminTenantDetail />} />
        <Route path="planos" element={<AdminPlans />} />
        <Route path="catalogos" element={<AdminCatalogs />} />
        <Route path="uso" element={<AdminUsage />} />
        <Route path="saude" element={<AdminObservability />} />
        <Route path="reports" element={<AdminFeedback />} />
        <Route path="anuncios" element={<AdminAnnouncements />} />
        <Route path="auditoria" element={<AdminAudit />} />
        <Route path="*" element={<Navigate to="clinicas" replace />} />
      </Route>
    </Routes>
  );
}
