import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import type { User } from './types';

vi.setConfig({ testTimeout: 30_000 });

const auth = vi.hoisted(() => ({ user: null as Partial<User> | null, loading: false }));
vi.mock('./contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('./components/Layout', () => ({ Layout: () => <div data-testid="layout"><Outlet /></div> }));
vi.mock('./utils/appUrls', () => ({ adminConsoleUrl: (p: string) => `https://admin.test${p}`, clinicPanelUrl: (p: string) => p }));
vi.mock('./components/ExternalRedirect', () => ({ ExternalRedirect: ({ href }: { href: string }) => <p>externo:{href}</p> }));
vi.mock('./pages/Login', () => ({ Login: () => <p>página:Login</p> }));
vi.mock('./pages/ChoosePanel', () => ({ ChoosePanel: () => <p>página:ChoosePanel</p> }));
vi.mock('./pages/TermsOfUse', () => ({ TermsOfUse: () => <p>página:TermsOfUse</p> }));
vi.mock('./pages/PrivacyPolicy', () => ({ PrivacyPolicy: () => <p>página:PrivacyPolicy</p> }));
vi.mock('./pages/Dashboard', () => ({ Dashboard: () => <p>página:Dashboard</p> }));
vi.mock('./pages/Patients', () => ({ Patients: () => <p>página:Patients</p> }));
vi.mock('./pages/PatientDetail', () => ({ PatientDetail: () => <p>página:PatientDetail</p> }));
vi.mock('./pages/Appointments', () => ({ Appointments: () => <p>página:Appointments</p> }));
vi.mock('./pages/Procedures', () => ({ Procedures: () => <p>página:Procedures</p> }));
vi.mock('./pages/Finance', () => ({ Finance: () => <p>página:Finance</p> }));
vi.mock('./pages/Inventory', () => ({ Inventory: () => <p>página:Inventory</p> }));
vi.mock('./pages/InventoryDetail', () => ({ InventoryDetail: () => <p>página:InventoryDetail</p> }));
vi.mock('./pages/Professionals', () => ({ Professionals: () => <p>página:Professionals</p> }));
vi.mock('./pages/Users', () => ({ Users: () => <p>página:Users</p> }));
vi.mock('./pages/Roles', () => ({ Roles: () => <p>página:Roles</p> }));
vi.mock('./pages/Messages', () => ({ Messages: () => <p>página:Messages</p> }));
vi.mock('./pages/Availability', () => ({ Availability: () => <p>página:Availability</p> }));
vi.mock('./pages/Equipment', () => ({ EquipmentPage: () => <p>página:EquipmentPage</p> }));
vi.mock('./pages/Documents', () => ({ Documents: () => <p>página:Documents</p> }));
vi.mock('./pages/RecurringExpenses', () => ({ RecurringExpensesPage: () => <p>página:RecurringExpensesPage</p> }));
vi.mock('./pages/Packages', () => ({ Packages: () => <p>página:Packages</p> }));
vi.mock('./pages/Metrics', () => ({ Metrics: () => <p>página:Metrics</p> }));
vi.mock('./pages/Goals', () => ({ Goals: () => <p>página:Goals</p> }));
vi.mock('./pages/Pendencias', () => ({ Pendencias: () => <p>página:Pendencias</p> }));
vi.mock('./pages/SkincareRoutines', () => ({ SkincareRoutines: () => <p>página:SkincareRoutines</p> }));
vi.mock('./pages/Promotions', () => ({ Promotions: () => <p>página:Promotions</p> }));
vi.mock('./pages/PaymentMethods', () => ({ PaymentMethods: () => <p>página:PaymentMethods</p> }));
vi.mock('./pages/MyPlan', () => ({ MyPlan: () => <p>página:MyPlan</p> }));
vi.mock('./pages/AnamnesisQuestions', () => ({ AnamnesisQuestions: () => <p>página:AnamnesisQuestions</p> }));
vi.mock('./pages/PublicAnamnesis', () => ({ PublicAnamnesis: () => <p>página:PublicAnamnesis</p> }));

const ALL_FEATURES = [
  'appointments', 'patients', 'procedures', 'routines', 'packages', 'promotions', 'availability', 'equipment', 'inventory',
  'finance', 'recurring_expenses', 'payment_methods', 'metrics', 'goals', 'documents', 'messages',
] as User['features'];
const ALL_PERMS = [
  'pendencias:view', 'appointments:view', 'patients:view', 'procedures:view', 'routines:view', 'packages:view', 'promotions:view',
  'users:view', 'roles:view', 'equipment:view', 'inventory:view', 'finance:view', 'payment-methods:view', 'metrics:view',
  'goals:view', 'documents:view', 'messages:view',
] as User['permissions'];

const admin: Partial<User> = {
  id: 'u1', name: 'Ana', roleName: 'Administrador', tenantId: 't1', isSuperAdmin: false,
  permissions: ALL_PERMS, features: ALL_FEATURES,
};

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  auth.user = admin;
  auth.loading = false;
});

