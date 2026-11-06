import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Patient } from '../types';
import { PatientDetail } from './PatientDetail';

vi.setConfig({ testTimeout: 30_000 });

const chart = vi.hoisted(() => ({ data: undefined as unknown, isLoading: false, reliability: undefined as unknown }));
vi.mock('../components/patients/usePatientChart', () => ({ usePatientChart: () => chart }));
const access = vi.hoisted(() => ({ showDocuments: true, showFinance: true }));
vi.mock('../components/patients/usePatientRecordAccess', () => ({ usePatientRecordAccess: () => access }));
const perms = vi.hoisted(() => ({ granted: new Set<string>(['patients:edit']) }));
vi.mock('../contexts/usePermissions', () => ({ usePermissions: () => ({ has: (p: string) => perms.granted.has(p) }) }));
const dialog = vi.hoisted(() => ({ openAppointmentDialog: vi.fn() }));
vi.mock('../contexts/AppointmentDialogContext', () => ({ useAppointmentDialog: () => dialog }));
const pkgApi = vi.hoisted(() => ({ listPatientPackages: vi.fn() }));
vi.mock('../api/packages', () => ({ packagesApi: pkgApi }));

vi.mock('../components/patients/PatientSummarySidebar', () => ({
  PatientSummarySidebar: ({ patient, onSchedule }: { patient: Patient; onSchedule: () => void }) => (
    <div>
      <span>resumo:{patient.name}</span>
      <button onClick={onSchedule}>agendar</button>
    </div>
  ),
}));
vi.mock('../components/patients/PatientOverviewTab', () => ({
  PatientOverviewTab: ({ activePackagesCount }: { activePackagesCount: number }) => <p>aba-geral pacotes-ativos:{activePackagesCount}</p>,
}));
vi.mock('../components/patients/PatientAppointmentsTab', () => ({
  PatientAppointmentsTab: ({ appointments }: { appointments: unknown[] }) => <p>aba-agendamentos:{appointments.length}</p>,
}));
vi.mock('../components/patients/PatientPackagesTab', () => ({
  PatientPackagesTab: ({ patientPackages }: { patientPackages: unknown[] }) => <p>aba-pacotes:{patientPackages.length}</p>,
}));
vi.mock('../components/patients/PatientAnamnesisSection', () => ({
  PatientAnamnesisSection: ({ onEdit }: { onEdit?: () => void }) => (
    <div>
      aba-anamnese
      {onEdit && <button onClick={onEdit}>editar-anamnese</button>}
    </div>
  ),
}));
vi.mock('../components/patients/PatientPhotosGallery', () => ({
  PatientPhotosGallery: ({ patientId, canEdit }: { patientId: string; canEdit: boolean }) => <p>aba-fotos:{patientId}:{String(canEdit)}</p>,
}));
vi.mock('../components/patients/PatientDocumentsTab', () => ({
  PatientDocumentsTab: ({ patientName }: { patientName: string }) => <p>aba-documentos:{patientName}</p>,
}));
vi.mock('../components/patients/PatientFinanceTab', () => ({ PatientFinanceTab: ({ patientId }: { patientId: string }) => <p>aba-financeiro:{patientId}</p> }));
vi.mock('../components/patients/AnamnesisFormDialog', () => ({
  AnamnesisFormDialog: ({ open, patientId }: { open: boolean; patientId: string | null }) => (open ? <div role="dialog">form-anamnese:{patientId}</div> : null),
}));

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}
function renderAt(path = '/pacientes/p1') {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/pacientes/:id" element={<><PatientDetail /><Where /></>} />
          <Route path="/pacientes" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  chart.data = { id: 'p1', name: 'Maria Souza', appointments: [{ id: 'a1' }, { id: 'a2' }] };
  chart.isLoading = false;
  access.showDocuments = true;
  access.showFinance = true;
  perms.granted = new Set(['patients:edit']);
  pkgApi.listPatientPackages.mockResolvedValue([{ id: 'x1', status: 'ACTIVE' }, { id: 'x2', status: 'EXPIRED' }, { id: 'x3', status: 'ACTIVE' }]);
});

describe('PatientDetail', () => {
  it('mostra o carregamento enquanto não há dados', () => {
    chart.data = undefined;
    chart.isLoading = true;
    renderAt();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('paciente não encontrado oferece voltar à lista', async () => {
    chart.data = undefined;
    renderAt();
    expect(screen.getByText('Paciente não encontrado.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Voltar para pacientes' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/pacientes');
  });

  it('abre na visão geral com o resumo e a contagem de pacotes ativos', async () => {
    renderAt();
    expect(screen.getByText('resumo:Maria Souza')).toBeInTheDocument();
    expect(await screen.findByText('aba-geral pacotes-ativos:2')).toBeInTheDocument();
    expect(pkgApi.listPatientPackages).toHaveBeenCalledWith('p1');
  });

  it('navega entre as abas', async () => {
    renderAt();
    await userEvent.click(screen.getByRole('tab', { name: 'Agendamentos' }));
    expect(screen.getByText('aba-agendamentos:2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Pacotes' }));
    expect(await screen.findByText('aba-pacotes:3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Fotos' }));
    expect(screen.getByText('aba-fotos:p1:true')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Documentos' }));
    expect(screen.getByText('aba-documentos:Maria Souza')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Financeiro' }));
    expect(screen.getByText('aba-financeiro:p1')).toBeInTheDocument();
  });

  it('sem lista de agendamentos usa vazio', async () => {
    chart.data = { id: 'p1', name: 'Maria' };
    renderAt();
    await userEvent.click(screen.getByRole('tab', { name: 'Agendamentos' }));
    expect(screen.getByText('aba-agendamentos:0')).toBeInTheDocument();
  });

  it('?tab= abre a aba pedida', () => {
    renderAt('/pacientes/p1?tab=fotos');
    expect(screen.getByText('aba-fotos:p1:true')).toBeInTheDocument();
  });

  it('?tab=documents sem acesso cai na visão geral e esconde as abas', () => {
    access.showDocuments = false;
    access.showFinance = false;
    renderAt('/pacientes/p1?tab=documents');
    expect(screen.getByText(/aba-geral/)).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Documentos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Financeiro' })).not.toBeInTheDocument();
  });

  it('?tab=finance sem acesso ao financeiro cai na visão geral', () => {
    access.showFinance = false;
    renderAt('/pacientes/p1?tab=finance');
    expect(screen.getByText(/aba-geral/)).toBeInTheDocument();
  });

  it('com patients:edit a anamnese pode ser editada e o formulário abre com o paciente', async () => {
    renderAt('/pacientes/p1?tab=anamnesis');
    await userEvent.click(screen.getByRole('button', { name: 'editar-anamnese' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('form-anamnese:p1');
  });

  it('sem patients:edit a anamnese é somente leitura e fotos sem edição', async () => {
    perms.granted = new Set();
    renderAt('/pacientes/p1?tab=anamnesis');
    expect(screen.getByText('aba-anamnese')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'editar-anamnese' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Fotos' }));
    expect(screen.getByText('aba-fotos:p1:false')).toBeInTheDocument();
  });

  it('agendar abre o diálogo com o paciente pré-selecionado', async () => {
    renderAt();
    await userEvent.click(screen.getByRole('button', { name: 'agendar' }));
    expect(dialog.openAppointmentDialog).toHaveBeenCalledWith({ patientId: 'p1' });
  });

  it('Voltar leva à lista com a ficha em destaque', async () => {
    renderAt();
    await userEvent.click(screen.getByRole('button', { name: 'Voltar para pacientes' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/pacientes?ficha=p1');
  });
});
