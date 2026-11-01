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
