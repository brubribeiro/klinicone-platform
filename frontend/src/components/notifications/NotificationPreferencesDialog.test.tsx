import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NOTIFICATION_TYPES } from '../../contexts/notificationsLabels';
import { NotificationPreferencesDialog } from './NotificationPreferencesDialog';

vi.setConfig({ testTimeout: 30_000 });

const api = vi.hoisted(() => ({ getPreferences: vi.fn(), setPreference: vi.fn() }));
vi.mock('../../api/notifications', () => ({ notificationsApi: api }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));

function renderDialog(props: Partial<{ open: boolean; onClose: () => void }> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = props.onClose ?? vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <NotificationPreferencesDialog open={props.open ?? true} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose, qc };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getPreferences.mockResolvedValue([{ type: 'INVENTORY_LOW_STOCK', enabled: false }]);
  api.setPreference.mockResolvedValue(undefined);
});

describe('NotificationPreferencesDialog', () => {
  it('não busca preferências enquanto fechado', () => {
    renderDialog({ open: false });
    expect(api.getPreferences).not.toHaveBeenCalled();
  });

  it('lista todos os tipos; ausentes contam como ativados', async () => {
    renderDialog();
    const switches = await screen.findAllByRole('checkbox');
    expect(switches).toHaveLength(NOTIFICATION_TYPES.length);
    const byLabel = (label: string) =>
      screen.getByText(label).parentElement!.parentElement!.querySelector('input[type=checkbox]') as HTMLInputElement;
    expect(byLabel('Estoque baixo').checked).toBe(false);
    expect(byLabel('Novo agendamento').checked).toBe(true);
  });

  it('alterna uma preferência com atualização otimista e envia o payload', async () => {
    renderDialog();
    await screen.findByText('Estoque baixo');
    const input = screen.getByText('Novo agendamento').parentElement!.parentElement!.querySelector('input') as HTMLInputElement;
    await userEvent.click(input);
    expect(api.setPreference).toHaveBeenCalledWith('APPOINTMENT_CREATED', false);
    await waitFor(() => expect(input.checked).toBe(false));
  });

  it('reverte e avisa quando salvar falha', async () => {
    api.setPreference.mockRejectedValue({ response: { data: { message: 'Sem permissão' } } });
    renderDialog();
    await screen.findByText('Estoque baixo');
    const input = screen.getByText('Estoque baixo').parentElement!.parentElement!.querySelector('input') as HTMLInputElement;
    await userEvent.click(input);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    await waitFor(() => expect(input.checked).toBe(false));
  });

  it('fecha pelo X e por Concluído', async () => {
    const { onClose } = renderDialog();
    await screen.findByText('Estoque baixo');
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Concluído' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
