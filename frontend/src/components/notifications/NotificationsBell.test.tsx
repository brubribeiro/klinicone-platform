import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Notification } from '../../types';
import { NotificationsBell } from './NotificationsBell';

vi.setConfig({ testTimeout: 30_000 });

const api = vi.hoisted(() => ({
  unreadCount: vi.fn(),
  list: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  getPreferences: vi.fn(),
  setPreference: vi.fn(),
}));
vi.mock('../../api/notifications', () => ({ notificationsApi: api }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));

const NOW = new Date('2026-03-10T15:00:00.000Z');
const mk = (o: Partial<Notification>): Notification => ({
  id: 'n1',
  userId: 'u1',
  type: 'APPOINTMENT_CREATED',
  title: 'Novo agendamento',
  message: 'Maria às 10h',
  read: false,
  createdAt: '2026-03-10T14:00:00.000Z',
  ...o,
});

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}
function renderBell() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Routes>
          <Route path="*" element={<><NotificationsBell /><Where /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  api.unreadCount.mockResolvedValue(2);
  api.list.mockResolvedValue([]);
  api.markAsRead.mockResolvedValue(undefined);
  api.markAllAsRead.mockResolvedValue(undefined);
  api.getPreferences.mockResolvedValue([]);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('NotificationsBell', () => {
  it('mostra a contagem de não lidas no rótulo', async () => {
    renderBell();
    expect(await screen.findByRole('button', { name: 'Notificações, 2 não lidas' })).toBeInTheDocument();
  });

  it('sem não lidas usa o rótulo simples', async () => {
    api.unreadCount.mockResolvedValue(0);
    renderBell();
    expect(await screen.findByRole('button', { name: 'Notificações' })).toBeInTheDocument();
  });

  it('abre e mostra estado vazio', async () => {
    renderBell();
    await userEvent.click(await screen.findByRole('button', { name: /Notificações/ }));
    expect(await screen.findByText('Você não tem notificações')).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledWith({ limit: 10 });
    expect(screen.getByText('2 novas')).toBeInTheDocument();
  });

  it('lista notificações com tempo relativo e navega ao clicar, marcando como lida', async () => {
    api.list.mockResolvedValue([
      mk({ id: 'n1', link: '/agenda', message: 'Maria às 10h' }),
      mk({ id: 'n2', title: 'Já lida', message: 'outra', read: true, createdAt: '2026-03-09T15:00:00.000Z' }),
      mk({ id: 'n3', title: 'Aviso', type: 'PLATFORM_ANNOUNCEMENT', message: 'a\nb', read: true }),
    ]);
    api.unreadCount.mockResolvedValue(1);
    renderBell();
    await userEvent.click(await screen.findByRole('button', { name: /Notificações/ }));
    expect(await screen.findByText('Já lida')).toBeInTheDocument();
    expect(screen.getByText('1 nova')).toBeInTheDocument();
    expect(screen.getAllByText('há uma hora')).toHaveLength(2);
    expect(screen.getByText('há um dia')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Maria às 10h'));
    await waitFor(() => expect(api.markAsRead).toHaveBeenCalledWith('n1'));
    expect(screen.getByTestId('where')).toHaveTextContent('/agenda');
  });

  it('notificação lida sem link não marca nem navega', async () => {
    api.list.mockResolvedValue([mk({ id: 'n2', title: 'Já lida', read: true })]);
    renderBell();
    await userEvent.click(await screen.findByRole('button', { name: /Notificações/ }));
    await userEvent.click(await screen.findByText('Já lida'));
    expect(api.markAsRead).not.toHaveBeenCalled();
    expect(screen.getByTestId('where')).toHaveTextContent('/');
  });

  it('marca todas como lidas e confirma com toast', async () => {
    renderBell();
    await userEvent.click(await screen.findByRole('button', { name: /Notificações/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar lidas' }));
    await waitFor(() => expect(api.markAllAsRead).toHaveBeenCalled());
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Todas as notificações foram marcadas como lidas'));
  });

  it('avisa quando marcar todas falha', async () => {
    api.markAllAsRead.mockRejectedValue(new Error('x'));
    renderBell();
    await userEvent.click(await screen.findByRole('button', { name: /Notificações/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar lidas' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Erro ao marcar notificações como lidas'));
  });

  it('desabilita "Marcar lidas" sem não lidas', async () => {
    api.unreadCount.mockResolvedValue(0);
    renderBell();
    await userEvent.click(await screen.findByRole('button', { name: 'Notificações' }));
    expect(await screen.findByRole('button', { name: 'Marcar lidas' })).toBeDisabled();
  });

  it('abre as preferências de notificação', async () => {
    renderBell();
    await userEvent.click(await screen.findByRole('button', { name: /Notificações/ }));
    await userEvent.click(await screen.findByText('Preferências de notificação'));
    expect(await screen.findByText('Tipos de alerta')).toBeInTheDocument();
    expect(api.getPreferences).toHaveBeenCalled();
  });
});
