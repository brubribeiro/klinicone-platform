// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AdminSuperAdmins } from './AdminSuperAdmins';
import { adminApi } from '../api/admin';

vi.mock('../api/admin', () => ({ adminApi: { listSuperAdmins: vi.fn() } }));
vi.mock('../../../../frontend/src/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'sa-pure' } }) }));
vi.mock('../../../../frontend/src/contexts/AppDialogContext', () => ({ useAppDialog: () => ({ confirm: vi.fn() }) }));
vi.mock('../../../../frontend/src/contexts/AppToastContext', () => ({
  useAppToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock('../components/SuperAdminFormDialog', () => ({ SuperAdminFormDialog: () => null }));

const list = vi.mocked(adminApi.listSuperAdmins);

const base = { active: true, createdAt: '2026-01-01T00:00:00.000Z', lastAccessAt: null };
const pure = { ...base, id: 'sa-pure', name: 'Super Puro', email: 'puro@test.com', hasClinic: false, tenantId: null, tenantName: null, tenantSlug: null };
const dual = { ...base, id: 'sa-dual', name: 'Super Dual', email: 'dual@test.com', hasClinic: true, tenantId: 't1', tenantName: 'Clínica A', tenantSlug: 'a' };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });
  render(
    <QueryClientProvider client={client}>
      <AdminSuperAdmins />
    </QueryClientProvider>,
  );
}

describe('AdminSuperAdmins', () => {
  afterEach(() => {
    cleanup();
    list.mockReset();
  });

  it('lista conta dual e super-admin puro', async () => {
    list.mockResolvedValue([pure, dual]);
    renderPage();
    expect(await screen.findByText('Super Dual')).toBeTruthy();
    expect(screen.getByText('Super Puro')).toBeTruthy();
    expect(document.querySelector('.MuiSkeleton-root')).toBeNull();
  });

  it('erro na API mostra mensagem e "Tentar de novo" (sem skeleton nem lista vazia)', async () => {
    list.mockRejectedValueOnce({ response: { data: { message: 'Falha no servidor' } } });
    renderPage();

    expect((await screen.findByRole('alert')).textContent).toBe('Falha no servidor');
    expect(document.querySelector('.MuiSkeleton-root')).toBeNull();
    expect(screen.queryByText('Nenhum super-admin encontrado.')).toBeNull();

    list.mockResolvedValueOnce([pure, dual]);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(screen.getByText('Super Dual')).toBeTruthy());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
