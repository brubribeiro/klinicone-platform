import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appointmentsApi } from '../../api/appointments';
import { availabilityApi } from '../../api/availability';
import { inventoryApi } from '../../api/inventory';
import { packagesApi } from '../../api/packages';
import { patientsApi } from '../../api/patients';
import { paymentMethodsApi } from '../../api/paymentMethods';
import { proceduresApi } from '../../api/procedures';
import { usersApi } from '../../api/users';
import type { Appointment, Package, PatientPackage, Procedure } from '../../types';
import { AppointmentFormDialog } from './AppointmentFormDialog';

vi.mock('../../api/appointments', () => ({
  appointmentsApi: {
    create: vi.fn(),
    update: vi.fn(),
    findOne: vi.fn(),
    remove: vi.fn(),
    getRecurrenceLimit: vi.fn(),
    promotionPreview: vi.fn(),
  },
}));
vi.mock('../../api/availability', () => ({ availabilityApi: { listAvailableProfessionals: vi.fn() } }));
vi.mock('../../api/inventory', () => ({ inventoryApi: { list: vi.fn() } }));
vi.mock('../../api/packages', () => ({
  packagesApi: { list: vi.fn(), listActiveForPatient: vi.fn(), findPatientPackage: vi.fn() },
}));
vi.mock('../../api/patients', () => ({
  patientsApi: { list: vi.fn(), getReliability: vi.fn(), findOne: vi.fn() },
}));
vi.mock('../../api/paymentMethods', () => ({ paymentMethodsApi: { list: vi.fn() } }));
vi.mock('../../api/procedures', () => ({ proceduresApi: { list: vi.fn() } }));
vi.mock('../../api/users', () => ({ usersApi: { listAppointmentProviders: vi.fn() } }));

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  showToast: vi.fn(),
}));
const auth = vi.hoisted(() => ({
  user: {
    id: 'prof-1',
    name: 'Dra. Ana',
    permissions: ['appointments:create', 'appointments:delete', 'patients:view'],
    restrictToOwnAppointments: false,
    providesAppointments: true,
  },
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));
vi.mock('../../contexts/AppDialogContext', () => ({
  useAppDialog: () => ({ confirm: vi.fn().mockResolvedValue(true) }),
}));
// Diálogos/gavetas auxiliares só abrem por ação do usuário; ficam fora deste teste.
vi.mock('../patients/PatientDetailDrawer', () => ({ PatientDetailDrawer: () => null }));
vi.mock('../skincare/SkinAnamnesisDialog', () => ({ SkinAnamnesisDialog: () => null }));
vi.mock('../messages/SendWhatsAppDialog', () => ({ SendWhatsAppDialog: () => null }));
vi.mock('../application-map/ApplicationMapDialog', () => ({ ApplicationMapDialog: () => null }));

// Formulário grande (MUI + vários selects): sob cobertura e com o CI ocupado passa de 5 s.
vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const START = new Date(2030, 0, 15, 10, 0); // 15/01/2030 10:00 (hora local)

const limpeza = { id: 'proc-limpeza', name: 'Limpeza de pele', durationMinutes: 60, price: 150, active: true } as Procedure;
const peeling = { id: 'proc-peeling', name: 'Peeling', durationMinutes: 30, price: 80, active: true } as Procedure;

const professional = { id: 'prof-1', name: 'Dra. Ana', email: 'ana@x.com', active: true, providesAppointments: true, roleId: 'r', createdAt: '' };

function brlText(value: number) {
  return new RegExp(`R\\$\\s${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
}

function renderDialog(props: Partial<React.ComponentProps<typeof AppointmentFormDialog>> = {}) {
  const onClose = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppointmentFormDialog
          open
          onClose={onClose}
          defaultStart={START}
          defaultPatientId="pat-1"
          {...props}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onClose };
}

async function pickProcedures(...names: string[]) {
  const user = userEvent.setup();
  await user.click(await screen.findByPlaceholderText('Selecione um ou mais procedimentos'));
  for (const name of names) {
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByRole('option', { name }));
  }
  await user.keyboard('{Escape}');
  return user;
}

async function waitForProfessional() {
  // O profissional disponível é escolhido sozinho; ele aparece no select.
  await waitFor(() => expect(screen.getAllByText('Dra. Ana').length).toBeGreaterThan(0));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked(patientsApi.list).mockResolvedValue([{ id: 'pat-1', name: 'Maria Souza' }]);
  mocked(patientsApi.getReliability).mockResolvedValue(null);
  mocked(proceduresApi.list).mockResolvedValue([limpeza, peeling]);
  mocked(paymentMethodsApi.list).mockResolvedValue([]);
  mocked(inventoryApi.list).mockResolvedValue([]);
  mocked(packagesApi.list).mockResolvedValue([]);
  mocked(packagesApi.listActiveForPatient).mockResolvedValue([]);
  mocked(usersApi.listAppointmentProviders).mockResolvedValue([professional]);
  mocked(availabilityApi.listAvailableProfessionals).mockResolvedValue([professional]);
  mocked(appointmentsApi.getRecurrenceLimit).mockResolvedValue({ earliestDate: null, recurrenceDays: null, lastCompletedAt: null });
  mocked(appointmentsApi.promotionPreview).mockResolvedValue({ promotion: null });
  mocked(appointmentsApi.create).mockResolvedValue({ id: 'new-1', patientId: 'pat-1', status: 'SCHEDULED', kind: 'PROCEDURE' });
  mocked(appointmentsApi.update).mockResolvedValue({ id: 'ap-1', patientId: 'pat-1', status: 'SCHEDULED', kind: 'PROCEDURE' });
});

describe('AppointmentFormDialog - agendamento com vários procedimentos', () => {
  it('soma duração e preço ao selecionar dois procedimentos (60 + 30 = 90 min)', async () => {
    renderDialog();
    await pickProcedures('Limpeza de pele', 'Peeling');

    expect((await screen.findAllByText('90 min (total)')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(brlText(230)).length).toBeGreaterThan(0);
    expect(screen.getByText('Duração total somada no horário do agendamento')).toBeInTheDocument();
    // 10:00 + 90 min
    expect(await screen.findByText('Término previsto às 11:30')).toBeInTheDocument();
  });

  it('envia procedureIds na ordem escolhida, com profissional, início e fim somados', async () => {
    renderDialog();
    // Peeling primeiro, mesmo aparecendo depois de Limpeza na lista (ordem alfabética)
    const user = await pickProcedures('Peeling', 'Limpeza de pele');
    await waitForProfessional();

    await user.click(screen.getByRole('button', { name: 'Confirmar agendamento' }));

    await waitFor(() => expect(appointmentsApi.create).toHaveBeenCalledTimes(1));
    const payload = mocked(appointmentsApi.create).mock.calls[0][0];
    expect(payload).toMatchObject({
      patientId: 'pat-1',
      professionalId: 'prof-1',
      kind: 'PROCEDURE',
      status: 'SCHEDULED',
      procedureIds: ['proc-peeling', 'proc-limpeza'],
      procedureId: 'proc-peeling',
      startAt: dayjs(START).toISOString(),
      endAt: dayjs(START).add(90, 'minute').toISOString(),
    });
  });

  it('ao editar agendamento só com procedureId legado, mostra o procedimento selecionado', async () => {
    const legacy = {
      id: 'ap-1',
      patientId: 'pat-1',
      procedureId: 'proc-limpeza',
      appointmentProcedures: [],
      professionalId: 'prof-1',
      professional: professional,
      startAt: START.toISOString(),
      endAt: dayjs(START).add(60, 'minute').toISOString(),
      status: 'SCHEDULED',
      kind: 'PROCEDURE',
    } as unknown as Appointment;
    mocked(appointmentsApi.findOne).mockResolvedValue(legacy);

    renderDialog({ appointment: legacy, defaultStart: null, defaultPatientId: null });

    const input = await screen.findByPlaceholderText('Selecione um ou mais procedimentos').catch(() => null);
    // Com o procedimento já selecionado o placeholder some; o chip é a prova da seleção.
    expect(input).toBeNull();
    expect(await screen.findByRole('button', { name: 'Limpeza de pele' })).toBeInTheDocument();
    expect(screen.getAllByText('60 min').length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(appointmentsApi.update).toHaveBeenCalledTimes(1));
    expect(mocked(appointmentsApi.update).mock.calls[0][0]).toBe('ap-1');
    expect(mocked(appointmentsApi.update).mock.calls[0][1]).toMatchObject({
      procedureIds: ['proc-limpeza'],
      endAt: dayjs(START).add(60, 'minute').toISOString(),
    });
  });

  it('não cria agendamento de procedimento sem procedimento: mostra erro e avisa', async () => {
    renderDialog();
    await waitForProfessional();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Confirmar agendamento' }));

    expect(await screen.findByText('Selecione ao menos um procedimento')).toBeInTheDocument();
    expect(toast.warning).toHaveBeenCalledWith('Revise os campos destacados antes de salvar.');
    expect(appointmentsApi.create).not.toHaveBeenCalled();
  });

  it('bloqueia o envio quando a data é anterior ao retorno mínimo do procedimento', async () => {
    mocked(appointmentsApi.getRecurrenceLimit).mockResolvedValue({
      earliestDate: '2030-02-10',
      recurrenceDays: 30,
      lastCompletedAt: '2030-01-11T10:00:00.000Z',
    });
    renderDialog();
    const user = await pickProcedures('Limpeza de pele');
    await waitForProfessional();
    expect(await screen.findByText(/Retorno em 30 dias/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirmar agendamento' }));

    expect(await screen.findByText(/Agende a partir de/)).toBeInTheDocument();
    expect(appointmentsApi.create).not.toHaveBeenCalled();
  });

  it('oferece pacote do paciente que cobre apenas um dos procedimentos escolhidos', async () => {
    const pkg = {
      id: 'pkg-1',
      name: 'Pacote Limpeza 4x',
      active: true,
      items: [{ procedureId: 'proc-limpeza' }],
    } as unknown as Package;
    const patientPkg = {
      id: 'pp-1',
      packageId: 'pkg-1',
      package: pkg,
      sessionsTotal: 4,
      sessionsUsed: 1,
      totalPaid: 400,
      financeGenerated: false,
    } as unknown as PatientPackage;
    mocked(packagesApi.listActiveForPatient).mockResolvedValue([patientPkg]);
    mocked(packagesApi.findPatientPackage).mockResolvedValue({ ...patientPkg, appointments: [] });

    renderDialog();
    const user = await pickProcedures('Limpeza de pele', 'Peeling');
    await waitForProfessional();

    // A seção de pacote começa recolhida
    await user.click(screen.getByText('Pacote e pagamento'));
    expect(await screen.findByText('Vincular este agendamento a um pacote ativo')).toBeInTheDocument();
    await user.click(screen.getByText('Nenhum (avulso)', { selector: 'span' }));
    await user.click(within(await screen.findByRole('listbox')).getByRole('option', { name: /Pacote Limpeza 4x/ }));
    expect(await screen.findByText('1/4 sessões usadas')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirmar agendamento' }));

    await waitFor(() => expect(appointmentsApi.create).toHaveBeenCalledTimes(1));
    expect(mocked(appointmentsApi.create).mock.calls[0][0]).toMatchObject({
      patientPackageId: 'pp-1',
      procedureIds: ['proc-limpeza', 'proc-peeling'],
    });
  });
});
