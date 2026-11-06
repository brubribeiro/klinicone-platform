import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appointmentsApi } from '../../api/appointments';
import { availabilityApi } from '../../api/availability';
import type { Appointment, Procedure } from '../../types';
import { ReturnAppointmentDialog } from './ReturnAppointmentDialog';

vi.mock('../../api/appointments', () => ({ appointmentsApi: { create: vi.fn() } }));
vi.mock('../../api/availability', () => ({ availabilityApi: { listAvailableProfessionals: vi.fn() } }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;
const local = (s: string) => dayjs(s).toISOString();

const peeling = { id: 'p1', name: 'Peeling', durationMinutes: 45, price: 100, active: true, recurrenceDays: 15 } as Procedure;
const laser = { id: 'p2', name: 'Laser', durationMinutes: 30, price: 300, active: true, recurrenceDays: 30 } as Procedure;
const massagem = { id: 'p3', name: 'Massagem', durationMinutes: 50, price: 90, active: true } as Procedure;

const completed = (over: Partial<Appointment> = {}) =>
  ({
    id: 'a1',
    patientId: 'pat-1',
    professionalId: 'prof-1',
    procedureId: 'p1',
    startAt: local('2030-03-04T10:00'),
    status: 'COMPLETED',
    kind: 'PROCEDURE',
    ...over,
  }) as Appointment;

function setup(pendingReturn: Appointment | null, procedures: Procedure[] = [peeling, laser, massagem]) {
  const onClose = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ReturnAppointmentDialog
        pendingReturn={pendingReturn}
        procedures={procedures}
        fallbackProcedures={[]}
        onClose={onClose}
      />
    </QueryClientProvider>,
  );
  return { onClose };
}

const createBtn = () => screen.getByRole('button', { name: 'Criar retorno' });

beforeEach(() => {
  vi.clearAllMocks();
  mocked(availabilityApi.listAvailableProfessionals).mockResolvedValue([{ id: 'prof-1', name: 'Dra. Ana' }]);
});

describe('ReturnAppointmentDialog (agendar retorno)', () => {
  it('sugere a data pelo intervalo do procedimento e cria o retorno com o mesmo profissional', async () => {
    mocked(appointmentsApi.create).mockResolvedValue({ id: 'new' });
    const { onClose } = setup(completed());
    expect(screen.getByText(/Intervalo de retorno/)).toHaveTextContent('Intervalo de retorno: 15 dias. Só é possível agendar a partir de 19/03/2030.');
    expect(screen.getByLabelText(/Data do retorno/)).toHaveValue('2030-03-19');
    expect(screen.getByLabelText(/Horário/)).toHaveValue('10:00');
    expect(screen.getByText(/Peeling · 45 min/)).toBeInTheDocument();
    await waitFor(() => expect(createBtn()).toBeEnabled());

    await userEvent.click(createBtn());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(appointmentsApi.create).toHaveBeenCalledWith({
      patientId: 'pat-1',
      procedureIds: ['p1'],
      procedureId: 'p1',
      professionalId: 'prof-1',
      startAt: local('2030-03-19T10:00'),
      endAt: local('2030-03-19T10:45'),
      status: 'SCHEDULED',
      kind: 'RETURN',
      notes: 'Retorno automático sugerido',
    });
    expect(toast.success).toHaveBeenCalledWith('Retorno agendado.');
  });

  it('consulta a disponibilidade do horário sugerido', async () => {
    setup(completed());
    await waitFor(() =>
      expect(availabilityApi.listAvailableProfessionals).toHaveBeenCalledWith(
        local('2030-03-19T10:00'),
        local('2030-03-19T10:45'),
      ),
    );
  });

  it('com vários procedimentos repete todos, usa o maior intervalo e soma as durações', async () => {
    mocked(appointmentsApi.create).mockResolvedValue({ id: 'new' });
    setup(
      completed({
        procedureId: 'p1',
        appointmentProcedures: [
          { procedureId: 'p1', sortOrder: 0 },
          { procedureId: 'p2', sortOrder: 1 },
        ],
      } as Partial<Appointment>),
    );
    expect(screen.getByText(/Intervalo de retorno/)).toHaveTextContent('30 dias');
    expect(screen.getByLabelText(/Data do retorno/)).toHaveValue('2030-04-03');
    expect(screen.getByText(/Peeling \+ Laser · 75 min/)).toHaveTextContent('procedimentos do atendimento concluído');
    await waitFor(() => expect(createBtn()).toBeEnabled());
    await userEvent.click(createBtn());
    await waitFor(() => expect(appointmentsApi.create).toHaveBeenCalled());
    const payload = mocked(appointmentsApi.create).mock.calls[0][0];
    expect(payload.procedureIds).toEqual(['p1', 'p2']);
    expect(payload.endAt).toBe(local('2030-04-03T11:15'));
  });

  it('procedimento sem intervalo cadastrado pede data manual (sugere 7 dias) e grava nota manual', async () => {
    mocked(appointmentsApi.create).mockResolvedValue({ id: 'new' });
    setup(completed({ procedureId: 'p3' }));
    expect(screen.getByText(/Este procedimento não tem/)).toBeInTheDocument();
    const date = screen.getByLabelText(/Data do retorno/);
    expect(date).toHaveValue('2030-03-11');
    await waitFor(() => expect(createBtn()).toBeEnabled());
    await userEvent.click(createBtn());
    await waitFor(() => expect(appointmentsApi.create).toHaveBeenCalled());
    expect(mocked(appointmentsApi.create).mock.calls[0][0].notes).toBe('Retorno agendado manualmente');
  });

  it('data anterior ao intervalo mínimo mostra aviso e bloqueia o botão', async () => {
    setup(completed());
    await waitFor(() => expect(createBtn()).toBeEnabled());
    const date = screen.getByLabelText(/Data do retorno/);
    await userEvent.clear(date);
    await userEvent.type(date, '2030-03-10');
    expect(screen.getByText('A data deve ser a partir de 19/03/2030.')).toBeInTheDocument();
    expect(createBtn()).toBeDisabled();
  });

  it('avisa quando o profissional não está disponível no horário e bloqueia', async () => {
    mocked(availabilityApi.listAvailableProfessionals).mockResolvedValue([{ id: 'outra', name: 'Outra' }]);
    setup(completed());
    expect(await screen.findByText(/O profissional não está disponível neste horário/)).toBeInTheDocument();
    expect(createBtn()).toBeDisabled();
  });

  it('erro da API aparece no alerta e no toast, sem fechar o diálogo', async () => {
    mocked(appointmentsApi.create).mockRejectedValue({ response: { data: { message: 'Conflito de agenda' } } });
    const { onClose } = setup(completed());
    await waitFor(() => expect(createBtn()).toBeEnabled());
    await userEvent.click(createBtn());
    expect(await screen.findByText('Conflito de agenda')).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith('Conflito de agenda');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('atendimento sem profissional não habilita a criação', async () => {
    setup(completed({ professionalId: undefined }));
    expect(createBtn()).toBeDisabled();
  });

  it('"Agora não" fecha; sem atendimento pendente o diálogo fica fechado', async () => {
    const { onClose } = setup(completed());
    await userEvent.click(screen.getByRole('button', { name: 'Agora não' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('fechado quando não há atendimento pendente', () => {
    setup(null);
    expect(screen.queryByText('Agendar retorno?')).not.toBeInTheDocument();
  });
});
