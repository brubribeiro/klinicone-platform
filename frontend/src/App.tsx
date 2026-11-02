import { Routes, Route, Navigate } from 'react-router-dom';

import { Login } from './pages/Login';
import { ChoosePanel } from './pages/ChoosePanel';
import { TermsOfUse } from './pages/TermsOfUse';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { Dashboard } from './pages/Dashboard';
import { Patients } from './pages/Patients';
import { PatientDetail } from './pages/PatientDetail';
import { Appointments } from './pages/Appointments';
import { Procedures } from './pages/Procedures';
import { Finance } from './pages/Finance';
import { Inventory } from './pages/Inventory';
import { InventoryDetail } from './pages/InventoryDetail';
import { Professionals } from './pages/Professionals';
import { Users } from './pages/Users';
import { Roles } from './pages/Roles';
import { Messages } from './pages/Messages';
import { Availability } from './pages/Availability';
import { EquipmentPage } from './pages/Equipment';
import { Documents } from './pages/Documents';
import { RecurringExpensesPage } from './pages/RecurringExpenses';
import { Packages } from './pages/Packages';
import { Metrics } from './pages/Metrics';
import { Goals } from './pages/Goals';
import { Pendencias } from './pages/Pendencias';
import { SkincareRoutines } from './pages/SkincareRoutines';
import { Promotions } from './pages/Promotions';
import { PaymentMethods } from './pages/PaymentMethods';
import { MyPlan } from './pages/MyPlan';
import { Layout } from './components/Layout';
import { PrivateRoute } from './components/PrivateRoute';
import { AdminRoute } from './components/AdminRoute';
import { PermissionRoute } from './components/PermissionRoute';
import { FeatureRoute } from './components/FeatureRoute';
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/escolher-painel" element={<ChoosePanel />} />
      <Route path="/termos" element={<TermsOfUse />} />
      <Route path="/privacidade" element={<PrivacyPolicy />} />
      <Route
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route
          path="/pacientes"
          element={
            <FeatureRoute feature="patients">
              <PermissionRoute permission="patients:view">
              <Patients />
            </PermissionRoute>
            </FeatureRoute>
          }
        />
        <Route
          path="/pacientes/:id"
          element={
            <FeatureRoute feature="patients">
              <PermissionRoute permission="patients:view">
              <PatientDetail />
            </PermissionRoute>
            </FeatureRoute>
          }
        />
        <Route
          path="/agenda"
          element={
            <FeatureRoute feature="appointments">
              <PermissionRoute permission="appointments:view">
              <Appointments />
            </PermissionRoute>
            </FeatureRoute>
          }
        />
        <Route
          path="/procedimentos"
          element={
            <FeatureRoute feature="procedures">
              <PermissionRoute permission="procedures:view">
              <Procedures />
            </PermissionRoute>
            </FeatureRoute>
          }
        />
        <Route
          path="/pacotes"
          element={
            <FeatureRoute feature="packages">
              <PermissionRoute permission="packages:view">
              <Packages />
            </PermissionRoute>
            </FeatureRoute>
          }
        />
        <Route
          path="/financeiro"
          element={
            <FeatureRoute feature="finance">
              <PermissionRoute permission="finance:view">
              <Finance />
            </PermissionRoute>
            </FeatureRoute>
          }
        />
        <Route
          path="/despesas-recorrentes"
          element={
            <FeatureRoute feature="recurring_expenses">
              <PermissionRoute permission="finance:view">
              <RecurringExpensesPage />
            </PermissionRoute>
            </FeatureRoute>
          }
        />
        <Route
          path="/estoque"
          element={
            <FeatureRoute feature="inventory">
              <PermissionRoute permission="inventory:view">
              <Inventory />
            </PermissionRoute>
            </FeatureRoute>
          }
        />
        <Route
          path="/estoque/:id"
          element={
            <FeatureRoute feature="inventory">
              <PermissionRoute permission="inventory:view">
              <InventoryDetail />
            </PermissionRoute>
            </FeatureRoute>
          }
        />
        <Route
          path="/profissionais"
          element={
            <PermissionRoute permission="users:view">
              <Professionals />
            </PermissionRoute>
          }
        />
        <Route
          path="/usuarios"
          element={
            <PermissionRoute permission="users:view">
              <Users />
            </PermissionRoute>
          }
        />
        <Route
          path="/grupos"
          element={
            <PermissionRoute permission="roles:view">
              <Roles />
            </PermissionRoute>
          }
        />
        <Route
          path="/meu-plano"
          element={
            <AdminRoute>
              <MyPlan />
            </AdminRoute>
          }
        />
        <Route
          path="/mensagens"
          element={
            <FeatureRoute feature="messages">
              <PermissionRoute permission="messages:view">
              <Messages />
            </PermissionRoute>
            </FeatureRoute>
          }
        />
        <Route
          path="/horarios"
          element={
            <FeatureRoute feature="availability">
              <Availability />
            </FeatureRoute>
          }
        />
        <Route
          path="/equipamentos"
          element={
            <FeatureRoute feature="equipment">
              <PermissionRoute permission="equipment:view">
              <EquipmentPage />
            </PermissionRoute>
            </FeatureRoute>
          }
        />
        <Route
          path="/documentos"
          element={
            <FeatureRoute feature="documents">
              <PermissionRoute permission="documents:view">
              <Documents />
            </PermissionRoute>
            </FeatureRoute>
          }
        />
        <Route
          path="/metricas"
          element={
            <FeatureRoute feature="metrics">
              <PermissionRoute permission="metrics:view">
              <Metrics />
            </PermissionRoute>
            </FeatureRoute>
          }
        />
        <Route
          path="/metas"
          element={
            <FeatureRoute feature="goals">
              <PermissionRoute permission="goals:view">
              <Goals />
            </PermissionRoute>
            </FeatureRoute>
          }
        />
        <Route
          path="/pendencias"
          element={
            <PermissionRoute permission="pendencias:view">
              <Pendencias />
            </PermissionRoute>
          }
        />
        <Route
          path="/rotinas"
          element={
            <FeatureRoute feature="routines">
              <PermissionRoute permission="routines:view">
              <SkincareRoutines />
            </PermissionRoute>
            </FeatureRoute>
          }
        />
        <Route
          path="/promocoes"
          element={
            <FeatureRoute feature="promotions">
              <PermissionRoute permission="promotions:view">
              <Promotions />
            </PermissionRoute>
            </FeatureRoute>
          }
        />
        <Route
          path="/formas-pagamento"
          element={
            <FeatureRoute feature="payment_methods">
              <PermissionRoute permission="payment-methods:view">
              <PaymentMethods />
            </PermissionRoute>
            </FeatureRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
