import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { PrivateRoute } from './PrivateRoute';
import { AdminRoute } from './AdminRoute';
import { PermissionRoute } from './PermissionRoute';
import { FeatureRoute } from './FeatureRoute';
import { ChoosePanel } from '../pages/ChoosePanel';
import type { User } from '../types';

const auth = vi.hoisted(() => ({
  user: null as Partial<User> | null,
  loading: false,
  selectPanel: vi.fn(),
}));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));

const clinicUser: Partial<User> = {
  id: 'u1',
  name: 'Ana Souza',
  roleName: 'Recepção',
  tenantId: 't1',
  isSuperAdmin: false,
  permissions: ['appointments:view'],
  features: ['appointments'],
};

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<p>tela de login</p>} />
        <Route path="/escolher-painel" element={<ChoosePanel />} />
        <Route path="/" element={<PrivateRoute><p>início</p></PrivateRoute>} />
        <Route
          path="/agenda"
          element={
            <PrivateRoute>
              <FeatureRoute feature="appointments">
                <PermissionRoute permission="appointments:view">
                  <p>agenda</p>
                </PermissionRoute>
              </FeatureRoute>
            </PrivateRoute>
          }
        />
        <Route
          path="/financeiro"
          element={
            <PrivateRoute>
              <PermissionRoute permission="finance:view">
                <p>financeiro</p>
              </PermissionRoute>
            </PrivateRoute>
          }
        />
        <Route
          path="/estoque"
          element={
            <PrivateRoute>
              <FeatureRoute feature="inventory">
                <p>estoque</p>
              </FeatureRoute>
            </PrivateRoute>
          }
        />
        <Route
          path="/configuracoes"
          element={
            <PrivateRoute>
              <AdminRoute>
                <p>configurações</p>
              </AdminRoute>
            </PrivateRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('rotas protegidas do painel da clínica', () => {
  beforeEach(() => {
    auth.user = null;
    auth.loading = false;
  });

  it('enquanto carrega a sessão mostra o carregando, sem redirecionar', () => {
    auth.loading = true;
    renderApp('/agenda');
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText('tela de login')).not.toBeInTheDocument();
  });

  it('sem sessão vai para /login', () => {
    renderApp('/agenda');
    expect(screen.getByText('tela de login')).toBeInTheDocument();
  });

  it('conta dual com escolha pendente vai para /escolher-painel', () => {
    auth.user = { ...clinicUser, panelSelectionPending: true, canChoosePanel: true };
    renderApp('/agenda');
    expect(screen.getByText('Escolha o painel')).toBeInTheDocument();
  });

  it('usuário com módulo e permissão entra na página', () => {
    auth.user = clinicUser;
    renderApp('/agenda');
    expect(screen.getByText('agenda')).toBeInTheDocument();
  });

  it('sem a permissão volta ao início', () => {
    auth.user = clinicUser;
    renderApp('/financeiro');
    expect(screen.getByText('início')).toBeInTheDocument();
    expect(screen.queryByText('financeiro')).not.toBeInTheDocument();
  });

  it('usuário sem nenhuma permissão é mandado ao login', () => {
    auth.user = { ...clinicUser, permissions: [] };
    renderApp('/financeiro');
    expect(screen.getByText('tela de login')).toBeInTheDocument();
  });

  it('módulo fora do plano mostra o aviso em vez da página', () => {
    auth.user = clinicUser;
    renderApp('/estoque');
    expect(screen.getByText(/não está incluído no plano desta clínica/)).toBeInTheDocument();
    expect(screen.queryByText('estoque')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/');
  });

  it('página de administrador: só o grupo Administrador entra', () => {
    auth.user = clinicUser;
    const { unmount } = renderApp('/configuracoes');
    expect(screen.getByText('início')).toBeInTheDocument();
    unmount();

    auth.user = { ...clinicUser, roleName: 'Administrador' };
    renderApp('/configuracoes');
    expect(screen.getByText('configurações')).toBeInTheDocument();
  });
});

describe('troca de painel (conta dual)', () => {
  const locationReplace = vi.fn();
  let hrefSet: string[];

  beforeEach(() => {
    hrefSet = [];
    auth.user = null;
    auth.selectPanel.mockReset();
    locationReplace.mockReset();
    const fakeLocation = {
      ...window.location,
      replace: locationReplace,
      get href() {
        return hrefSet[hrefSet.length - 1] ?? 'http://localhost/escolher-painel';
      },
      set href(value: string) {
        hrefSet.push(value);
      },
    };
    vi.stubGlobal('location', fakeLocation);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const dual: Partial<User> = {
    ...clinicUser,
    roleName: 'Administrador',
    isSuperAdmin: true,
    canChoosePanel: true,
    panelSelectionPending: true,
  };

  it('escolher a clínica troca o token e abre o painel da clínica', async () => {
    auth.user = dual;
    auth.selectPanel.mockResolvedValue(undefined);
    renderApp('/escolher-painel');
    expect(screen.getByText(/Olá, Ana/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Painel da clínica/ }));
    expect(auth.selectPanel).toHaveBeenCalledWith('clinic');
    await waitFor(() => expect(hrefSet).toEqual(['/']));
  });

  it('escolher a plataforma abre o console admin', async () => {
    auth.user = dual;
    auth.selectPanel.mockResolvedValue(undefined);
    renderApp('/escolher-painel');

    await userEvent.click(screen.getByRole('button', { name: /Console KlinicOne/ }));
    expect(auth.selectPanel).toHaveBeenCalledWith('admin');
    await waitFor(() => expect(hrefSet).toEqual(['/admin/clinicas']));
  });

  it('erro da API aparece e permite tentar de novo', async () => {
    auth.user = dual;
    auth.selectPanel.mockRejectedValueOnce({ response: { data: { message: 'Clínica suspensa.' } } });
    renderApp('/escolher-painel');

    await userEvent.click(screen.getByRole('button', { name: /Painel da clínica/ }));
    expect(await screen.findByText('Clínica suspensa.')).toBeInTheDocument();
    expect(hrefSet).toEqual([]);
    expect(screen.getByRole('button', { name: /Painel da clínica/ })).not.toBeDisabled();
  });

  it('quem não tem escolha não fica na tela: clínica vai ao início, super-admin puro ao console', () => {
    auth.user = clinicUser;
    const { unmount } = renderApp('/escolher-painel');
    expect(screen.getByText('início')).toBeInTheDocument();
    unmount();

    auth.user = { id: 'root', name: 'Root', isSuperAdmin: true, tenantId: null };
    renderApp('/escolher-painel');
    expect(locationReplace).toHaveBeenCalledWith('/admin/clinicas');
  });

  it('sem sessão a escolha manda para o login', () => {
    renderApp('/escolher-painel');
    expect(screen.getByText('tela de login')).toBeInTheDocument();
  });
});
