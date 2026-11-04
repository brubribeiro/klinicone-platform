import { describe, it, expect } from 'vitest';

import type { MetricsResult } from '../../api/metrics';
import type { FinancialEntry } from '../../types';
import { buildMetricsCsvRows } from './metricsCsv';

const data: MetricsResult = {
  appointments: {
    total: 10,
    completed: 8,
    cancelled: 1,
    noShow: 1,
    scheduled: 0,
    confirmed: 0,
    completionRate: 80,
    noShowRate: 10,
    cancellationRate: 10,
    byProfessional: [{ name: 'Mila', total: 10, completed: 8 }],
    byProcedure: [{ name: 'Limpeza', total: 10, revenue: 1600 }],
    procedureCombos: [],
    byDayOfWeek: [{ day: 1, total: 4 }],
    byHour: [{ hour: 9, total: 3 }],
  },
  patients: {
    totalActive: 50,
    newInPeriod: 5,
    returningInPeriod: 3,
    uniqueInPeriod: 6,
    averageAge: null,
    averageProceduresPerPatient: 1.5,
    topPatients: [],
    topLocations: [],
  },
  procedures: {
    totalCatalog: 0,
    activeCatalog: 0,
    totalPerformed: 0,
    uniquePerformed: 0,
    averageDuration: 0,
    averagePrice: 0,
    ranking: [],
    byProfessional: [],
    byMonth: [],
    materialCost: [],
    averageRealDuration: null,
    durationByProcedure: [],
    durationByProfessional: [],
  },
  packages: {
    totalSold: 0,
    totalRevenue: 0,
    activeCount: 0,
    completedCount: 0,
    sessionsUsed: 0,
    sessionsTotal: 0,
    completionRate: 0,
    topPackages: [],
  },
};

const base = { dateFrom: '2026-10-01', dateTo: '2026-10-31', data, previous: undefined, financeEntries: [] };

describe('buildMetricsCsvRows', () => {
  it('starts with the period and the summary KPIs', () => {
    const rows = buildMetricsCsvRows({ ...base, tab: 'appointments' });
    expect(rows.slice(0, 3).map((r) => r.Valor)).toEqual(['01/10/2026', '31/10/2026', 'Agendamentos']);
    expect(rows).toContainEqual({
      Seção: 'Resumo',
      Item: 'Receita de procedimentos (R$)',
      Indicador: 'Período atual',
      Valor: '1600.00',
    });
    expect(rows).toContainEqual({ Seção: 'Resumo', Item: 'Ticket médio (R$)', Indicador: 'Período atual', Valor: '200.00' });
    expect(rows.some((r) => r.Indicador === 'Período anterior')).toBe(false);
  });

  it('includes previous-period KPIs when available', () => {
    const rows = buildMetricsCsvRows({ ...base, tab: 'appointments', previous: data });
    expect(rows).toContainEqual({ Seção: 'Resumo', Item: 'No-show (%)', Indicador: 'Período anterior', Valor: '10.0' });
  });

  it('exports only the active tab series', () => {
    const rows = buildMetricsCsvRows({ ...base, tab: 'appointments' });
    expect(rows).toContainEqual({ Seção: 'Por dia da semana', Item: 'Seg', Indicador: 'Agendamentos', Valor: 4 });
    expect(rows.some((r) => r.Seção === 'Pacientes')).toBe(false);
  });

  it('summarizes finance entries on the finance tab', () => {
    const financeEntries = [
      { id: '1', type: 'INCOME', description: 'a', amount: '300', paidAt: '2026-10-05T12:00:00.000Z' },
      { id: '2', type: 'EXPENSE', description: 'b', amount: 120.5, dueDate: '2026-10-06T12:00:00.000Z' },
    ] as FinancialEntry[];
    const rows = buildMetricsCsvRows({ ...base, tab: 'finance', financeEntries });
    expect(rows).toContainEqual({ Seção: 'Financeiro', Item: 'Saldo (R$)', Indicador: '', Valor: '179.50' });
    expect(rows).toContainEqual({ Seção: 'Fluxo diário', Item: '06/10/2026', Indicador: 'Despesa (R$)', Valor: '120.50' });
  });
});

