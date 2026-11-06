import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { availabilityApi } from '../api/availability';
import { usersApi } from '../api/users';
import { Availability } from './Availability';

vi.mock('../api/availability', () => ({
  availabilityApi: {
    listWorkingHours: vi.fn(),
    upsertWorkingHours: vi.fn(),
    removeWorkingHours: vi.fn(),
    listUnavailability: vi.fn(),
    createUnavailability: vi.fn(),
    removeUnavailability: vi.fn(),
  },
}));
vi.mock('../api/users', () => ({ usersApi: { listAppointmentProviders: vi.fn() } }));

const auth = vi.hoisted(() => ({ user: null as unknown }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), showToast: vi.fn() }));
vi.mock('../contexts/AppToastContext', () => ({ useAppToast: () => toast }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const ana = { id: 'u1', name: 'Ana Souza' };
const bruno = { id: 'u2', name: 'Dr. Bruno Costa' };

const wh = (userId: string, dayOfWeek: number, startTime: string, endTime: string) => ({
  id: `${userId}-${dayOfWeek}`,
  userId,
  dayOfWeek,
  startTime,
  endTime,
});

const hoursByUser: Record<string, ReturnType<typeof wh>[]> = {
  u1: [1, 2, 3, 4, 5].map((d) => wh('u1', d, '08:00', '18:00')),
  u2: [wh('u2', 1, '09:00', '12:00'), wh('u2', 3, '14:00', '18:00')],
};

const unavailByUser: Record<string, unknown[]> = {
  u1: [
    {
      id: 'b1',
      userId: 'u1',
      startAt: dayjs('2026-11-10').startOf('day').toISOString(),
      endAt: dayjs('2026-11-12').endOf('day').toISOString(),
      reason: 'Férias',
    },
  ],
  u2: [
    {
      id: 'b2',
      userId: 'u2',
      startAt: dayjs('2026-11-06T12:00').toISOString(),
      endAt: dayjs('2026-11-06T14:00').toISOString(),
    },
  ],
};

function setUser(permissions: string[]) {
  auth.user = { ...ana, permissions };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <Availability />
    </QueryClientProvider>,
  );
  return { invalidate };
}

async function openEditor(name: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: `Editar horários de ${name}` }));
  const dialog = await screen.findByRole('dialog');
  await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Salvar horário semanal' })).toBeEnabled());
  return { user, dialog };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 4, 10, 0, 0)); // quarta, 04/11/2026
  vi.clearAllMocks();
  setUser(['availability:edit']);
  mocked(usersApi.listAppointmentProviders).mockResolvedValue([ana, bruno]);
  mocked(availabilityApi.listWorkingHours).mockImplementation(async (id: string) => hoursByUser[id] ?? []);
  mocked(availabilityApi.listUnavailability).mockImplementation(async (id: string) => unavailByUser[id] ?? []);
  mocked(availabilityApi.upsertWorkingHours).mockResolvedValue({});
  mocked(availabilityApi.removeWorkingHours).mockResolvedValue(undefined);
  mocked(availabilityApi.createUnavailability).mockResolvedValue({});
  mocked(availabilityApi.removeUnavailability).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Availability page', () => {
  it('mostra a equipe com dias, faixa e carga semanal de cada profissional', async () => {
    renderPage();
    expect(await screen.findByText('Disponibilidade da equipe')).toBeInTheDocument();
    expect(await screen.findByText('Seg – Sex')).toBeInTheDocument();
    expect(screen.getByText('08:00 – 18:00')).toBeInTheDocument();
    expect(screen.getByText('50h por semana')).toBeInTheDocument();
    // Bruno: dias salteados, horários diferentes
    expect(screen.getByText('Seg, Qua')).toBeInTheDocument();
    expect(screen.getByText('09:00 – 18:00')).toBeInTheDocument();
    expect(screen.getByText('varia por dia')).toBeInTheDocument();
    expect(screen.getByText('AS')).toBeInTheDocument();
    expect(screen.getByText('BC')).toBeInTheDocument();
  });

  it('lista os bloqueios em ordem cronológica com o tipo de período', async () => {
    renderPage();
    expect(await screen.findByText('Férias')).toBeInTheDocument();
    expect(screen.getByText(/Ana Souza · 10 – 12 nov/)).toBeInTheDocument();
    expect(screen.getByText('Sem motivo informado')).toBeInTheDocument();
    expect(screen.getByText(/Dr\. Bruno Costa · 6 nov · 12:00 – 14:00/)).toBeInTheDocument();
    expect(screen.getByText('Dia inteiro')).toBeInTheDocument();
    expect(screen.getByText('Por horário')).toBeInTheDocument();
    const reasons = screen.getAllByText(/Sem motivo informado|Férias/).map((e) => e.textContent);
    expect(reasons).toEqual(['Sem motivo informado', 'Férias']); // 6/11 antes de 10/11
  });

  it('mostra estado vazio quando não há bloqueios', async () => {
    mocked(availabilityApi.listUnavailability).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('Nenhum bloqueio cadastrado')).toBeInTheDocument();
  });

  it('sem permissão de editar a equipe só mostra a própria agenda', async () => {
    setUser([]);
    renderPage();
    expect(await screen.findByText('Minha disponibilidade')).toBeInTheDocument();
    expect(usersApi.listAppointmentProviders).not.toHaveBeenCalled();
    expect(screen.getAllByRole('button', { name: /Editar horários de/ })).toHaveLength(1);
    expect(screen.queryByText('Dr. Bruno Costa')).not.toBeInTheDocument();
    await waitFor(() => expect(availabilityApi.listWorkingHours).toHaveBeenCalledWith('u1'));
    expect(availabilityApi.listWorkingHours).not.toHaveBeenCalledWith('u2');
  });

  describe('horário semanal', () => {
    it('salva só os dias alterados (upsert dos novos/mudados, remove os desligados)', async () => {
      renderPage();
      const { user, dialog } = await openEditor('Dr. Bruno Costa');
      expect(within(dialog).getByText('Expediente de Dr. Bruno Costa')).toBeInTheDocument();
      expect(within(dialog).getByText('2 dias com atendimento', { exact: false })).toBeInTheDocument();

      // liga terça (novo), muda fim de quarta e desliga segunda
      await user.click(within(dialog).getByRole('checkbox', { name: 'Atende terça' }));
      fireEvent.change(within(dialog).getByLabelText('Quarta até'), { target: { value: '17:30' } });
      await user.click(within(dialog).getByRole('checkbox', { name: 'Atende segunda' }));
      expect(within(dialog).getByText('2 dias com atendimento', { exact: false })).toBeInTheDocument();
      expect(within(dialog).getByText('3h30 de atendimento')).toBeInTheDocument();

      await user.click(within(dialog).getByRole('button', { name: 'Salvar horário semanal' }));

      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Horários salvos.'));
      expect(availabilityApi.upsertWorkingHours).toHaveBeenCalledTimes(2);
      expect(availabilityApi.upsertWorkingHours).toHaveBeenCalledWith('u2', { dayOfWeek: 2, startTime: '08:00', endTime: '18:00' });
      expect(availabilityApi.upsertWorkingHours).toHaveBeenCalledWith('u2', { dayOfWeek: 3, startTime: '14:00', endTime: '17:30' });
      expect(availabilityApi.removeWorkingHours).toHaveBeenCalledTimes(1);
      expect(availabilityApi.removeWorkingHours).toHaveBeenCalledWith('u2', 1);
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('não envia nada quando nada mudou', async () => {
      renderPage();
      const { user, dialog } = await openEditor('Ana Souza');
      await user.click(within(dialog).getByRole('button', { name: 'Salvar horário semanal' }));
      await waitFor(() => expect(toast.success).toHaveBeenCalled());
      expect(availabilityApi.upsertWorkingHours).not.toHaveBeenCalled();
      expect(availabilityApi.removeWorkingHours).not.toHaveBeenCalled();
    });

    it('atalhos aplicam a semana e destacam o atalho que corresponde à grade', async () => {
      renderPage();
      const { user, dialog } = await openEditor('Ana Souza');
      expect(within(dialog).getByRole('button', { name: 'Seg–Sex' })).toHaveAttribute('aria-pressed', 'true');

      await user.click(within(dialog).getByRole('button', { name: 'Seg–Sáb' }));
      expect(within(dialog).getByRole('button', { name: 'Seg–Sáb' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(dialog).getByText('6 dias com atendimento', { exact: false })).toBeInTheDocument();

      await user.click(within(dialog).getByRole('button', { name: 'Nenhum dia' }));
      expect(within(dialog).getByText('0 dias com atendimento', { exact: false })).toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: 'Salvar horário semanal' }));
      await waitFor(() => expect(availabilityApi.removeWorkingHours).toHaveBeenCalledTimes(5));
      for (const d of [1, 2, 3, 4, 5]) expect(availabilityApi.removeWorkingHours).toHaveBeenCalledWith('u1', d);
    });

    it('bloqueia o salvamento quando o início não é anterior ao término', async () => {
      renderPage();
      const { dialog } = await openEditor('Ana Souza');
      fireEvent.change(within(dialog).getByLabelText('Segunda das'), { target: { value: '19:00' } });
      expect(within(dialog).getByText('Início deve ser antes do término')).toBeInTheDocument();
      expect(within(dialog).getByText(/início deve ser anterior ao de término/i)).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Salvar horário semanal' })).toBeDisabled();
      expect(availabilityApi.upsertWorkingHours).not.toHaveBeenCalled();
    });

    it('mostra a mensagem da API quando o salvamento falha e mantém o diálogo aberto', async () => {
      mocked(availabilityApi.upsertWorkingHours).mockRejectedValue({
        response: { data: { message: 'Horário conflita com agendamentos' } },
      });
      renderPage();
      const { user, dialog } = await openEditor('Ana Souza');
      fireEvent.change(within(dialog).getByLabelText('Segunda até'), { target: { value: '16:00' } });
      await user.click(within(dialog).getByRole('button', { name: 'Salvar horário semanal' }));
      expect(await within(dialog).findByText('Horário conflita com agendamentos')).toBeInTheDocument();
      expect(toast.error).toHaveBeenCalledWith('Horário conflita com agendamentos');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('Cancelar fecha sem salvar', async () => {
      renderPage();
      const { user, dialog } = await openEditor('Ana Souza');
      await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(availabilityApi.upsertWorkingHours).not.toHaveBeenCalled();
    });
  });

  describe('bloqueios de agenda', () => {
    async function openBlockDialog() {
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: 'Bloquear' }));
      const dialog = await screen.findByRole('dialog');
      return { user, dialog };
    }

    it('cria bloqueio por horário com o motivo escolhido nos atalhos', async () => {
      renderPage();
      const { user, dialog } = await openBlockDialog();
      expect(within(dialog).getByText('Novo bloqueio')).toBeInTheDocument();
      expect(within(dialog).getByText('Será bloqueado:', { exact: false })).toBeInTheDocument();

      await user.click(within(dialog).getByRole('button', { name: 'Consulta médica' }));
      expect(within(dialog).getByLabelText('Motivo')).toHaveValue('Consulta médica');
      await user.click(within(dialog).getByRole('button', { name: 'Manhã (hoje)' }));
      expect(within(dialog).getByLabelText('Início')).toHaveValue('2026-11-04T08:00');
      expect(within(dialog).getByLabelText('Fim')).toHaveValue('2026-11-04T12:00');

      await user.click(within(dialog).getByRole('button', { name: 'Criar bloqueio' }));
      await waitFor(() => expect(availabilityApi.createUnavailability).toHaveBeenCalledTimes(1));
      expect(availabilityApi.createUnavailability).toHaveBeenCalledWith('u1', {
        startAt: new Date('2026-11-04T08:00').toISOString(),
        endAt: new Date('2026-11-04T12:00').toISOString(),
        reason: 'Consulta médica',
      });
      expect(toast.success).toHaveBeenCalledWith('Indisponibilidade registrada.');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('cria bloqueio de dias inteiros para outro profissional, sem motivo', async () => {
      renderPage();
      const { user, dialog } = await openBlockDialog();

      await user.click(within(dialog).getByRole('combobox', { name: 'Profissional' }));
      await user.click(await screen.findByRole('option', { name: 'Dr. Bruno Costa' }));
      expect(within(dialog).getByText('Bloqueio na agenda de Dr. Bruno Costa')).toBeInTheDocument();

      await user.click(within(dialog).getByRole('button', { name: 'Dia(s) inteiro(s)' }));
      await user.click(within(dialog).getByRole('button', { name: 'Amanhã' }));
      expect(within(dialog).getByLabelText('Início')).toHaveValue('2026-11-05');
      expect(within(dialog).getByText('05/11/2026 · dia inteiro')).toBeInTheDocument();

      fireEvent.change(within(dialog).getByLabelText('Fim'), { target: { value: '2026-11-07' } });
      expect(within(dialog).getByText('05/11/2026 → 07/11/2026 · dias inteiros')).toBeInTheDocument();

      await user.click(within(dialog).getByRole('button', { name: 'Criar bloqueio' }));
      await waitFor(() => expect(availabilityApi.createUnavailability).toHaveBeenCalledTimes(1));
      expect(availabilityApi.createUnavailability).toHaveBeenCalledWith('u2', {
        startAt: dayjs('2026-11-05').startOf('day').toISOString(),
        endAt: dayjs('2026-11-07').endOf('day').toISOString(),
        reason: undefined,
      });
    });

    it('valida o período: término deve ser posterior ao início e data final não pode ser anterior', async () => {
      renderPage();
      const { user, dialog } = await openBlockDialog();
      const save = within(dialog).getByRole('button', { name: 'Criar bloqueio' });

      fireEvent.change(within(dialog).getByLabelText('Fim'), { target: { value: '2026-11-04T09:00' } });
      expect(within(dialog).getByText('O término deve ser posterior ao início')).toBeInTheDocument();
      expect(save).toBeDisabled();

      // mudar o início para depois do fim empurra o fim para +1h
      fireEvent.change(within(dialog).getByLabelText('Início'), { target: { value: '2026-11-04T15:00' } });
      expect(within(dialog).getByLabelText('Fim')).toHaveValue('2026-11-04T16:00');
      expect(save).toBeEnabled();

      await user.click(within(dialog).getByRole('button', { name: 'Dia(s) inteiro(s)' }));
      expect(within(dialog).getByLabelText('Início')).toHaveValue('2026-11-04');
      fireEvent.change(within(dialog).getByLabelText('Fim'), { target: { value: '2026-11-01' } });
      expect(within(dialog).getByText('A data final deve ser igual ou posterior à inicial')).toBeInTheDocument();
      expect(save).toBeDisabled();

      // voltar ao modo por horário preserva as horas e mantém o fim depois do início
      fireEvent.change(within(dialog).getByLabelText('Fim'), { target: { value: '2026-11-04' } });
      await user.click(within(dialog).getByRole('button', { name: 'Horário específico' }));
      expect(within(dialog).getByLabelText('Início')).toHaveValue('2026-11-04T15:00');
      expect(within(dialog).getByLabelText('Fim')).toHaveValue('2026-11-04T16:00');
      expect(availabilityApi.createUnavailability).not.toHaveBeenCalled();
    });

    it('atalho Seg–Sex (próx.) usa a próxima segunda até a sexta seguinte', async () => {
      renderPage();
      const { user, dialog } = await openBlockDialog();
      await user.click(within(dialog).getByRole('button', { name: 'Dia(s) inteiro(s)' }));
      await user.click(within(dialog).getByRole('button', { name: 'Seg–Sex (próx.)' }));
      expect(within(dialog).getByLabelText('Início')).toHaveValue('2026-11-09');
      expect(within(dialog).getByLabelText('Fim')).toHaveValue('2026-11-13');
      await user.click(within(dialog).getByRole('button', { name: 'Hoje' }));
      expect(within(dialog).getByLabelText('Início')).toHaveValue('2026-11-04');
      expect(within(dialog).getByLabelText('Fim')).toHaveValue('2026-11-04');
    });

    it('mostra o erro da API ao registrar o bloqueio', async () => {
      mocked(availabilityApi.createUnavailability).mockRejectedValue({
        response: { data: { message: 'Já existe bloqueio neste período' } },
      });
      renderPage();
      const { user, dialog } = await openBlockDialog();
      await user.click(within(dialog).getByRole('button', { name: 'Criar bloqueio' }));
      expect(await within(dialog).findByText('Já existe bloqueio neste período')).toBeInTheDocument();
      expect(toast.error).toHaveBeenCalledWith('Já existe bloqueio neste período');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('remove um bloqueio e avisa', async () => {
      const { invalidate } = renderPage();
      const user = userEvent.setup();
      await screen.findByText('Férias');
      const row = screen.getByText('Férias').closest('.MuiStack-root') as HTMLElement;
      await user.click(within(row).getByRole('button', { name: 'Remover bloqueio' }));
      await waitFor(() => expect(availabilityApi.removeUnavailability).toHaveBeenCalledWith('u1', 'b1'));
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Indisponibilidade removida.'));
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['unavailability', 'u1'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['unavailability-range'] });
    });

    it('avisa quando a remoção falha', async () => {
      mocked(availabilityApi.removeUnavailability).mockRejectedValue(new Error('boom'));
      renderPage();
      const user = userEvent.setup();
      await screen.findByText('Férias');
      await user.click(screen.getAllByRole('button', { name: 'Remover bloqueio' })[1]);
      await waitFor(() => expect(toast.error).toHaveBeenCalled());
      expect(toast.success).not.toHaveBeenCalled();
    });
  });
});
