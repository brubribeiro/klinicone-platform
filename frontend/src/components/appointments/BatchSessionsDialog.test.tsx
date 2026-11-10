import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appointmentsApi } from '../../api/appointments';
import type { Appointment, PatientPackage, Procedure } from '../../types';
import { BatchSessionsDialog, type BatchTarget } from './BatchSessionsDialog';
import { PackageSessionsDialog } from './PackageSessionsDialog';

vi.mock('../../api/appointments', () => ({ appointmentsApi: { create: vi.fn() } }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const procedure = {
  id: 'proc-1',
  name: 'Drenagem linfática',
  durationMinutes: 60,
  price: 200,
  active: true,
  recurrenceDays: 7,
} as Procedure;

const patientPkg = {
  id: 'pp-1',
  sessionsTotal: 5,
  sessionsUsed: 2,
  package: { id: 'pkg-1', name: 'Pacote Drenagem' },
} as PatientPackage;

function setup(
  props: {
    target?: BatchTarget | null;
    procedure?: Procedure;
    packageSessions?: Appointment[];
  } = {},
) {
  const onClose = vi.fn();
  const onDone = vi.fn();
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <BatchSessionsDialog
        target={props.target === undefined ? { patientPkg, fillCount: null } : props.target}
        procedure={'procedure' in props ? props.procedure : procedure}
        packageSessions={props.packageSessions ?? []}
        patientId="pat-1"
        professionalId="prof-1"
        baseDate="2030-03-04"
        baseStartTime="09:30"
        onClose={onClose}
        onDone={onDone}
      />
    </QueryClientProvider>,
  );
  return { onClose, onDone, invalidate };
}

const iso = (date: string, time: string) => dayjs(`${date}T${time}`).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BatchSessionsDialog (agendar sessões do pacote em lote)', () => {
  it('lista as sessões restantes a cada intervalo de retorno, a partir da data base', () => {
    setup();
    expect(screen.getByText(/possui/)).toHaveTextContent('O pacote Pacote Drenagem possui 3 sessões restantes de Drenagem linfática.');
    expect(screen.getByText(/intervalo de/)).toHaveTextContent('intervalo de 7 dias entre cada sessão, a partir de 04/03/2030 às 09:30');
    const dates = document.querySelectorAll('input[type="date"]');
    expect(Array.from(dates).map((d) => (d as HTMLInputElement).value)).toEqual([
      '2030-03-04',
      '2030-03-11',
      '2030-03-18',
    ]);
    expect(screen.getByRole('button', { name: 'Agendar 3 sessões' })).toBeEnabled();
  });

  it('cria uma consulta por sessão, com datas editadas, notas numeradas e fecha ao concluir', async () => {
    mocked(appointmentsApi.create).mockResolvedValue({ id: 'new' });
    const { onDone, invalidate } = setup();
    const dateInputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
    const timeInputs = document.querySelectorAll<HTMLInputElement>('input[type="time"]');
    await userEvent.clear(dateInputs[1]);
    await userEvent.type(dateInputs[1], '2030-03-12');
    await userEvent.clear(timeInputs[1]);
    await userEvent.type(timeInputs[1], '14:00');

    await userEvent.click(screen.getByRole('button', { name: 'Agendar 3 sessões' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());

    const calls = mocked(appointmentsApi.create).mock.calls.map((c) => c[0]);
    expect(calls).toHaveLength(3);
    expect(calls[0]).toEqual({
      patientId: 'pat-1',
      procedureId: 'proc-1',
      professionalId: 'prof-1',
      startAt: iso('2030-03-04', '09:30'),
      endAt: iso('2030-03-04', '10:30'),
      status: 'SCHEDULED',
      kind: 'PROCEDURE',
      notes: 'Sessão 1/3 — Pacote Drenagem',
      patientPackageId: 'pp-1',
    });
    expect(calls[1].startAt).toBe(iso('2030-03-12', '14:00'));
    expect(calls[1].endAt).toBe(iso('2030-03-12', '15:00'));
    expect(calls[2].notes).toBe('Sessão 3/3 — Pacote Drenagem');
    expect(toast.success).toHaveBeenCalledWith('3 sessões agendadas.');
    const keys = invalidate.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey?: unknown })?.queryKey));
    expect(keys).toContain('["patient-packages-active"]');
    expect(keys).toContain('["patient-packages"]');
  });

  it('com fillCount continua depois da última sessão já agendada', () => {
    setup({
      target: { patientPkg, fillCount: 2 },
      packageSessions: [{ id: 's1', startAt: iso('2030-03-20', '16:00'), status: 'SCHEDULED' } as Appointment],
    });
    expect(screen.getByText(/Faltam/)).toHaveTextContent('Faltam 2 sessão(ões) a agendar no pacote Pacote Drenagem de Drenagem linfática.');
    const dates = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="date"]')).map((d) => d.value);
    const times = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="time"]')).map((d) => d.value);
    expect(dates).toEqual(['2030-03-27', '2030-04-03']);
    expect(times).toEqual(['16:00', '16:00']);
  });

  it('erro na criação mostra o toast, não conclui e reabilita o botão', async () => {
    mocked(appointmentsApi.create)
      .mockResolvedValueOnce({ id: 'a' })
      .mockRejectedValueOnce({ response: { data: { message: 'Horário ocupado' } } });
    const { onDone } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Agendar 3 sessões' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Horário ocupado'));
    expect(onDone).not.toHaveBeenCalled();
    expect(appointmentsApi.create).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Agendar 3 sessões' })).toBeEnabled();
  });

  it('sem intervalo de retorno avisa e bloqueia o lote; "Agendar só esta sessão" fecha', async () => {
    const { onClose } = setup({ procedure: { ...procedure, recurrenceDays: null } });
    expect(screen.getByRole('alert')).toHaveTextContent('não possui intervalo de retorno');
    expect(screen.getByRole('button', { name: 'Agendar 0 sessões' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Agendar só esta sessão' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('pacote já completo não gera sessões', () => {
    setup({ target: { patientPkg: { ...patientPkg, sessionsUsed: 5 }, fillCount: null } });
    expect(screen.getByRole('button', { name: 'Agendar 0 sessões' })).toBeInTheDocument();
  });

  it('sem alvo não renderiza conteúdo', () => {
    setup({ target: null });
    expect(screen.queryByText('Agendar só esta sessão')).not.toBeInTheDocument();
  });
});

describe('PackageSessionsDialog', () => {
  const sessions = [
    { id: 's1', startAt: '2030-03-04T12:30:00.000Z', status: 'COMPLETED', procedure: { name: 'Drenagem' } },
    { id: 's2', startAt: '2030-03-11T12:30:00.000Z', status: 'SCHEDULED' },
    { id: 's3', startAt: '2030-03-18T12:30:00.000Z', status: 'WEIRD' },
  ] as unknown as Appointment[];

  function open(props: Partial<Parameters<typeof PackageSessionsDialog>[0]> = {}) {
    const onClose = vi.fn();
    const onScheduleMissing = vi.fn();
    render(
      <PackageSessionsDialog
        open
        onClose={onClose}
        isMobile={false}
        subtitle="Maria · Pacote Drenagem"
        sessions={sessions}
        currentAppointmentId="s2"
        missingSessions={2}
        onScheduleMissing={onScheduleMissing}
        {...props}
      />,
    );
    return { onClose, onScheduleMissing };
  }

  it('numera as sessões, mostra status em português (e cru se desconhecido) e agenda faltantes', async () => {
    const { onScheduleMissing, onClose } = open();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Maria · Pacote Drenagem')).toBeInTheDocument();
    expect(within(dialog).getByText('Concluído')).toBeInTheDocument();
    expect(within(dialog).getByText('Agendado')).toBeInTheDocument();
    expect(within(dialog).getByText('WEIRD')).toBeInTheDocument();
    expect(within(dialog).getByText('Drenagem')).toBeInTheDocument();
    expect(within(dialog).getByText('3')).toBeInTheDocument();
    expect(within(dialog).getByText(dayjs('2030-03-04T12:30:00.000Z').format('DD/MM/YYYY [às] HH:mm'))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Agendar faltantes (2)' }));
    expect(onScheduleMissing).toHaveBeenCalled();
    await userEvent.click(screen.getAllByRole('button', { name: 'Fechar' }).slice(-1)[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('vazio mostra mensagem e sem faltantes não oferece agendar', () => {
    open({ sessions: [], missingSessions: 0 });
    expect(screen.getByText('Nenhuma sessão agendada ainda para este pacote.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Agendar faltantes/ })).not.toBeInTheDocument();
  });
});