describe('buildMetricsCsvRows per tab', () => {
  const rich: MetricsResult = {
    ...data,
    patients: {
      ...data.patients,
      topPatients: [{ name: 'Maria Silva', appointments: 5 }],
      topLocations: [{ location: '18035-000', count: 7 }],
    },
    procedures: {
      ...data.procedures,
      totalCatalog: 15,
      activeCatalog: 12,
      averagePrice: 175.5,
      averageRealDuration: 55,
      ranking: [{ name: 'Peeling', count: 6, revenue: 1500, avgDuration: 40 }],
      byProfessional: [{ procedure: 'Peeling', professional: 'Ana', count: 6 }],
      byMonth: [{ month: '2026-10', count: 12 }],
      durationByProcedure: [{ name: 'Peeling', avgMinutes: 65, count: 6 }],
      durationByProfessional: [{ name: 'Ana', avgMinutes: 52, count: 9 }],
      materialCost: [{ name: 'Peeling', baseCost: 40, price: 250, margin: 84 }],
    },
    packages: {
      ...data.packages,
      totalSold: 3,
      totalRevenue: 4500,
      sessionsUsed: 12,
      sessionsTotal: 30,
      completionRate: 40,
      topPackages: [{ name: 'Noiva', sold: 2, revenue: 3000 }],
    },
  };

  it('patients: returns rate and rankings', () => {
    const rows = buildMetricsCsvRows({ ...base, data: rich, tab: 'patients' });
    expect(rows).toContainEqual({ Seção: 'Pacientes', Item: 'Taxa de retorno (%)', Indicador: '', Valor: '50.0' });
    expect(rows).toContainEqual({ Seção: 'Pacientes', Item: 'Média de idade (anos)', Indicador: '', Valor: '' });
    expect(rows).toContainEqual({ Seção: 'Pacientes com mais agendamentos', Item: 'Maria Silva', Indicador: 'Agendamentos', Valor: 5 });
    expect(rows).toContainEqual({ Seção: 'Localidades (CEP)', Item: '18035-000', Indicador: 'Pacientes', Valor: 7 });
    expect(rows.some((r) => r.Seção === 'Agendamentos')).toBe(false);
  });

  it('procedures: catalog, ranking, real duration and margin', () => {
    const rows = buildMetricsCsvRows({ ...base, data: rich, tab: 'procedures' });
    expect(rows).toContainEqual({ Seção: 'Procedimentos', Item: 'Preço médio (R$)', Indicador: '', Valor: '175.50' });
    expect(rows).toContainEqual({ Seção: 'Procedimentos', Item: 'Tempo real médio (min)', Indicador: '', Valor: 55 });
    expect(rows).toContainEqual({ Seção: 'Ranking', Item: 'Peeling', Indicador: 'Receita (R$)', Valor: '1500.00' });
    expect(rows).toContainEqual({ Seção: 'Por profissional', Item: 'Peeling · Ana', Indicador: 'Realizados', Valor: 6 });
    expect(rows).toContainEqual({ Seção: 'Evolução mensal', Item: '2026-10', Indicador: 'Realizados', Valor: 12 });
    expect(rows).toContainEqual({ Seção: 'Tempo real por procedimento', Item: 'Peeling', Indicador: 'Média (min)', Valor: 65 });
    expect(rows).toContainEqual({ Seção: 'Tempo real por profissional', Item: 'Ana', Indicador: 'Atendimentos', Valor: 9 });
    expect(rows).toContainEqual({ Seção: 'Margem por procedimento', Item: 'Peeling', Indicador: 'Margem (R$)', Valor: '84.00' });
  });

  it('procedures: omits real duration when unknown', () => {
    const rows = buildMetricsCsvRows({ ...base, tab: 'procedures' });
    expect(rows.some((r) => r.Item === 'Tempo real médio (min)')).toBe(false);
  });

  it('packages: sales, sessions and top packages', () => {
    const rows = buildMetricsCsvRows({ ...base, data: rich, tab: 'packages' });
    expect(rows).toContainEqual({ Seção: 'Pacotes', Item: 'Receita no período (R$)', Indicador: '', Valor: '4500.00' });
    expect(rows).toContainEqual({ Seção: 'Pacotes', Item: 'Sessões consumidas', Indicador: 'Quantidade', Valor: 12 });
    expect(rows).toContainEqual({ Seção: 'Pacotes mais vendidos', Item: 'Noiva', Indicador: 'Receita (R$)', Valor: '3000.00' });
  });

  it('appointments: lists professionals, procedures and the hourly series', () => {
    const rows = buildMetricsCsvRows({ ...base, tab: 'appointments' });
    expect(rows).toContainEqual({ Seção: 'Por horário', Item: '9:00', Indicador: 'Agendamentos', Valor: 3 });
    expect(rows).toContainEqual({ Seção: 'Por profissional', Item: 'Mila', Indicador: 'Concluídos', Valor: 8 });
    expect(rows).toContainEqual({ Seção: 'Por procedimento', Item: 'Limpeza', Indicador: 'Receita (R$)', Valor: '1600.00' });
  });
});
