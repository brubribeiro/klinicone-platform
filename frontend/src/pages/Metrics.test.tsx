import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { financeApi } from '../api/finance';
import { metricsApi, type MetricsResult } from '../api/metrics';
import type { FinancialEntry } from '../types';
import { downloadCsv } from '../utils/csv';
import { Metrics } from './Metrics';

vi.mock('../api/metrics', () => ({ metricsApi: { get: vi.fn() } }));
vi.mock('../api/finance', () => ({ financeApi: { list: vi.fn() } }));
vi.mock('../utils/csv', () => ({ downloadCsv: vi.fn() }));

const auth = vi.hoisted(() => ({ permissions: [] as string[] }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'Ana', permissions: auth.permissions } }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), showToast: vi.fn() }));
vi.mock('../contexts/AppToastContext', () => ({ useAppToast: () => toast }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const current: MetricsResult = {
  appointments: {
    total: 20,
    completed: 14,
    cancelled: 3,
    noShow: 2,
    scheduled: 1,
    confirmed: 0,
    completionRate: 70,
    noShowRate: 10,
    cancellationRate: 15,
    byProfessional: [
      { name: 'Ana Souza', total: 12, completed: 9 },
      { name: 'Dr. Bruno Costa', total: 8, completed: 5 },
    ],
    byProcedure: [
      { name: 'Limpeza de pele', total: 12, revenue: 2000 },
      { name: 'Peeling', total: 8, revenue: 1500 },
    ],
    procedureCombos: [{ procedures: 'Limpeza de pele + Peeling', count: 1 }],
    byDayOfWeek: [
      { day: 1, total: 9 },
      { day: 3, total: 11 },
    ],
    byHour: [
      { hour: 9, total: 6 },
      { hour: 14, total: 14 },
    ],
  },
  patients: {
    totalActive: 120,
    newInPeriod: 4,
    returningInPeriod: 6,
    uniqueInPeriod: 10,
    averageAge: 34,
    averageProceduresPerPatient: 2.5,
    topPatients: [
      { name: 'Maria Silva', appointments: 5 },
      { name: 'Joana Lima', appointments: 3 },
    ],
    topLocations: [{ location: '18035-000', count: 7 }],
  },
  procedures: {
    totalCatalog: 15,
    activeCatalog: 12,
    totalPerformed: 14,
    uniquePerformed: 2,
    averageDuration: 50,
    averagePrice: 175,
    ranking: [
      { name: 'Peeling', count: 6, revenue: 1500, avgDuration: 40 },
      { name: 'Limpeza de pele', count: 8, revenue: 2000, avgDuration: 60 },
    ],
    byProfessional: [
      { procedure: 'Limpeza de pele', professional: 'Ana Souza', count: 8 },
      { procedure: 'Peeling', professional: 'Dr. Bruno Costa', count: 6 },
    ],
    byMonth: [
      { month: '2026-09', count: 10 },
      { month: '2026-10', count: 12 },
    ],
    materialCost: [{ name: 'Limpeza de pele', baseCost: 40, price: 250, margin: 84 }],
    averageRealDuration: 55,
    durationByProcedure: [{ name: 'Limpeza de pele', avgMinutes: 65, count: 8 }],
    durationByProfessional: [{ name: 'Ana Souza', avgMinutes: 52, count: 9 }],
  },
  packages: {
    totalSold: 3,
    totalRevenue: 4500,
    activeCount: 5,
    completedCount: 1,
    sessionsUsed: 12,
    sessionsTotal: 30,
    completionRate: 40,
    topPackages: [
      { name: 'Pacote Rejuvenescimento', sold: 2, revenue: 3000 },
      { name: 'Pacote Noiva', sold: 1, revenue: 1500 },
    ],
  },
};

const previous: MetricsResult = {
  ...current,
  appointments: {
    ...current.appointments,
    completed: 10,
    noShowRate: 15,
    byProcedure: [{ name: 'Limpeza de pele', total: 10, revenue: 2800 }],
  },
  patients: { ...current.patients, returningInPeriod: 4, uniqueInPeriod: 10 },
};

const entries: FinancialEntry[] = [
  { id: 'f1', type: 'INCOME', description: 'Limpeza', amount: 1000, category: 'Atendimentos', paidAt: '2026-11-02T15:00:00.000Z' },
  { id: 'f2', type: 'INCOME', description: 'Pacote', amount: 500, category: 'Pacotes', paidAt: '2026-11-03T15:00:00.000Z' },
  { id: 'f3', type: 'EXPENSE', description: 'Aluguel', amount: 3000, dueDate: '2026-11-03T15:00:00.000Z' },
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Metrics />
    </QueryClientProvider>,
  );
}

const money = (n: string) => new RegExp(`R\\$\\s${n.replace(/\./g, '\\.')}`);
const card = (label: string) => screen.getByText(label).closest('.MuiCard-root') as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 4, 10, 0, 0)); // 04/11/2026
  vi.clearAllMocks();
  auth.permissions = ['finance:view'];
  mocked(metricsApi.get).mockImplementation(async (from: string) => (from === '2026-11-01' ? current : previous));
  mocked(financeApi.list).mockResolvedValue(entries);
  mocked(downloadCsv).mockReturnValue(true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Metrics page', () => {
  it('consulta o mês corrente e o período anterior de mesma duração', async () => {
    renderPage();
    await screen.findByText('Receita de procedimentos');
    await waitFor(() => expect(metricsApi.get).toHaveBeenCalledWith('2026-10-28', '2026-10-31'));
    expect(metricsApi.get).toHaveBeenCalledWith('2026-11-01', '2026-11-04');
    expect(screen.getByLabelText('De')).toHaveValue('2026-11-01');
    expect(screen.getByLabelText('Até')).toHaveValue('2026-11-04');
    expect(screen.getByText('4', { selector: 'span' })).toBeInTheDocument();
  });

  it('mostra os KPIs do topo com variação contra o período anterior', async () => {
    renderPage();
    await waitFor(() => expect(within(card('Receita de procedimentos')).getByText(money('3.500,00'))).toBeInTheDocument());
    // 3500 vs 2800 = +25%
    await waitFor(() => expect(within(card('Receita de procedimentos')).getByText('+25%')).toBeInTheDocument());
    expect(within(card('Ticket médio')).getByText(money('250,00'))).toBeInTheDocument(); // 3500 / 14
    expect(within(card('Ticket médio')).getByText('−10,7%')).toBeInTheDocument(); // vs 2800 / 10
    // retorno: 6/10 = 60% vs 40% => +20 p.p.
    expect(within(card('Taxa de retorno')).getByText('60%')).toBeInTheDocument();
    expect(within(card('Taxa de retorno')).getByText('+20 p.p.')).toBeInTheDocument();
    // no-show caiu de 15% para 10%
    expect(within(card('No-show')).getByText('10%')).toBeInTheDocument();
    expect(within(card('No-show')).getByText('−5 p.p.')).toBeInTheDocument();
  });

  it('aba Agendamentos mostra totais, rankings e distribuição', async () => {
    renderPage();
    expect(await screen.findByText('Total de agendamentos')).toBeInTheDocument();
    expect(screen.getByText('70% do total')).toBeInTheDocument();
    expect(screen.getByText('15% do total')).toBeInTheDocument();
    expect(screen.getByText('Agendamentos por dia da semana')).toBeInTheDocument();
    expect(screen.getByText('Distribuição por status')).toBeInTheDocument();
    expect(screen.getAllByText('Concluídos').length).toBeGreaterThan(1); // card de totais e legenda do status
    expect(screen.getAllByText('Faltas').length).toBeGreaterThan(1);
    expect(screen.queryByText('Confirmados')).not.toBeInTheDocument(); // zero não aparece
    expect(screen.getByText('9 concluídos')).toBeInTheDocument();
    expect(screen.getByText('Limpeza de pele + Peeling')).toBeInTheDocument();
    expect(screen.getByText('1 paciente')).toBeInTheDocument();
    expect(screen.getByText('Agendamentos por horário')).toBeInTheDocument();
  });

  it('aba Pacientes', async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Pacientes' }));
    expect(await screen.findByText('Total cadastrados')).toBeInTheDocument();
    expect(screen.getByText('34 anos')).toBeInTheDocument();
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByText('18035-000')).toBeInTheDocument();
    expect(screen.getByText('Retenção')).toBeInTheDocument();
  });

  it('aba Pacientes mostra estados vazios', async () => {
    mocked(metricsApi.get).mockResolvedValue({
      ...current,
      patients: { ...current.patients, averageAge: null, uniqueInPeriod: 0, topPatients: [], topLocations: [] },
    });
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Pacientes' }));
    expect(await screen.findByText('Nenhum paciente com CEP cadastrado.')).toBeInTheDocument();
    expect(screen.getAllByText('Sem dados no período.')).toHaveLength(2);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('aba Procedimentos ordena por receita e mostra tempo real e margem', async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Procedimentos' }));
    expect(await screen.findByText('Receita por procedimento')).toBeInTheDocument();
    expect(screen.getByText('50 min')).toBeInTheDocument();
    expect(screen.getByText('Tempo real de atendimento')).toBeInTheDocument();
    expect(screen.getByText(/Média geral: 55 min/)).toBeInTheDocument();
    expect(screen.getByText('65 min')).toBeInTheDocument();
    expect(screen.getByText('Margem por procedimento')).toBeInTheDocument();
    expect(screen.getByText('Evolução mensal de procedimentos')).toBeInTheDocument();
    const names = screen.getAllByText(/^(Limpeza de pele|Peeling)$/).map((e) => e.textContent);
    expect(names.indexOf('Limpeza de pele')).toBeLessThan(names.indexOf('Peeling'));
  });

  it('aba Procedimentos sem dados de duração/margem não renderiza essas seções', async () => {
    mocked(metricsApi.get).mockResolvedValue({
      ...current,
      procedures: {
        ...current.procedures,
        ranking: [],
        byProfessional: [],
        byMonth: [],
        materialCost: [],
        averageRealDuration: null,
        durationByProcedure: [],
        durationByProfessional: [],
      },
    });
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Procedimentos' }));
    expect(await screen.findByText('Receita por procedimento')).toBeInTheDocument();
    expect(screen.queryByText('Tempo real de atendimento')).not.toBeInTheDocument();
    expect(screen.queryByText('Margem por procedimento')).not.toBeInTheDocument();
  });

  it('aba Pacotes ordena vendas e receita', async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Pacotes' }));
    expect(await screen.findByText('Pacotes vendidos')).toBeInTheDocument();
    expect(screen.getByText('12/30')).toBeInTheDocument();
    expect(screen.getByText('40% concluído')).toBeInTheDocument();
    expect(screen.getByText(money('4.500,00'))).toBeInTheDocument();
    expect(screen.getByText('Pacotes mais vendidos')).toBeInTheDocument();
    expect(screen.getByText('Receita por pacote')).toBeInTheDocument();
    expect(screen.getAllByText('Pacote Rejuvenescimento')).toHaveLength(2);
  });

  it('aba Pacotes vazia', async () => {
    mocked(metricsApi.get).mockResolvedValue({ ...current, packages: { ...current.packages, topPackages: [] } });
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Pacotes' }));
    expect(await screen.findByText('Nenhum pacote vendido no período selecionado.')).toBeInTheDocument();
  });

  it('aba Financeiro soma receitas, despesas e saldo e agrupa receita por categoria', async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Financeiro' }));
    expect(await screen.findByText('lançamentos de entrada')).toBeInTheDocument();
    expect(financeApi.list).toHaveBeenCalledWith(new Date(2026, 10, 1).toISOString(), new Date(2026, 10, 4, 23, 59, 59, 999).toISOString());
    const stat = (hint: string) => within(screen.getByText(hint).parentElement as HTMLElement);
    expect(stat('lançamentos de entrada').getByText(money('1.500,00'))).toBeInTheDocument();
    expect(stat('lançamentos de saída').getByText(money('3.000,00'))).toBeInTheDocument();
    expect(stat('resultado negativo').getByText(/-.*R\$\s1\.500,00|R\$\s-1\.500,00/)).toBeInTheDocument();
    expect(screen.getByText('resultado negativo')).toBeInTheDocument();
    expect(screen.getByText('Atendimentos')).toBeInTheDocument();
    expect(screen.getAllByText('Pacotes')).toHaveLength(2); // aba + categoria
    expect(screen.getByText('Fluxo diário no período')).toBeInTheDocument();
  });

  it('aba Financeiro vazia', async () => {
    mocked(financeApi.list).mockResolvedValue([]);
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Financeiro' }));
    expect(await screen.findByText('Nenhum lançamento financeiro no período selecionado.')).toBeInTheDocument();
  });

  it('sem permissão financeira esconde a aba e não consulta lançamentos', async () => {
    auth.permissions = [];
    renderPage();
    await screen.findByText('Total de agendamentos');
    expect(screen.queryByRole('button', { name: 'Financeiro' })).not.toBeInTheDocument();
    expect(financeApi.list).not.toHaveBeenCalled();
  });

  it('trocar o período refaz a consulta e recalcula os dias', async () => {
    renderPage();
    await screen.findByText('Total de agendamentos');
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-10-01' } });
    await waitFor(() => expect(metricsApi.get).toHaveBeenCalledWith('2026-10-01', '2026-11-04'));
    // 35 dias -> período anterior termina em 30/09
    expect(metricsApi.get).toHaveBeenCalledWith('2026-08-27', '2026-09-30');
    expect(screen.getByText('35', { selector: 'span' })).toBeInTheDocument();
  });

  it('período invertido mostra aviso, não consulta e desabilita a exportação', async () => {
    renderPage();
    await screen.findByText('Total de agendamentos');
    vi.mocked(metricsApi.get).mockClear();
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-10-20' } });
    expect(await screen.findByText(/data inicial não pode ser posterior à final/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled();
    expect(metricsApi.get).not.toHaveBeenCalled();
  });

  it('mostra erro quando a API de métricas falha', async () => {
    mocked(metricsApi.get).mockRejectedValue(new Error('500'));
    renderPage();
    expect(await screen.findByText(/Erro ao carregar métricas/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled();
  });

  it('exporta o CSV da aba ativa com o período no nome do arquivo', async () => {
    renderPage();
    const user = userEvent.setup();
    const exportBtn = await screen.findByRole('button', { name: 'Exportar CSV' });
    await waitFor(() => expect(exportBtn).toBeEnabled());
    await user.click(exportBtn);
    expect(downloadCsv).toHaveBeenCalledTimes(1);
    const [file, rows, headers] = mocked(downloadCsv).mock.calls[0];
    expect(file).toBe('metricas-agendamentos-2026-11-01_2026-11-04.csv');
    expect(headers).toEqual(['Seção', 'Item', 'Indicador', 'Valor']);
    expect(rows).toContainEqual({ Seção: 'Resumo', Item: 'Receita de procedimentos (R$)', Indicador: 'Período atual', Valor: '3500.00' });
    expect(rows).toContainEqual({ Seção: 'Resumo', Item: 'Receita de procedimentos (R$)', Indicador: 'Período anterior', Valor: '2800.00' });
    expect(rows).toContainEqual({ Seção: 'Por dia da semana', Item: 'Qua', Indicador: 'Agendamentos', Valor: 11 });
  });

  it('exporta o CSV da aba Financeiro com saldo calculado', async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Financeiro' }));
    await screen.findByText('lançamentos de entrada');
    const exportBtn = screen.getByRole('button', { name: 'Exportar CSV' });
    await waitFor(() => expect(exportBtn).toBeEnabled());
    await user.click(exportBtn);
    const [file, rows] = mocked(downloadCsv).mock.calls[0];
    expect(file).toBe('metricas-financeiro-2026-11-01_2026-11-04.csv');
    expect(rows).toContainEqual({ Seção: 'Financeiro', Item: 'Saldo (R$)', Indicador: '', Valor: '-1500.00' });
  });

  it('avisa quando não há nada para exportar', async () => {
    mocked(downloadCsv).mockReturnValue(false);
    renderPage();
    const user = userEvent.setup();
    const exportBtn = await screen.findByRole('button', { name: 'Exportar CSV' });
    await waitFor(() => expect(exportBtn).toBeEnabled());
    await user.click(exportBtn);
    expect(toast.info).toHaveBeenCalledWith('Nenhuma métrica para exportar.');
  });
});
