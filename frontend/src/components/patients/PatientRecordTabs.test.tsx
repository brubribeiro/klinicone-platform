import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PatientAppointmentsTab } from './PatientAppointmentsTab';
import { PatientDrawerAppointmentsTab } from './PatientDrawerAppointmentsTab';
import { PatientDrawerSummaryTab } from './PatientDrawerSummaryTab';
import { PatientOverviewTab } from './PatientOverviewTab';
import { PatientSummarySidebar } from './PatientSummarySidebar';
import { PatientDrawerHeader } from './PatientDrawerHeader';
import type { PatientWithHistory } from '../../api/patients';
import type { Appointment } from '../../types';

const hook = vi.hoisted(() => ({ data: [] as unknown[] }));
vi.mock('../../hooks/useAnamnesisQuestions', () => ({ useAnamnesisQuestions: () => ({ data: hook.data }) }));
const access = vi.hoisted(() => ({ value: { showDocuments: false, showFinance: false } }));
vi.mock('./usePatientRecordAccess', () => ({ usePatientRecordAccess: () => access.value }));

// Horários sem fuso (locais) para a formatação independer do TZ da máquina
const appt = (o: Partial<Appointment> & { id: string; startAt: string }) =>
  ({ status: 'COMPLETED', kind: 'PROCEDURE', ...o }) as unknown as Appointment;

beforeEach(() => {
  hook.data = [];
  access.value = { showDocuments: false, showFinance: false };
});
afterEach(() => { vi.useRealTimers(); });

