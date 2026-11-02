import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { PrivateRoute } from './PrivateRoute';
import { SuperAdminRoute } from './SuperAdminRoute';
import type { User } from '../types';

const auth = vi.hoisted(() => ({ user: null as Partial<User> | null, loading: false }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));

const locationReplace = vi.fn();

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<p>login</p>} />
        <Route path="/" element={<PrivateRoute><p>app da clínica</p></PrivateRoute>} />
        <Route path="/clinicas" element={<SuperAdminRoute><p>painel admin</p></SuperAdminRoute>} />
      </Routes>
    </MemoryRouter>,
  );
}

const clinicAdmin = { id: 'u1', roleName: 'Administrador', tenantId: 't1', isSuperAdmin: false };
const superAdmin = { id: 'root', roleName: '', tenantId: null, isSuperAdmin: true };

describe('rotas do super-admin', () => {
  beforeEach(() => {
    auth.user = null;
    locationReplace.mockReset();
    vi.stubGlobal('location', { ...window.location, replace: locationReplace, href: '' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('super-admin no painel da clínica é enviado ao console admin', () => {
    auth.user = superAdmin;
    renderAt('/');
    expect(locationReplace).toHaveBeenCalledWith('/admin/clinicas');
  });

  it('super-admin acessa rota do console', () => {
    auth.user = superAdmin;
    renderAt('/clinicas');
    expect(screen.getByText('painel admin')).toBeInTheDocument();
  });

  it('usuário de clínica não acessa rota do console', () => {
    auth.user = clinicAdmin;
    renderAt('/clinicas');
    expect(screen.getByText('app da clínica')).toBeInTheDocument();
    expect(screen.queryByText('painel admin')).not.toBeInTheDocument();
  });

  it('super-admin "entrando como" uma clínica usa o app da clínica', () => {
    auth.user = { ...superAdmin, tenantId: 't1', tenantName: 'Clínica Um', impersonating: true };
    renderAt('/');
    expect(screen.getByText('app da clínica')).toBeInTheDocument();
  });

  it('sem login vai para /login', () => {
    renderAt('/clinicas');
    expect(screen.getByText('login')).toBeInTheDocument();
  });
});
