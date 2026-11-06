import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { rolesApi } from '../../api/roles';
import { usersApi } from '../../api/users';
import type { UserSummary } from '../../types';
import { ProfessionalFormDialog } from './ProfessionalFormDialog';

vi.mock('../../api/users', () => ({
  usersApi: { create: vi.fn(), update: vi.fn(), uploadPhoto: vi.fn(), removePhoto: vi.fn() },
}));
vi.mock('../../api/roles', () => ({ rolesApi: { list: vi.fn() } }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), showToast: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const roles = [
  { id: 'r1', name: 'Administrador', description: 'Acesso total', permissions: ['patients:view', 'patients:create', 'x:unknown'] },
  { id: 'r2', name: 'Profissional', permissions: [] },
];

const existing: UserSummary = {
  id: 'u1',
  name: 'Carlos Dias',
  email: 'carlos@clinica.com',
  active: true,
  providesAppointments: true,
  isPrimary: true,
  roleId: 'r1',
  role: { id: 'r1', name: 'Administrador', isSystem: true },
  createdAt: '2026-01-01T00:00:00Z',
  specialty: 'Biomédico',
  councilRegister: 'CRBM 1',
  calendarColor: '#15998B',
  bio: 'Bio',
  photoUrl: 'https://cdn/f.png',
};

function renderDialog(props: Partial<React.ComponentProps<typeof ProfessionalFormDialog>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <ProfessionalFormDialog open onClose={onClose} {...props} />
    </QueryClientProvider>,
  );
  return { onClose };
}

async function chooseRole(name: string) {
  await userEvent.click(screen.getByRole('combobox', { name: /Grupo/ }));
  await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked(rolesApi.list).mockResolvedValue(roles);
});

describe('ProfessionalFormDialog', () => {
  it('valida campos obrigatórios', async () => {
    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Criar profissional' }));
    expect(await screen.findByText('Nome é obrigatório')).toBeInTheDocument();
    expect(screen.getByText('E-mail é obrigatório')).toBeInTheDocument();
    expect(screen.getByText('Selecione um grupo')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/E-mail/), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Criar profissional' }));
    expect(await screen.findByText('E-mail inválido')).toBeInTheDocument();
    expect(usersApi.create).not.toHaveBeenCalled();
  });

  it('cria profissional e mostra contagem de permissões do grupo', async () => {
    mocked(usersApi.create).mockResolvedValue({ id: 'n' });
    const { onClose } = renderDialog();
    expect(screen.getByText('Novo profissional')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Nome completo/), ' Larissa ');
    await userEvent.type(screen.getByLabelText(/E-mail/), 'l@c.com');
    await chooseRole('Administrador');
    // só permissões do catálogo contam (x:unknown é ignorada)
    expect(await screen.findByText('2 de 76 permissões neste grupo')).toBeInTheDocument();
    expect(screen.getByText('2 de 76')).toBeInTheDocument();
    expect(screen.getByText('Acesso total')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Especialidade'), 'Esteta');
    await userEvent.type(screen.getByLabelText('Registro do conselho'), 'CRBM 9');
    await userEvent.type(screen.getByLabelText('Bio / descrição'), 'Fala de pele');
    await userEvent.click(screen.getByRole('button', { name: '#9B7BD4' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Profissional principal' }));
    await userEvent.click(screen.getByRole('button', { name: 'Criar profissional' }));

    await waitFor(() =>
      expect(usersApi.create).toHaveBeenCalledWith({
        name: 'Larissa',
        email: 'l@c.com',
        roleId: 'r1',
        active: true,
        providesAppointments: true,
        isPrimary: true,
        specialty: 'Esteta',
        councilRegister: 'CRBM 9',
        calendarColor: '#9B7BD4',
        bio: 'Fala de pele',
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith('Profissional criado.');
  });

  it('desligar "Realiza atendimentos" remove o principal; inativar mostra aviso', async () => {
    mocked(usersApi.update).mockResolvedValue(existing);
    renderDialog({ user: existing });
    expect(screen.getByText('Editar profissional')).toBeInTheDocument();
    expect(screen.getByText('Carlos Dias · carlos@clinica.com')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Profissional principal' })).toBeChecked();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Realiza atendimentos' }));
    expect(screen.queryByRole('checkbox', { name: 'Profissional principal' })).not.toBeInTheDocument();
    expect(screen.getByText(/Não aparece na seleção de profissionais/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Usuário ativo' }));
    expect(screen.getByText('Acesso bloqueado até reativar o usuário.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(usersApi.update).toHaveBeenCalledTimes(1));
    expect(usersApi.update).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ active: false, providesAppointments: false, isPrimary: false, specialty: 'Biomédico' }),
    );
    expect(toast.success).toHaveBeenCalledWith('Profissional atualizado.');
  });

  it('erro da API aparece no alerta e em toast', async () => {
    mocked(usersApi.create).mockRejectedValue({ response: { data: { message: 'Limite do plano atingido' } } });
    renderDialog();
    await userEvent.type(screen.getByLabelText(/Nome completo/), 'Ana');
    await userEvent.type(screen.getByLabelText(/E-mail/), 'a@c.com');
    await chooseRole('Profissional');
    await userEvent.click(screen.getByRole('button', { name: 'Criar profissional' }));
    expect(await screen.findAllByText('Limite do plano atingido')).not.toHaveLength(0);
    expect(toast.error).toHaveBeenCalledWith('Limite do plano atingido');
  });

  it('foto: bloqueada ao criar; envia e remove ao editar, com toasts de erro', async () => {
    mocked(usersApi.uploadPhoto).mockResolvedValueOnce({ ...existing, photoUrl: 'https://cdn/n.png' }).mockRejectedValueOnce({});
    mocked(usersApi.removePhoto).mockResolvedValueOnce({}).mockRejectedValueOnce({});
    renderDialog({ user: existing });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'f.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Foto atualizada.'));
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não foi possível enviar a foto.'));

    await userEvent.click(screen.getByRole('button', { name: 'Remover' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Foto removida.'));
    expect(await screen.findByRole('button', { name: 'Enviar foto' })).toBeInTheDocument();
  });

  it('foto removida com erro mostra toast; criar tem foto desabilitada', async () => {
    mocked(usersApi.removePhoto).mockRejectedValue({});
    renderDialog({ user: existing });
    await userEvent.click(screen.getByRole('button', { name: 'Remover' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não foi possível remover a foto.'));
  });

  it('criar: botão de foto desabilitado e cancelar fecha', async () => {
    const { onClose } = renderDialog();
    expect(screen.getByRole('button', { name: 'Enviar foto' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
  });
});
