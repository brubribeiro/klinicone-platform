import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { rolesApi } from '../../api/roles';
import { usersApi } from '../../api/users';
import type { UserSummary } from '../../types';
import { UserFormDialog } from './UserFormDialog';

vi.mock('../../api/users', () => ({
  usersApi: { create: vi.fn(), update: vi.fn(), uploadPhoto: vi.fn(), removePhoto: vi.fn() },
}));
vi.mock('../../api/roles', () => ({ rolesApi: { list: vi.fn() } }));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), showToast: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const roles = [
  { id: 'r1', name: 'Administrador' },
  { id: 'r2', name: 'Recepção' },
];

const existing: UserSummary = {
  id: 'u1',
  name: 'Carlos Dias',
  email: 'carlos@clinica.com',
  active: true,
  providesAppointments: true,
  isPrimary: true,
  roleId: 'r2',
  role: { id: 'r2', name: 'Recepção', isSystem: false },
  createdAt: '2026-01-01T00:00:00Z',
  specialty: 'Dermatologista',
  specialties: ['Laser'],
  councilRegister: 'CRM-SP 123',
  calendarColor: '#15998B',
  bio: 'Bio antiga',
  photoUrl: 'https://cdn/foto.png',
};

function renderDialog(props: Partial<React.ComponentProps<typeof UserFormDialog>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <UserFormDialog open onClose={onClose} {...props} />
    </QueryClientProvider>,
  );
  return { onClose, invalidate };
}

async function choose(combo: HTMLElement, option: string) {
  await userEvent.click(combo);
  await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: option }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked(rolesApi.list).mockResolvedValue(roles);
});

