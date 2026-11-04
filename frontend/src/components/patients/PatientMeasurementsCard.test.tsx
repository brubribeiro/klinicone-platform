import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { PatientMeasurementsCard } from './PatientMeasurementsCard';
import type { PatientMeasurement } from '../../types';

vi.setConfig({ testTimeout: 30_000 });

// recharts (ResponsiveContainer) precisa de ResizeObserver, ausente no jsdom
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const patientsApi = vi.hoisted(() => ({
  listMeasurements: vi.fn(),
  createMeasurement: vi.fn(),
  updateMeasurement: vi.fn(),
  removeMeasurement: vi.fn(),
}));
vi.mock('../../api/patients', () => ({ patientsApi }));
const catalogs = vi.hoisted(() => ({ measurementTypes: vi.fn() }));
vi.mock('../../api/catalogs', () => ({ catalogsApi: catalogs }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));
const dialog = vi.hoisted(() => ({ confirm: vi.fn() }));
vi.mock('../../contexts/AppDialogContext', () => ({ useAppDialog: () => dialog }));

const m = (o: Partial<PatientMeasurement>): PatientMeasurement => ({
  id: 'm', patientId: 'p1', measuredAt: '2026-03-01T15:00:00.000Z', weightKg: null, heightCm: null, values: [],
  createdAt: '2026-03-01T15:00:00.000Z', ...o,
});

const types = [
  { id: 'w', key: 'weightKg', name: 'Peso', unit: 'kg', sortOrder: 0 },
  { id: 'h', key: 'heightCm', name: 'Altura', unit: 'cm', sortOrder: 1 },
  { id: 'waist', key: null, name: 'Cintura', unit: 'cm', sortOrder: 2 },
];

function setup(canEdit = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <PatientMeasurementsCard patient={{ id: 'p1', name: 'Maria', appointments: [] }} canEdit={canEdit} />
    </QueryClientProvider>,
  );
  return { invalidate };
}

describe('PatientMeasurementsCard', () => {
  beforeEach(() => {
    Object.values(patientsApi).forEach((f) => f.mockReset());
    catalogs.measurementTypes.mockReset().mockResolvedValue(types);
    toast.error.mockReset();
    toast.success.mockReset();
    dialog.confirm.mockReset();
  });

  it('mostra estado vazio e botão de registrar só para quem edita', async () => {
    patientsApi.listMeasurements.mockResolvedValue([]);
    setup(true);
    expect(await screen.findByText(/Nenhuma medida registrada/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Registrar medidas/ })).toBeInTheDocument();
  });

  it('esconde ações sem permissão de edição', async () => {
    patientsApi.listMeasurements.mockResolvedValue([m({ id: 'a', weightKg: 70 })]);
    setup(false);
    expect(await screen.findByText('1 registro')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Registrar medidas/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar medição' })).not.toBeInTheDocument();
  });

  it('resume peso, IMC e histórico a partir das medições', async () => {
    patientsApi.listMeasurements.mockResolvedValue([
      m({ id: 'b', measuredAt: '2026-03-10T15:00:00.000Z', weightKg: 68, values: [{ typeId: 'waist', value: 80, name: 'Cintura', unit: 'cm', sortOrder: 2, active: true }] }),
      m({ id: 'a', measuredAt: '2026-02-01T15:00:00.000Z', weightKg: 72, heightCm: 170 }),
    ]);
    setup();
    expect(await screen.findByText('2 registros')).toBeInTheDocument();
    expect(screen.getByText('Peso atual')).toBeInTheDocument();
    expect(screen.getByText(/-4 kg desde 01\/02\/2026/)).toBeInTheDocument();
    expect(screen.getByText('IMC atual')).toBeInTheDocument();
    expect(screen.getAllByText('23,5').length).toBeGreaterThan(0);
    const table = screen.getByRole('table', { name: 'Histórico de medidas' });
    expect(within(table).getByText('Cintura (cm)')).toBeInTheDocument();
    expect(within(table).getByText('IMC')).toBeInTheDocument();
    expect(within(table).getByText('10/03/2026')).toBeInTheDocument();
    // métricas do gráfico: peso e cintura (altura fica de fora)
    const group = screen.getByRole('group', { name: 'Métrica do gráfico' });
    expect(within(group).getByText('Peso')).toBeInTheDocument();
    await userEvent.click(within(group).getByText('Cintura'));
    expect(screen.getByText(/Registre ao menos duas medições de cintura/)).toBeInTheDocument();
  });

  it('exclui após confirmação', async () => {
    patientsApi.listMeasurements.mockResolvedValue([m({ id: 'a', weightKg: 70 })]);
    patientsApi.removeMeasurement.mockResolvedValue(undefined);
    dialog.confirm.mockResolvedValue(true);
    const { invalidate } = setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir medição' }));
    expect(dialog.confirm).toHaveBeenCalledWith(expect.objectContaining({ message: 'Excluir as medidas de 01/03/2026?' }));
    await waitFor(() => expect(patientsApi.removeMeasurement).toHaveBeenCalledWith('p1', 'a'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Medição excluída.'));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['patient-measurements', 'p1'] });
  });

  it('não exclui se cancelar e mostra erro da API', async () => {
    patientsApi.listMeasurements.mockResolvedValue([m({ id: 'a', weightKg: 70 })]);
    dialog.confirm.mockResolvedValueOnce(false);
    setup();
    const del = await screen.findByRole('button', { name: 'Excluir medição' });
    await userEvent.click(del);
    await waitFor(() => expect(dialog.confirm).toHaveBeenCalled());
    expect(patientsApi.removeMeasurement).not.toHaveBeenCalled();

    dialog.confirm.mockResolvedValueOnce(true);
    patientsApi.removeMeasurement.mockRejectedValue({ response: { data: { message: 'Sem acesso' } } });
    await userEvent.click(del);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Sem acesso'));
  });

  it('registra nova medição pelo diálogo e edita uma existente', async () => {
    patientsApi.listMeasurements.mockResolvedValue([m({ id: 'a', weightKg: 70, heightCm: 175 })]);
    patientsApi.createMeasurement.mockResolvedValue({});
    patientsApi.updateMeasurement.mockResolvedValue({});
    setup();
    await userEvent.click(await screen.findByRole('button', { name: /Registrar medidas/ }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText('Peso (kg)'), '65,5');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Salvar medidas' }));
    await waitFor(() => expect(patientsApi.createMeasurement).toHaveBeenCalled());
    expect(patientsApi.createMeasurement.mock.calls[0][0]).toBe('p1');
    expect(patientsApi.createMeasurement.mock.calls[0][1]).toMatchObject({ weightKg: 65.5, notes: null, appointmentId: null });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Editar medição' }));
    const dlg2 = await screen.findByRole('dialog');
    expect(within(dlg2).getByText('Editar medidas')).toBeInTheDocument();
    expect(within(dlg2).getByLabelText('Peso (kg)')).toHaveValue('70');
    await userEvent.click(within(dlg2).getByRole('button', { name: 'Salvar medidas' }));
    await waitFor(() => expect(patientsApi.updateMeasurement).toHaveBeenCalledWith('p1', 'a', expect.objectContaining({ weightKg: 70, heightCm: 175 })));
  });
});