describe('App — rotas públicas', () => {
  it.each([
    ['/login', 'Login'],
    ['/escolher-painel', 'ChoosePanel'],
    ['/termos', 'TermsOfUse'],
    ['/privacidade', 'PrivacyPolicy'],
    ['/anamnese/abc123', 'PublicAnamnesis'],
  ])('%s renderiza %s sem login e sem o Layout', (path, page) => {
    auth.user = null;
    renderAt(path);
    expect(screen.getByText(`página:${page}`)).toBeInTheDocument();
    expect(screen.queryByTestId('layout')).not.toBeInTheDocument();
  });
});

describe('App — área da clínica', () => {
  it.each([
    ['/', 'Dashboard'],
    ['/pacientes', 'Patients'],
    ['/pacientes/p1', 'PatientDetail'],
    ['/agenda', 'Appointments'],
    ['/procedimentos', 'Procedures'],
    ['/pacotes', 'Packages'],
    ['/financeiro', 'Finance'],
    ['/despesas-recorrentes', 'RecurringExpensesPage'],
    ['/estoque', 'Inventory'],
    ['/estoque/i1', 'InventoryDetail'],
    ['/profissionais', 'Professionals'],
    ['/usuarios', 'Users'],
    ['/grupos', 'Roles'],
    ['/meu-plano', 'MyPlan'],
    ['/perguntas-anamnese', 'AnamnesisQuestions'],
    ['/mensagens', 'Messages'],
    ['/horarios', 'Availability'],
    ['/equipamentos', 'EquipmentPage'],
    ['/documentos', 'Documents'],
    ['/metricas', 'Metrics'],
    ['/metas', 'Goals'],
    ['/pendencias', 'Pendencias'],
    ['/rotinas', 'SkincareRoutines'],
    ['/promocoes', 'Promotions'],
    ['/formas-pagamento', 'PaymentMethods'],
  ])('%s renderiza %s dentro do Layout', (path, page) => {
    renderAt(path);
    expect(screen.getByTestId('layout')).toContainElement(screen.getByText(`página:${page}`));
  });

  it('sem login redireciona para /login', () => {
    auth.user = null;
    renderAt('/pacientes');
    expect(screen.getByText('página:Login')).toBeInTheDocument();
  });

  it('enquanto carrega mostra o spinner e nenhuma página', () => {
    auth.loading = true;
    renderAt('/pacientes');
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText('página:Patients')).not.toBeInTheDocument();
  });

  it('painel pendente de escolha vai para /escolher-painel', () => {
    auth.user = { ...admin, panelSelectionPending: true };
    renderAt('/');
    expect(screen.getByText('página:ChoosePanel')).toBeInTheDocument();
  });

  it('super-admin sem clínica é enviado ao console admin', () => {
    auth.user = { ...admin, isSuperAdmin: true, tenantId: undefined };
    renderAt('/');
    expect(screen.getByText('externo:https://admin.test/clinicas')).toBeInTheDocument();
  });

  it('rota desconhecida volta ao dashboard', () => {
    renderAt('/nao-existe');
    expect(screen.getByText('página:Dashboard')).toBeInTheDocument();
  });

  it('módulo fora do plano mostra aviso em vez da página', () => {
    auth.user = { ...admin, features: ['appointments'] as User['features'] };
    renderAt('/financeiro');
    expect(screen.getByText(/não está incluído no plano/)).toBeInTheDocument();
    expect(screen.queryByText('página:Finance')).not.toBeInTheDocument();
  });

  it('sem permissão avisa e volta ao dashboard', () => {
    auth.user = { ...admin, permissions: ['patients:view'] as User['permissions'] };
    renderAt('/financeiro');
    expect(screen.queryByText('página:Finance')).not.toBeInTheDocument();
    expect(screen.getByText('página:Dashboard')).toBeInTheDocument();
  });

  it('rotas de administrador bloqueiam quem não é do grupo Administrador', () => {
    auth.user = { ...admin, roleName: 'Recepção' };
    renderAt('/perguntas-anamnese');
    expect(screen.queryByText('página:AnamnesisQuestions')).not.toBeInTheDocument();
    expect(screen.getByText('página:Dashboard')).toBeInTheDocument();
  });

  it('horários só exigem o módulo, não uma permissão', () => {
    auth.user = { ...admin, permissions: ['patients:view'] as User['permissions'] };
    renderAt('/horarios');
    expect(screen.getByText('página:Availability')).toBeInTheDocument();
  });
});