describe('UserFormDialog', () => {
  it('valida nome, e-mail e grupo antes de enviar', async () => {
    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar usuário' }));
    expect(await screen.findByText('Nome é obrigatório')).toBeInTheDocument();
    expect(screen.getByText('E-mail é obrigatório')).toBeInTheDocument();
    expect(screen.getByText('Selecione um grupo')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('email@clinica.com'), 'invalido');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar usuário' }));
    expect(await screen.findByText('E-mail inválido')).toBeInTheDocument();
    expect(usersApi.create).not.toHaveBeenCalled();
  });

  it('cria usuário administrativo sem campos de profissional', async () => {
    mocked(usersApi.create).mockResolvedValue({ id: 'new' });
    const { onClose, invalidate } = renderDialog();
    expect(screen.getByText('Novo usuário')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Ex.: Dermatologista')).not.toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('Ex.: Larissa Nunes'), '  Larissa Nunes ');
    await userEvent.type(screen.getByPlaceholderText('email@clinica.com'), 'larissa@clinica.com');
    const combos = screen.getAllByRole('combobox');
    await choose(combos[1], 'Recepção');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar usuário' }));

    await waitFor(() => expect(usersApi.create).toHaveBeenCalledTimes(1));
    expect(usersApi.create).toHaveBeenCalledWith({
      name: 'Larissa Nunes',
      email: 'larissa@clinica.com',
      roleId: 'r2',
      active: true,
      providesAppointments: false,
      isPrimary: false,
      specialty: null,
      specialties: [],
      councilRegister: null,
      calendarColor: null,
      bio: null,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith('Usuário criado.');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['users'] });
  });

  it('cria profissional (preset) com função, registro, especialidades, cor e principal', async () => {
    mocked(usersApi.create).mockResolvedValue({ id: 'new' });
    renderDialog({ presetProfessional: true });
    await userEvent.type(screen.getByPlaceholderText('Ex.: Larissa Nunes'), 'Larissa');
    await userEvent.type(screen.getByPlaceholderText('email@clinica.com'), 'l@clinica.com');
    await choose(screen.getAllByRole('combobox')[1], 'Administrador');

    await userEvent.type(screen.getByPlaceholderText('Ex.: Dermatologista'), ' Biomédica ');
    await userEvent.type(screen.getByPlaceholderText('Ex.: CRM-SP 00.000'), 'CRBM 99');

    // multi-select de especialidades
    await userEvent.click(screen.getByText('Selecione as especialidades'));
    const listbox = await screen.findByRole('listbox');
    await userEvent.click(within(listbox).getByRole('option', { name: 'Toxina' }));
    await userEvent.click(within(listbox).getByRole('option', { name: 'Peeling' }));
    await userEvent.keyboard('{Escape}');

    await userEvent.click(screen.getByRole('button', { name: '#D46B8A' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Profissional principal' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar usuário' }));

    await waitFor(() => expect(usersApi.create).toHaveBeenCalledTimes(1));
    expect(usersApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        roleId: 'r1',
        providesAppointments: true,
        isPrimary: true,
        specialty: 'Biomédica',
        specialties: ['Toxina', 'Peeling'],
        councilRegister: 'CRBM 99',
        calendarColor: '#D46B8A',
        bio: null,
      }),
    );
  });

  it('alternar para Administrativo zera dados de profissional ao salvar', async () => {
    mocked(usersApi.update).mockResolvedValue(existing);
    renderDialog({ user: existing });
    expect(screen.getByText('Editar usuário')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ex.: Larissa Nunes')).toHaveValue('Carlos Dias');
    expect(screen.getByPlaceholderText('Ex.: Dermatologista')).toHaveValue('Dermatologista');
    expect(screen.getByRole('checkbox', { name: 'Profissional principal' })).toBeChecked();

    await choose(screen.getAllByRole('combobox')[0], 'Administrativo');
    expect(screen.queryByRole('checkbox', { name: 'Profissional principal' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Ativo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar usuário' }));

    await waitFor(() => expect(usersApi.update).toHaveBeenCalledTimes(1));
    expect(usersApi.update).toHaveBeenCalledWith('u1', {
      name: 'Carlos Dias',
      email: 'carlos@clinica.com',
      roleId: 'r2',
      active: false,
      providesAppointments: false,
      isPrimary: false,
      specialty: null,
      specialties: [],
      councilRegister: null,
      calendarColor: null,
      bio: null,
    });
    expect(toast.success).toHaveBeenCalledWith('Usuário atualizado.');
  });

  it('mostra a mensagem da API (limite do plano) e mantém o diálogo aberto', async () => {
    mocked(usersApi.create).mockRejectedValue({
      response: { data: { message: 'Limite de usuários do plano atingido (5/5).' } },
    });
    const { onClose } = renderDialog();
    await userEvent.type(screen.getByPlaceholderText('Ex.: Larissa Nunes'), 'Nova');
    await userEvent.type(screen.getByPlaceholderText('email@clinica.com'), 'nova@clinica.com');
    await choose(screen.getAllByRole('combobox')[1], 'Recepção');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar usuário' }));

    expect(await screen.findByText('Limite de usuários do plano atingido (5/5).')).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith('Limite de usuários do plano atingido (5/5).');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('foto: botão desabilitado ao criar', () => {
    renderDialog({ presetProfessional: true });
    expect(screen.getByRole('button', { name: 'Enviar foto' })).toBeDisabled();
  });

  it('foto ao editar: envia e remove', async () => {
    mocked(usersApi.uploadPhoto).mockResolvedValue({ ...existing, photoUrl: 'https://cdn/nova.png' });
    mocked(usersApi.removePhoto).mockResolvedValue({ ...existing, photoUrl: null });
    renderDialog({ user: existing });
    expect(screen.getByRole('button', { name: 'Trocar foto' })).toBeEnabled();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'foto.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(usersApi.uploadPhoto).toHaveBeenCalledWith('u1', file));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Foto atualizada.'));

    await userEvent.click(screen.getByRole('button', { name: 'Remover foto' }));
    await waitFor(() => expect(usersApi.removePhoto).toHaveBeenCalledWith('u1'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Foto removida.'));
    expect(await screen.findByRole('button', { name: 'Enviar foto' })).toBeInTheDocument();
  });

  it('foto: erros da API viram toast', async () => {
    mocked(usersApi.uploadPhoto).mockRejectedValue({});
    mocked(usersApi.removePhoto).mockRejectedValue({ response: { data: { message: 'Sem acesso' } } });
    renderDialog({ user: existing });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'f.png', { type: 'image/png' })] } });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não foi possível enviar a foto.'));
    await userEvent.click(screen.getByRole('button', { name: 'Remover foto' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Sem acesso'));
  });

  it('cancelar fecha sem salvar; clicar na cor selecionada a desmarca', async () => {
    mocked(usersApi.update).mockResolvedValue(existing);
    const { onClose } = renderDialog({ user: existing });
    await userEvent.click(screen.getByRole('button', { name: '#15998B' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar usuário' }));
    await waitFor(() => expect(usersApi.update).toHaveBeenCalledWith('u1', expect.objectContaining({ calendarColor: null })));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
  });
});
