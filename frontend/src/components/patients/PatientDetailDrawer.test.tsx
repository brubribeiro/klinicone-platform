import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';

import { PatientDetailDrawer } from './PatientDetailDrawer';

vi.setConfig({ testTimeout: 30_000 });

const api = vi.hoisted(() => ({ findOne: vi.fn(), getReliability: vi.fn() }));
vi.mock('../../api/patients', () => ({ patientsApi: api }));
const perms = vi.hoisted(() => ({ set: new Set<string>(), access: { showDocuments: true, showFinance: true } }));
vi.mock('../../contexts/usePermissions', () => ({ usePermissions: () => ({ has: (p: string) => perms.set.has(p) }) }));
vi.mock('./usePatientRecordAccess', () => ({ usePatientRecordAccess: () => perms.access }));
const openAppointmentDialog = vi.hoisted(() => vi.fn());
vi.mock('../../contexts/AppointmentDialogContext', () => ({ useAppointmentDialog: () => ({ openAppointmentDialog }) }));

vi.mock('./PatientAnamnesisSection', () => ({
  PatientAnamnesisSection: ({ onEdit }: { onEdit?: () => void }) => (
    <div>
      Seção anamnese
      {onEdit && <button onClick={onEdit}>editar-anamnese</button>}
    </div>
  ),
}));
vi.mock('./PatientPhotosGallery', () => ({
  PatientPhotosGallery: ({ onAddClick }: { onAddClick: () => void }) => <button onClick={onAddClick}>galeria-adicionar</button>,
}));
vi.mock('./PatientDocumentsTab', () => ({ PatientDocumentsTab: ({ patientId }: { patientId: string }) => <div>Docs de {patientId}</div> }));
vi.mock('./PatientFinanceTab', () => ({ PatientFinanceTab: ({ patientId }: { patientId: string }) => <div>Financeiro de {patientId}</div> }));

function Where() {
  const l = useLocation();
  return <div data-testid="where">{l.pathname + l.search}</div>;
}

const data = {
  id: 'p1', name: 'Maria Souza', phone: '11988887777', visits: 2, totalSpent: 300, notes: 'Nota X',
  appointments: [{ id: 'a1', status: 'COMPLETED', kind: 'PROCEDURE', startAt: '2026-02-03T10:00:00', procedure: { name: 'Botox' } }],
};

function setup(props: Partial<React.ComponentProps<typeof PatientDetailDrawer>> = {}) {
  const onClose = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PatientDetailDrawer patientId="p1" onClose={onClose} {...props} />
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onClose };
}

describe('PatientDetailDrawer', () => {
  beforeEach(() => {
    api.findOne.mockReset().mockResolvedValue(data);
    api.getReliability.mockReset().mockResolvedValue({ reliabilityPercent: 88 });
    openAppointmentDialog.mockReset();
    perms.set = new Set(['patients:edit']);
    perms.access = { showDocuments: true, showFinance: true };
  });

  it('não renderiza conteúdo sem paciente selecionado', () => {
    setup({ patientId: null });
    expect(screen.queryByLabelText('Fechar ficha')).not.toBeInTheDocument();
    expect(api.findOne).not.toHaveBeenCalled();
  });

  it('carrega a ficha e mostra o resumo com score', async () => {
    setup();
    expect(await screen.findByText('Ficha do paciente')).toBeInTheDocument();
    expect(screen.getByText('Maria Souza')).toBeInTheDocument();
    expect(await screen.findByText('88')).toBeInTheDocument();
    expect(screen.getByText('Nota X')).toBeInTheDocument();
    expect(api.findOne).toHaveBeenCalledWith('p1');
  });

  it('navega pelas abas', async () => {
    const onEditAnamnesis = vi.fn();
    setup({ onEditAnamnesis });
    await screen.findByText('Ficha do paciente');

    await userEvent.click(screen.getByRole('button', { name: 'Atendimentos' }));
    expect(screen.getByText('Botox')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Anamnese' }));
    await userEvent.click(screen.getByRole('button', { name: 'editar-anamnese' }));
    expect(onEditAnamnesis).toHaveBeenCalledWith('p1');

    await userEvent.click(screen.getByRole('button', { name: 'Documentos' }));
    expect(screen.getByText('Docs de p1')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Financeiro' }));
    expect(screen.getByText('Financeiro de p1')).toBeInTheDocument();
  });

  it('esconde abas de documentos e financeiro sem acesso', async () => {
    perms.access = { showDocuments: false, showFinance: false };
    setup();
    await screen.findByText('Ficha do paciente');
    expect(screen.queryByRole('button', { name: 'Documentos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Financeiro' })).not.toBeInTheDocument();
  });

  it('abre na aba indicada por defaultTab', async () => {
    setup({ defaultTab: 'appointments' });
    expect(await screen.findByText('Botox')).toBeInTheDocument();
  });

  it('Ficha completa fecha a gaveta e navega', async () => {
    const { onClose } = setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Ficha completa' }));
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByTestId('where')).toHaveTextContent('/pacientes/p1');
  });

  it('Agendar abre o diálogo de agendamento para o paciente', async () => {
    const { onClose } = setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Agendar' }));
    expect(openAppointmentDialog).toHaveBeenCalledWith({ patientId: 'p1' });
    expect(onClose).toHaveBeenCalled();
  });

  it('adicionar foto leva à ficha completa na aba de fotos', async () => {
    setup();
    await screen.findByText('Ficha do paciente');
    await userEvent.click(screen.getByRole('button', { name: 'Fotos' }));
    await userEvent.click(screen.getByRole('button', { name: 'galeria-adicionar' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/pacientes/p1?tab=fotos');
  });

  it('botão de fechar chama onClose', async () => {
    const { onClose } = setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Fechar ficha' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
