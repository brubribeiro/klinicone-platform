import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { appointmentsApi } from '../../api/appointments';
import type { Appointment } from '../../types';
import { SessionTimerCard, SessionTimerCompact } from './SessionTimerCard';
import { useSessionTimer } from './useSessionTimer';

vi.mock('../../api/appointments', () => ({
  appointmentsApi: { start: vi.fn(), finish: vi.fn(), resume: vi.fn() },
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;
const NOW = new Date('2030-01-15T13:00:00.000Z');

const base = { id: 'a1', status: 'SCHEDULED' } as Appointment;

function Harness({
  appointment,
  detail,
  open = true,
  compact = false,
  onStarted = () => {},
  onFinish = () => {},
  finishDisabled = false,
}: {
  appointment?: Appointment | null;
  detail?: Appointment;
  open?: boolean;
  compact?: boolean;
  onStarted?: () => void;
  onFinish?: () => void;
  finishDisabled?: boolean;
}) {
  const timer = useSessionTimer({ open, appointment, appointmentDetail: detail, onStarted });
  const Card = compact ? SessionTimerCompact : SessionTimerCard;
  return <Card timer={timer} finishDisabled={finishDisabled} onFinish={onFinish} />;
}

function renderIt(props: Parameters<typeof Harness>[0]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Harness {...props} />
    </QueryClientProvider>,
  );
}

const user = () => userEvent.setup();
const TICK = { timeout: 3000 };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('cronômetro da sessão', () => {
  it('agendamento ainda não iniciado: zerado, Iniciar visível e Finalizar desabilitado', () => {
    renderIt({ appointment: base });
    expect(screen.getByText('00:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Finalizar' })).toBeDisabled();
  });

  it('iniciar chama a API, avisa o formulário, mostra toast e o tempo corre a cada segundo', async () => {
    const onStarted = vi.fn();
    mocked(appointmentsApi.start).mockResolvedValue({ ...base, status: 'IN_PROGRESS', startedAt: NOW.toISOString() });
    renderIt({ appointment: base, onStarted });
    await user().click(screen.getByRole('button', { name: 'Iniciar' }));
    await waitFor(() => expect(onStarted).toHaveBeenCalled());
    expect(appointmentsApi.start).toHaveBeenCalledWith('a1');
    expect(toast.success).toHaveBeenCalledWith('Atendimento iniciado.');
    vi.setSystemTime(new Date(NOW.getTime() + 65_000));
    expect(await screen.findByText('01:05', {}, TICK)).toBeInTheDocument();
  });

  it('falha ao iniciar mostra o erro da API e não avisa o formulário', async () => {
    const onStarted = vi.fn();
    mocked(appointmentsApi.start).mockRejectedValue({ response: { data: { message: 'Já iniciado' } } });
    renderIt({ appointment: base, onStarted });
    await user().click(screen.getByRole('button', { name: 'Iniciar' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Já iniciado'));
    expect(onStarted).not.toHaveBeenCalled();
  });

  it('em andamento: mostra o tempo desde o início, Pausar finaliza o trecho e Finalizar dispara onFinish', async () => {
    const onFinish = vi.fn();
    const running = {
      ...base,
      status: 'IN_PROGRESS',
      startedAt: new Date(NOW.getTime() - 3_725_000).toISOString(),
    } as Appointment;
    mocked(appointmentsApi.finish).mockResolvedValue({ ...running, finishedAt: NOW.toISOString() });
    renderIt({ appointment: running, onFinish });
    expect(screen.getByText('1:02:05')).toBeInTheDocument();
    await user().click(screen.getByRole('button', { name: 'Pausar' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Atendimento pausado.'));
    expect(appointmentsApi.finish).toHaveBeenCalledWith('a1');
    await user().click(screen.getByRole('button', { name: 'Finalizar' }));
    expect(onFinish).toHaveBeenCalled();
  });

  it('erro ao pausar mostra mensagem padrão', async () => {
    const running = { ...base, status: 'IN_PROGRESS', startedAt: NOW.toISOString() } as Appointment;
    mocked(appointmentsApi.finish).mockRejectedValue({});
    renderIt({ appointment: running });
    await user().click(screen.getByRole('button', { name: 'Pausar' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não foi possível pausar o atendimento.'));
  });

  it('pausado (iniciado e finalizado, ainda em andamento): mostra a duração parada e Retomar reinicia a contagem', async () => {
    const paused = {
      ...base,
      status: 'IN_PROGRESS',
      startedAt: new Date(NOW.getTime() - 600_000).toISOString(),
      finishedAt: new Date(NOW.getTime() - 300_000).toISOString(),
    } as Appointment;
    mocked(appointmentsApi.resume).mockResolvedValue({ ...paused, finishedAt: null, startedAt: NOW.toISOString() });
    renderIt({ appointment: paused, finishDisabled: true });
    expect(screen.getByText('05:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finalizar' })).toBeDisabled();
    await user().click(screen.getByRole('button', { name: 'Retomar' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Atendimento retomado.'));
    vi.setSystemTime(new Date(NOW.getTime() + 3_000));
    expect(await screen.findByText('00:03', {}, TICK)).toBeInTheDocument();
  });

  it('erro ao retomar mostra mensagem padrão', async () => {
    const paused = {
      ...base,
      status: 'IN_PROGRESS',
      startedAt: new Date(NOW.getTime() - 600_000).toISOString(),
      finishedAt: new Date(NOW.getTime() - 300_000).toISOString(),
    } as Appointment;
    mocked(appointmentsApi.resume).mockRejectedValue({});
    renderIt({ appointment: paused });
    await user().click(screen.getByRole('button', { name: 'Retomar' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não foi possível retomar o atendimento.'));
  });

  it('sem agendamento ou concluído, não há controles', () => {
    const { unmount } = renderIt({ appointment: null });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    unmount();
    renderIt({ appointment: { ...base, status: 'COMPLETED' } as Appointment });
    expect(screen.queryByRole('button', { name: 'Iniciar' })).not.toBeInTheDocument();
  });

  it('prefere o detalhe carregado ao item da lista', () => {
    const detail = { ...base, status: 'IN_PROGRESS', startedAt: new Date(NOW.getTime() - 61_000).toISOString() } as Appointment;
    renderIt({ appointment: base, detail });
    expect(screen.getByText('01:01')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pausar' })).toBeInTheDocument();
  });

  it('dialog fechado não roda o relógio', async () => {
    const running = { ...base, status: 'IN_PROGRESS', startedAt: NOW.toISOString() } as Appointment;
    renderIt({ appointment: running, open: false });
    vi.setSystemTime(new Date(NOW.getTime() + 5_000));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1200));
    });
    expect(screen.getByText('00:00')).toBeInTheDocument();
  });
});

describe('cronômetro compacto (celular)', () => {
  it('iniciar, pausar e retomar seguem o mesmo fluxo', async () => {
    mocked(appointmentsApi.start).mockResolvedValue({ ...base, status: 'IN_PROGRESS', startedAt: NOW.toISOString() });
    const { unmount } = renderIt({ appointment: base, compact: true });
    expect(screen.queryByText('00:00')).not.toBeInTheDocument();
    await user().click(screen.getByRole('button', { name: 'Iniciar' }));
    await waitFor(() => expect(appointmentsApi.start).toHaveBeenCalledWith('a1'));
    unmount();

    const running = { ...base, status: 'IN_PROGRESS', startedAt: new Date(NOW.getTime() - 90_000).toISOString() } as Appointment;
    const { unmount: u2 } = renderIt({ appointment: running, compact: true });
    expect(screen.getByText('01:30')).toBeInTheDocument();
    mocked(appointmentsApi.finish).mockResolvedValue(running);
    await user().click(screen.getByRole('button', { name: 'Pausar' }));
    await waitFor(() => expect(appointmentsApi.finish).toHaveBeenCalledWith('a1'));
    u2();

    const paused = { ...running, finishedAt: NOW.toISOString() } as Appointment;
    const onFinish = vi.fn();
    renderIt({ appointment: paused, compact: true, onFinish });
    mocked(appointmentsApi.resume).mockResolvedValue(running);
    await user().click(screen.getByRole('button', { name: 'Retomar' }));
    await waitFor(() => expect(appointmentsApi.resume).toHaveBeenCalledWith('a1'));
    await user().click(screen.getByRole('button', { name: 'Finalizar' }));
    expect(onFinish).toHaveBeenCalled();
  });
});

describe('stopTimerIfRunning', () => {
  it('finaliza o trecho aberto antes de concluir, e não chama a API se já está pausado', async () => {
    let stop: () => Promise<void> = async () => {};
    function Probe({ appt }: { appt: Appointment }) {
      stop = useSessionTimer({ open: true, appointment: appt, onStarted: () => {} }).stopTimerIfRunning;
      return null;
    }
    const client = new QueryClient();
    mocked(appointmentsApi.finish).mockResolvedValue({});
    const wrap = (appt: Appointment) => (
      <QueryClientProvider client={client}>
        <Probe appt={appt} />
      </QueryClientProvider>
    );
    const { rerender } = render(wrap({ ...base, status: 'IN_PROGRESS', startedAt: NOW.toISOString() } as Appointment));
    await act(async () => {
      await stop();
    });
    expect(appointmentsApi.finish).toHaveBeenCalledTimes(1);
    rerender(wrap({ ...base, status: 'IN_PROGRESS', startedAt: NOW.toISOString(), finishedAt: NOW.toISOString() } as Appointment));
    await act(async () => {
      await stop();
    });
    expect(appointmentsApi.finish).toHaveBeenCalledTimes(1);
  });
});
