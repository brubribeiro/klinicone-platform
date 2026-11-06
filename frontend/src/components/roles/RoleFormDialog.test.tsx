import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { rolesApi } from '../../api/roles';
import type { Role } from '../../types';
import { RoleFormDialog } from './RoleFormDialog';

vi.mock('../../api/roles', () => ({ rolesApi: { create: vi.fn(), update: vi.fn() } }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), showToast: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const roles: Role[] = [
  { id: 'r1', name: 'Administrador', permissions: ['patients:view', 'finance:view'], isSystem: true, restrictToOwnAppointments: false, color: '#15998B' },
  { id: 'r2', name: 'Profissional', description: 'Atende', permissions: ['appointments:view'], isSystem: false, restrictToOwnAppointments: true, color: '#5BA8DE' },
];

function renderDialog(props: Partial<React.ComponentProps<typeof RoleFormDialog>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <RoleFormDialog open onClose={onClose} onSaved={onSaved} roles={roles} {...props} />
    </QueryClientProvider>,
  );
  return { onClose, onSaved, invalidate };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RoleFormDialog', () => {
  it('exige nome', async () => {
    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Criar grupo' }));
    expect(await screen.findByText('Nome é obrigatório')).toBeInTheDocument();
    expect(rolesApi.create).not.toHaveBeenCalled();
  });

  it('cria grupo começando do zero com a primeira cor livre', async () => {
    const saved = { ...roles[0], id: 'new', name: 'Coordenação' };
    mocked(rolesApi.create).mockResolvedValue(saved);
    const { onClose, onSaved, invalidate } = renderDialog();
    expect(screen.getByRole('radio', { name: '#9B7BD4' })).toHaveAttribute('aria-checked', 'true');

    await userEvent.type(screen.getByPlaceholderText('Ex.: Coordenação'), '  Coordenação ');
    await userEvent.type(screen.getByPlaceholderText('O que esse papel pode fazer'), '  ');
    await userEvent.click(screen.getByRole('radio', { name: '#D46B8A' }));
    await userEvent.click(screen.getByRole('button', { name: 'Criar grupo' }));

    await waitFor(() =>
      expect(rolesApi.create).toHaveBeenCalledWith({
        name: 'Coordenação',
        description: undefined,
        color: '#D46B8A',
        restrictToOwnAppointments: false,
        permissions: [],
      }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(onClose).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Grupo criado.');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['roles'] });
  });

  it('copia permissões e a restrição de agenda do grupo escolhido', async () => {
    mocked(rolesApi.create).mockResolvedValue(roles[1]);
    renderDialog();
    await userEvent.type(screen.getByPlaceholderText('Ex.: Coordenação'), 'Assistente');
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'Profissional' }));
    expect(screen.getByRole('checkbox', { name: /Restringir à própria agenda/ })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Criar grupo' }));
    await waitFor(() =>
      expect(rolesApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Assistente', permissions: ['appointments:view'], restrictToOwnAppointments: true }),
      ),
    );
  });

  it('mostra erro da API e não fecha', async () => {
    mocked(rolesApi.create).mockRejectedValue({ response: { data: { message: 'Já existe um grupo com esse nome' } } });
    const { onClose } = renderDialog();
    await userEvent.type(screen.getByPlaceholderText('Ex.: Coordenação'), 'Profissional');
    await userEvent.click(screen.getByRole('button', { name: 'Criar grupo' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Já existe um grupo com esse nome'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('edita grupo: envia só os dados básicos, sem permissões', async () => {
    mocked(rolesApi.update).mockResolvedValue(roles[1]);
    const { onClose } = renderDialog({ role: roles[1] });
    expect(screen.getByText('Editar grupo de permissões')).toBeInTheDocument();
    expect(screen.queryByText('Copiar permissões de')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ex.: Coordenação')).toHaveValue('Profissional');
    expect(screen.getByPlaceholderText('O que esse papel pode fazer')).toHaveValue('Atende');

    await userEvent.click(screen.getByRole('checkbox', { name: /Restringir à própria agenda/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(rolesApi.update).toHaveBeenCalledWith('r2', {
        name: 'Profissional',
        description: 'Atende',
        color: '#5BA8DE',
        restrictToOwnAppointments: false,
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith('Grupo atualizado.');
  });

  it('grupo Administrador: nome travado e restrição de agenda desabilitada', () => {
    renderDialog({ role: roles[0] });
    expect(screen.getByPlaceholderText('Ex.: Coordenação')).toBeDisabled();
    expect(screen.getByText('Grupos do sistema não podem ser renomeados')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Restringir à própria agenda/ })).toBeDisabled();
  });
});