describe('PatientAppointmentsTab', () => {
  const list = Array.from({ length: 8 }, (_, i) =>
    appt({
      id: `a${i}`,
      startAt: `2026-01-${String(i + 10).padStart(2, '0')}T10:00:00`,
      procedure: { name: `Proc ${i}`, price: 100 } as Appointment['procedure'],
      ...(i === 0
        ? { financialEntries: [{ amount: 250, paymentMethod: { name: 'Pix' } }] as unknown as Appointment['financialEntries'], notes: 'Obs admin', clinicalNotes: 'Nota clínica' }
        : {}),
    }),
  );

  it('estado vazio sem agendamentos', () => {
    render(<PatientAppointmentsTab appointments={[]} />);
    expect(screen.getByText('Nenhum agendamento registrado.')).toBeInTheDocument();
  });

  it('pagina, ordena e filtra por pagamento', async () => {
    render(<PatientAppointmentsTab appointments={list} />);
    expect(screen.getByText('1–6 de 8')).toBeInTheDocument();
    // mais recentes primeiro
    expect(screen.getByText('Proc 7')).toBeInTheDocument();
    expect(screen.queryByText('Proc 0')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Próxima página' }));
    expect(screen.getByText('7–8 de 8')).toBeInTheDocument();
    expect(screen.getByText('Proc 0')).toBeInTheDocument();
    expect(screen.getByText('via Pix')).toBeInTheDocument();
    expect(screen.getByText(/OBSERVAÇÃO:/)).toBeInTheDocument();
    expect(screen.getByText('Nota clínica')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*250,00/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Mais recentes' }));
    expect(screen.getByRole('button', { name: 'Mais antigos' })).toBeInTheDocument();
    expect(screen.getByText('1–6 de 8')).toBeInTheDocument();
    expect(screen.getByText('Proc 0')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Pago' }));
    expect(screen.getByText('Proc 0')).toBeInTheDocument();
    expect(screen.queryByText('Proc 1')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Não pago' }));
    expect(screen.queryByText('Proc 0')).not.toBeInTheDocument();
    expect(screen.getByText('1–6 de 7')).toBeInTheDocument();
  });

  it('mensagem específica quando o filtro não tem resultado', async () => {
    render(<PatientAppointmentsTab appointments={[appt({ id: 'z', startAt: '2026-01-01T10:00:00', kind: 'RETURN' })]} />);
    expect(screen.getByText('Retorno')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Pago' }));
    expect(screen.getByText('Nenhum agendamento com esse filtro.')).toBeInTheDocument();
  });
});

describe('PatientDrawerAppointmentsTab', () => {
  it('vazio e com cartões', () => {
    const { rerender } = render(<PatientDrawerAppointmentsTab appointments={undefined} />);
    expect(screen.getByText('Nenhum agendamento registrado.')).toBeInTheDocument();
    rerender(
      <PatientDrawerAppointmentsTab
        appointments={[
          appt({ id: '1', startAt: '2026-02-03T14:30:00', procedure: { name: 'Botox', price: '900' } as Appointment['procedure'], professional: { name: 'Dra. Mila' } as Appointment['professional'], clinicalNotes: ' Sensível ' }),
          appt({ id: '2', startAt: '2026-02-04T09:00:00', kind: 'EVALUATION' }),
        ]}
      />,
    );
    expect(screen.getByText('Botox')).toBeInTheDocument();
    expect(screen.getByText(/03\/02\/2026 às 14:30 · Dra\. Mila/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*900,00/)).toBeInTheDocument();
    expect(screen.getByText('Sensível')).toBeInTheDocument();
    expect(screen.getByText('Avaliação')).toBeInTheDocument();
  });
});

const patient = {
  id: 'p1', name: 'Maria Souza', phone: '11988887777', email: 'maria@x.com', document: '529.982.247-25',
  birthDate: '1990-05-20', sex: 'F', visits: 3, totalSpent: 1200, lastVisit: '2026-03-10T15:00:00',
  notes: ' Prefere manhã ', addressStreet: 'Rua A', addressNumber: '10', addressCity: 'Sorocaba', addressState: 'SP',
  referralSource: 'INSTAGRAM', appointments: [],
} as unknown as PatientWithHistory;

describe('PatientDrawerSummaryTab', () => {
  it('mostra números, contato e observações', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
    render(<PatientDrawerSummaryTab patient={patient} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*1\.200,00/)).toBeInTheDocument();
    expect(screen.getByText('(11) 98888-7777')).toBeInTheDocument();
    expect(screen.getByText('maria@x.com')).toBeInTheDocument();
    expect(screen.getByText(/20\/05\/1990 \(36 anos\)/)).toBeInTheDocument();
    expect(screen.getByText(/Rua A/)).toBeInTheDocument();
    expect(screen.getByText('Prefere manhã')).toBeInTheDocument();
  });

  it('omite campos vazios', () => {
    render(<PatientDrawerSummaryTab patient={{ id: 'x', name: 'Sem dados' } as PatientWithHistory} />);
    expect(screen.queryByText('CPF')).not.toBeInTheDocument();
    expect(screen.queryByText('Observações')).not.toBeInTheDocument();
    expect(screen.getByText('visitas')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('PatientOverviewTab', () => {
  const now = new Date('2026-06-01T12:00:00');
  const appts = [
    appt({ id: 'f', startAt: '2026-07-01T10:00:00', status: 'SCHEDULED', procedure: { name: 'Retoque' } as Appointment['procedure'] }),
    appt({ id: 'c', startAt: '2026-06-10T10:00:00', status: 'CANCELLED', procedure: { name: 'Cancelado' } as Appointment['procedure'] }),
    appt({ id: 'p', startAt: '2026-05-20T10:00:00', status: 'COMPLETED', procedure: { name: 'Peeling' } as Appointment['procedure'] }),
  ];

  it('destaca próximo e último atendimento e alertas da anamnese', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    hook.data = [
      { key: 'gestante', label: 'Gestante', type: 'BOOLEAN', active: true },
      { key: 'herpes', label: 'Herpes', type: 'BOOLEAN', active: true },
      { key: 'velha', label: 'Antiga', type: 'BOOLEAN', active: false },
    ];
    render(
      <PatientOverviewTab
        patient={{ ...patient, appointments: appts, anamnesis: { gestante: true, herpes: false, velha: true, alergiasOutras: 'Látex', alergiaCosmeticos: '  ' } } as unknown as PatientWithHistory}
        activePackagesCount={2}
      />,
    );
    expect(screen.getByText(/01\/07\/2026 às 10:00/)).toBeInTheDocument();
    expect(screen.getByText('Retoque')).toBeInTheDocument();
    expect(screen.getByText('20/05/2026')).toBeInTheDocument();
    expect(screen.getByText('Peeling')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Gestante')).toBeInTheDocument();
    expect(screen.queryByText('Herpes')).not.toBeInTheDocument();
    expect(screen.queryByText('Antiga')).not.toBeInTheDocument();
    expect(screen.getByText('Outras alergias: Látex')).toBeInTheDocument();
    expect(screen.queryByText(/Alergia a cosméticos/)).not.toBeInTheDocument();
    expect(screen.getByText('Prefere manhã')).toBeInTheDocument();
  });

  it('mostra aviso quando não há nada a exibir', () => {
    render(<PatientOverviewTab patient={{ id: 'x', name: 'N', appointments: [] } as unknown as PatientWithHistory} activePackagesCount={0} />);
    expect(screen.getByText('Sem informações adicionais para exibir.')).toBeInTheDocument();
  });
});

describe('PatientSummarySidebar', () => {
  it('mostra dados, score e aciona Agendar', async () => {
    const onSchedule = vi.fn();
    render(
      <PatientSummarySidebar patient={patient} reliability={{ reliabilityPercent: 95 } as never} onSchedule={onSchedule} />,
    );
    expect(screen.getByText('Maria Souza')).toBeInTheDocument();
    expect(screen.getByText('Excelente')).toBeInTheDocument();
    expect(screen.getByText('529.982.247-25')).toBeInTheDocument();
    expect(screen.getByText('maria@x.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir WhatsApp de Maria Souza' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Agendar' }));
    expect(onSchedule).toHaveBeenCalled();
  });

  it('sem telefone nem score não mostra WhatsApp/badge', () => {
    render(<PatientSummarySidebar patient={{ id: 'x', name: 'Ana' } as PatientWithHistory} onSchedule={() => {}} />);
    expect(screen.queryByRole('button', { name: /WhatsApp/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Excelente')).not.toBeInTheDocument();
  });
});

describe('PatientDrawerHeader', () => {
  it('mostra abas conforme acesso e troca de aba', async () => {
    const onTabChange = vi.fn();
    const { rerender } = render(
      <PatientDrawerHeader patient={patient} reliability={{ reliabilityPercent: 70 } as never} tab="general" onTabChange={onTabChange} />,
    );
    expect(screen.getByText('Ficha do paciente')).toBeInTheDocument();
    expect(screen.getByText('(11) 98888-7777')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Documentos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Financeiro' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Anamnese' }));
    expect(onTabChange).toHaveBeenCalledWith('anamnesis');

    access.value = { showDocuments: true, showFinance: true };
    rerender(<PatientDrawerHeader patient={patient} tab="finance" onTabChange={onTabChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Documentos' }));
    expect(onTabChange).toHaveBeenLastCalledWith('documents');
    expect(within(document.body).getByRole('button', { name: 'Financeiro' })).toBeInTheDocument();
  });
});
