import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usersApi } from '../api/users';
import type { UserSummary } from '../types';
import { Users } from './Users';

vi.mock('../api/users', () => ({ usersApi: { list: vi.fn(), remove: vi.fn() } }));
vi.mock('../components/users/UserFormDialog', () => ({
  UserFormDialog: ({ open, user }: { open: boolean; user?: UserSummary | null }) =>
    open ? <div role="dialog" aria-label="form">{user ? `Editar ${user.name}` : 'Novo usuário'}</div> : null,
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), showToast: vi.fn() }));
const dialogs = vi.hoisted(() => ({ confirm: vi.fn(), alert: vi.fn() }));
const auth = vi.hoisted(() => ({
  user: { id: 'me', name: 'Ana', roleName: 'Administrador', permissions: [] as string[] },
  impersonate: vi.fn(),
}));
vi.mock('../contexts/AppToastContext', () => ({ useAppToast: () => toast }));
vi.mock('../contexts/AppDialogContext', () => ({ useAppDialog: () => dialogs }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;
const ALL = ['users:create', 'users:edit', 'users:delete'];

const role = (id: string, name: string) => ({ id, name, isSystem: false });
const mk = (i: number, extra: Partial<UserSummary> = {}): UserSummary => ({
  id: `u${i}`,
  name: `Pessoa ${String(i).padStart(2, '0')}`,
  email: `p${i}@clinica.com`,
  active: true,
  providesAppointments: false,
  roleId: 'r2',
  role: role('r2', 'Recepção'),
  createdAt: '2026-01-01T00:00:00Z',
  ...extra,
});

const base: UserSummary[] = [
  mk(1, { id: 'me', name: 'Dra. Ana Souza', email: 'ana@clinica.com', providesAppointments: true, isPrimary: true, role: role('r1', 'Administrador') }),
  mk(2, { name: 'Bia Lima', email: 'bia@clinica.com', active: false }),
  mk(3, { name: 'Carlos Dias', email: 'carlos@clinica.com', providesAppointments: true, role: role('r3', 'Profissional') }),
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Users />
      </BrowserRouter>
    </QueryClientProvider>,
  );
  return { invalidate };
}

async function pick(label: string, option: string) {
  await userEvent.click(screen.getByRole('combobox', { name: label }));
  await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: option }));
}

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/usuarios');
  auth.user.permissions = ALL;
  auth.user.roleName = 'Administrador';
  mocked(usersApi.list).mockResolvedValue(base);
});

