import { Navigate, Route, Routes } from 'react-router-dom';

import { SuperAdminRoute } from '../../../frontend/src/components/SuperAdminRoute';
import { AdminLayout } from '../../../frontend/src/components/admin/AdminLayout';
import { AdminAnnouncements } from '../../../frontend/src/pages/admin/AdminAnnouncements';
import { AdminAudit } from '../../../frontend/src/pages/admin/AdminAudit';
import { AdminCatalogs } from '../../../frontend/src/pages/admin/AdminCatalogs';
import { AdminFeedback } from '../../../frontend/src/pages/admin/AdminFeedback';
import { AdminObservability } from '../../../frontend/src/pages/admin/AdminObservability';
import { AdminPlans } from '../../../frontend/src/pages/admin/AdminPlans';
import { AdminTenantDetail } from '../../../frontend/src/pages/admin/AdminTenantDetail';
import { AdminTenants } from '../../../frontend/src/pages/admin/AdminTenants';
import { AdminUsage } from '../../../frontend/src/pages/admin/AdminUsage';
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
