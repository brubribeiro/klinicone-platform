import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { rolesApi } from '../api/roles';
import { ALL_PERMISSIONS } from '../contexts/permissions';
import type { Role } from '../types';
import { Roles } from './Roles';

vi.mock('../api/roles', () => ({ rolesApi: { list: vi.fn(), update: vi.fn(), remove: vi.fn(), create: vi.fn() } }));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), showToast: vi.fn() }));
const dialogs = vi.hoisted(() => ({ confirm: vi.fn(), alert: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: 'me', name: 'Ana', roleName: 'Administrador', permissions: [] as string[] } }));
vi.mock('../contexts/AppToastContext', () => ({ useAppToast: () => toast }));
vi.mock('../contexts/AppDialogContext', () => ({ useAppDialog: () => dialogs }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;
const ALL = ['roles:create', 'roles:edit', 'roles:delete'];

const roles: Role[] = [
  { id: 'r1', name: 'Administrador', description: 'Acesso total', permissions: [...ALL_PERMISSIONS], isSystem: true, restrictToOwnAppointments: false, color: '#15998B', _count: { users: 1 } },
  { id: 'r2', name: 'Recepção', description: 'Atendimento', permissions: ['patients:view', 'appointments:view'], isSystem: false, restrictToOwnAppointments: true, color: '#5BA8DE', _count: { users: 3 } },
  { id: 'r3', name: 'Financeiro', permissions: ['finance:view'], isSystem: false, restrictToOwnAppointments: false, _count: { users: 0 } },
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Roles />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.user.permissions = ALL;
  mocked(rolesApi.list).mockResolvedValue(roles);
});

describe('Roles', () => {
  it('seleciona o primeiro grupo e mostra contagem de permissões e membros', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Permissões — Administrador' })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`^${ALL_PERMISSIONS.length} de ${ALL_PERMISSIONS.length} permissões`))).toBeInTheDocument();
    expect(screen.getByText('Acesso total')).toBeInTheDocument();
    expect(screen.getByText(/O grupo Administrador sempre tem acesso total/)).toBeInTheDocument();
    // matriz somente leitura para o Administrador
    expect(screen.queryByRole('button', { name: 'Visualizar Pacientes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excluir grupo Administrador' })).not.toBeInTheDocument();
    expect(screen.getByText('3 membros')).toBeInTheDocument();
    expect(screen.getByText('0 membros')).toBeInTheDocument();
  });

  it('troca de grupo e mostra a restrição de agenda', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /^Recepção\s*\d+ membros/ }));
    expect(await screen.findByRole('heading', { name: 'Permissões — Recepção' })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`^2 de ${ALL_PERMISSIONS.length} permissões`))).toBeInTheDocument();
    expect(screen.getByText('Só a própria agenda')).toBeInTheDocument();
  });

  it('edita permissões, descarta e salva', async () => {
    mocked(rolesApi.update).mockResolvedValue({ ...roles[1], permissions: ['patients:view', 'appointments:view', 'patients:create'] });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /^Recepção\s*\d+ membros/ }));
    await screen.findByRole('heading', { name: 'Permissões — Recepção' });

    await userEvent.click(screen.getByRole('button', { name: 'Criar Pacientes' }));
    expect(screen.getByText('Alterações não salvas')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`^3 de ${ALL_PERMISSIONS.length} permissões`))).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(screen.queryByText('Alterações não salvas')).not.toBeInTheDocument();
    expect(screen.getByText(new RegExp(`^2 de ${ALL_PERMISSIONS.length} permissões`))).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Criar Pacientes' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar permissões' }));
    await waitFor(() =>
      expect(rolesApi.update).toHaveBeenCalledWith('r2', {
        permissions: ['patients:view', 'appointments:view', 'patients:create'],
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Permissões atualizadas.'));
    await waitFor(() => expect(screen.queryByText('Alterações não salvas')).not.toBeInTheDocument());
    expect(screen.getByText(new RegExp(`^3 de ${ALL_PERMISSIONS.length} permissões`))).toBeInTheDocument();
  });

  it('mostra o erro da API ao salvar permissões e mantém o rascunho', async () => {
    mocked(rolesApi.update).mockRejectedValue({ response: { data: { message: 'Sem permissão para alterar' } } });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /^Financeiro\s*\d+ membros/ }));
    await screen.findByRole('heading', { name: 'Permissões — Financeiro' });
    await userEvent.click(screen.getByRole('button', { name: 'Editar Financeiro' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar permissões' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Sem permissão para alterar'));
    expect(screen.getByText('Alterações não salvas')).toBeInTheDocument();
  });

  it('pede confirmação para trocar de grupo com alterações pendentes', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /^Recepção\s*\d+ membros/ }));
    await screen.findByRole('heading', { name: 'Permissões — Recepção' });
    await userEvent.click(screen.getByRole('button', { name: 'Criar Pacientes' }));

    mocked(dialogs.confirm).mockResolvedValueOnce(false);
    await userEvent.click(screen.getByRole('button', { name: /^Financeiro\s*\d+ membros/ }));
    await waitFor(() => expect(dialogs.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Descartar alterações' })));
    expect(screen.getByRole('heading', { name: 'Permissões — Recepção' })).toBeInTheDocument();

    mocked(dialogs.confirm).mockResolvedValueOnce(true);
    await userEvent.click(screen.getByRole('button', { name: /^Financeiro\s*\d+ membros/ }));
    expect(await screen.findByRole('heading', { name: 'Permissões — Financeiro' })).toBeInTheDocument();
    expect(screen.queryByText('Alterações não salvas')).not.toBeInTheDocument();
  });

  it('exclui grupo após confirmar', async () => {
    mocked(dialogs.confirm).mockResolvedValue(true);
    mocked(rolesApi.remove).mockResolvedValue(undefined);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /^Financeiro\s*\d+ membros/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir grupo Financeiro' }));
    expect(dialogs.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Excluir grupo', message: expect.stringContaining('Financeiro') }));
    await waitFor(() => expect(rolesApi.remove).toHaveBeenCalledWith('r3'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Grupo excluído.'));
  });

  it('exibe erro da API ao excluir grupo com membros', async () => {
    mocked(dialogs.confirm).mockResolvedValue(true);
    mocked(rolesApi.remove).mockRejectedValue({ response: { data: { message: 'Grupo possui usuários' } } });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /^Recepção\s*\d+ membros/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir grupo Recepção' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Grupo possui usuários'));
  });

  it('cria grupo novo e o seleciona', async () => {
    const created: Role = { id: 'r4', name: 'Coordenação', permissions: [], isSystem: false, restrictToOwnAppointments: false, color: '#E0915B' };
    mocked(rolesApi.create).mockImplementation(async () => {
      mocked(rolesApi.list).mockResolvedValue([...roles, { ...created, _count: { users: 0 } }]);
      return created;
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Novo grupo' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByPlaceholderText('Ex.: Coordenação'), 'Coordenação');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar grupo' }));
    await waitFor(() => expect(rolesApi.create).toHaveBeenCalled());
    expect(await screen.findByRole('heading', { name: 'Permissões — Coordenação' })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`^0 de ${ALL_PERMISSIONS.length} permissões`))).toBeInTheDocument();
  });

  it('abre a edição do grupo selecionado', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Editar grupo Administrador' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Editar grupo de permissões')).toBeInTheDocument();
  });

  it('sem permissões, não mostra criar, editar nem excluir e a matriz é só leitura', async () => {
    auth.user.permissions = [];
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /^Financeiro\s*\d+ membros/ }));
    await screen.findByRole('heading', { name: 'Permissões — Financeiro' });
    expect(screen.queryByRole('button', { name: 'Novo grupo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar grupo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Excluir grupo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Visualizar Financeiro' })).not.toBeInTheDocument();
  });
});