describe('Users', () => {
  it('lista usuários com iniciais sem título, vínculo, grupo e status', async () => {
    renderPage();
    expect(await screen.findByText('Dra. Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('usuários com acesso')).toBeInTheDocument();
    expect(screen.getByText('AS')).toBeInTheDocument();
    expect(screen.getByText('BL')).toBeInTheDocument();
    expect(screen.getAllByText('Profissional').length).toBeGreaterThan(0);
    expect(screen.getByText('Inativo')).toBeInTheDocument();
    expect(screen.getAllByText('Ativo')).toHaveLength(2);
  });

  it('usa o singular com um usuário e mostra estado vazio', async () => {
    mocked(usersApi.list).mockResolvedValue([base[0]]);
    renderPage();
    expect(await screen.findByText('usuário com acesso')).toBeInTheDocument();
  });

  it('mostra mensagem de lista vazia', async () => {
    mocked(usersApi.list).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('Nenhum usuário cadastrado.')).toBeInTheDocument();
  });

  it('filtra por busca, status, vínculo e grupo', async () => {
    renderPage();
    await screen.findByText('Bia Lima');

    await userEvent.type(screen.getByPlaceholderText('Buscar usuário...'), 'carlos');
    expect(screen.queryByText('Bia Lima')).not.toBeInTheDocument();
    expect(screen.getByText('Carlos Dias')).toBeInTheDocument();
    await userEvent.clear(screen.getByPlaceholderText('Buscar usuário...'));
    await userEvent.type(screen.getByPlaceholderText('Buscar usuário...'), 'zzz');
    expect(screen.getByText('Nenhum usuário encontrado com os filtros.')).toBeInTheDocument();
    await userEvent.clear(screen.getByPlaceholderText('Buscar usuário...'));

    await pick('Status', 'Inativos');
    expect(screen.getByText('Bia Lima')).toBeInTheDocument();
    expect(screen.queryByText('Carlos Dias')).not.toBeInTheDocument();
    await pick('Status', 'Todos os status');

    await pick('Vínculo', 'Administrativo');
    expect(screen.getByText('Bia Lima')).toBeInTheDocument();
    expect(screen.queryByText('Carlos Dias')).not.toBeInTheDocument();
    await pick('Vínculo', 'Profissional');
    expect(screen.queryByText('Bia Lima')).not.toBeInTheDocument();
    await pick('Vínculo', 'Todos os vínculos');

    await pick('Grupo de permissão', 'Profissional');
    expect(screen.getByText('Carlos Dias')).toBeInTheDocument();
    expect(screen.queryByText('Bia Lima')).not.toBeInTheDocument();
  });

  it('abre o formulário para criar e editar', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Novo usuário' }));
    expect(screen.getByRole('dialog', { name: 'form' })).toHaveTextContent('Novo usuário');
    await userEvent.click(screen.getByRole('button', { name: 'Editar Bia Lima' }));
    expect(screen.getByRole('dialog', { name: 'form' })).toHaveTextContent('Editar Bia Lima');
  });

  it('esconde ações sem permissão', async () => {
    auth.user.permissions = [];
    auth.user.roleName = 'Recepção';
    renderPage();
    await screen.findByText('Bia Lima');
    expect(screen.queryByRole('button', { name: 'Novo usuário' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Excluir/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Personificar/ })).not.toBeInTheDocument();
  });

  it('personifica só outros usuários ativos, após confirmar', async () => {
    mocked(dialogs.confirm).mockResolvedValue(true);
    renderPage();
    await screen.findByText('Bia Lima');
    expect(screen.queryByRole('button', { name: 'Personificar Dra. Ana Souza' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Personificar Bia Lima' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Personificar Carlos Dias' }));
    await waitFor(() => expect(auth.impersonate).toHaveBeenCalledWith('u3'));
  });

  it('não personifica se o usuário cancelar', async () => {
    mocked(dialogs.confirm).mockResolvedValue(false);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Personificar Carlos Dias' }));
    await waitFor(() => expect(dialogs.confirm).toHaveBeenCalled());
    expect(auth.impersonate).not.toHaveBeenCalled();
  });

  it('exclui após confirmação e atualiza a lista', async () => {
    mocked(dialogs.confirm).mockResolvedValue(true);
    mocked(usersApi.remove).mockResolvedValue(undefined);
    const { invalidate } = renderPage();
    expect(await screen.findByRole('button', { name: 'Excluir Dra. Ana Souza' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Excluir Bia Lima' }));
    expect(dialogs.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Excluir usuário', message: expect.stringContaining('Bia Lima') }));
    await waitFor(() => expect(usersApi.remove).toHaveBeenCalledWith('u2'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Usuário excluído.'));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['users'] });
  });

  it('não exclui quando cancela e mostra o erro da API quando falha', async () => {
    mocked(dialogs.confirm).mockResolvedValueOnce(false);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir Bia Lima' }));
    await waitFor(() => expect(dialogs.confirm).toHaveBeenCalledTimes(1));
    expect(usersApi.remove).not.toHaveBeenCalled();

    mocked(dialogs.confirm).mockResolvedValueOnce(true);
    mocked(usersApi.remove).mockRejectedValue({ response: { data: { message: 'Usuário em uso' } } });
    await userEvent.click(screen.getByRole('button', { name: 'Excluir Carlos Dias' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Usuário em uso'));
  });

  it('pagina de 8 em 8', async () => {
    mocked(usersApi.list).mockResolvedValue(Array.from({ length: 10 }, (_, i) => mk(i + 1)));
    renderPage();
    expect(await screen.findByText('Pessoa 01')).toBeInTheDocument();
    expect(screen.getByText(/Mostrando 1–8 de/)).toHaveTextContent('Mostrando 1–8 de 10');
    expect(screen.queryByText('Pessoa 09')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Página 2' }));
    expect(screen.getByText('Pessoa 09')).toBeInTheDocument();
    expect(screen.getByText(/Mostrando 9–10 de/)).toHaveTextContent('Mostrando 9–10 de 10');
  });

  it('mostra "?" nas iniciais de nomes só com título', async () => {
    mocked(usersApi.list).mockResolvedValue([mk(1, { name: 'Dra.' })]);
    renderPage();
    expect(await screen.findByText('?')).toBeInTheDocument();
  });
});
