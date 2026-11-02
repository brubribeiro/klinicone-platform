import dayjs from 'dayjs';

import type { MetricsResult } from '../../api/metrics';
import type { FinancialEntry } from '../../types';
import { DAY_LABELS, TABS, type MetricsTab } from './metricsConfig';
import { buildDailyFlow, returnRatePct, summarizeFinance, summarizeKpis } from './metricsUtils';

export const METRICS_CSV_HEADERS = ['Seção', 'Item', 'Indicador', 'Valor'];

type CsvRow = { Seção: string; Item: string; Indicador: string; Valor: string | number };

const money = (v: number) => Number(v).toFixed(2);
const pct = (v: number) => Number(v).toFixed(1);

/**
 * Linhas do CSV de /metricas em formato longo (Seção · Item · Indicador · Valor): período, KPIs do topo
 * (atual e anterior) e as séries da aba ativa. Valores numéricos sem formatação (dinheiro com 2 casas, % com 1).
 */
export function buildMetricsCsvRows({
  tab,
  dateFrom,
  dateTo,
  data,
  previous,
  financeEntries,
}: {
  tab: MetricsTab;
  dateFrom: string;
  dateTo: string;
  data: MetricsResult;
  previous: MetricsResult | undefined;
  financeEntries: FinancialEntry[];
}): CsvRow[] {
  const rows: CsvRow[] = [];
  const add = (section: string, item: string, indicator: string, value: string | number) =>
    rows.push({ Seção: section, Item: item, Indicador: indicator, Valor: value });

  add('Período', 'De', '', dayjs(dateFrom).format('DD/MM/YYYY'));
  add('Período', 'Até', '', dayjs(dateTo).format('DD/MM/YYYY'));
  add('Período', 'Aba', '', TABS.find((t) => t.value === tab)?.label ?? tab);

  const cur = summarizeKpis(data);
  const prev = previous ? summarizeKpis(previous) : null;
  const kpis: [string, keyof typeof cur, (v: number) => string][] = [
    ['Receita de procedimentos (R$)', 'revenue', money],
    ['Ticket médio (R$)', 'ticket', money],
    ['Taxa de retorno (%)', 'returnRate', pct],
    ['No-show (%)', 'noShowRate', pct],
  ];
  kpis.forEach(([label, key, fmt]) => {
    add('Resumo', label, 'Período atual', fmt(cur[key]));
    if (prev) add('Resumo', label, 'Período anterior', fmt(prev[key]));
  });

  if (tab === 'appointments') {
    const a = data.appointments;
    const s = 'Agendamentos';
    add(s, 'Total', 'Quantidade', a.total);
    add(s, 'Concluídos', 'Quantidade', a.completed);
    add(s, 'Confirmados', 'Quantidade', a.confirmed);
    add(s, 'Agendados', 'Quantidade', a.scheduled);
    add(s, 'Cancelados', 'Quantidade', a.cancelled);
    add(s, 'Faltas', 'Quantidade', a.noShow);
    add(s, 'Taxa de conclusão (%)', '', a.completionRate);
    add(s, 'Taxa de cancelamento (%)', '', a.cancellationRate);
    add(s, 'Taxa de faltas (%)', '', a.noShowRate);
    a.byDayOfWeek.forEach((d) => add('Por dia da semana', DAY_LABELS[d.day], 'Agendamentos', d.total));
    a.byHour.forEach((h) => add('Por horário', `${h.hour}:00`, 'Agendamentos', h.total));
    a.byProfessional.forEach((p) => {
      add('Por profissional', p.name, 'Agendamentos', p.total);
      add('Por profissional', p.name, 'Concluídos', p.completed);
    });
    a.byProcedure.forEach((p) => {
      add('Por procedimento', p.name, 'Agendamentos', p.total);
      add('Por procedimento', p.name, 'Receita (R$)', money(p.revenue));
    });
    a.procedureCombos.forEach((c) => add('Combos de procedimentos', c.procedures, 'Pacientes', c.count));
  }

  if (tab === 'patients') {
    const p = data.patients;
    const s = 'Pacientes';
    add(s, 'Total cadastrados', 'Quantidade', p.totalActive);
    add(s, 'Novos no período', 'Quantidade', p.newInPeriod);
    add(s, 'Atendidos no período', 'Quantidade', p.uniqueInPeriod);
    add(s, 'Retornaram', 'Quantidade', p.returningInPeriod);
    add(s, 'Taxa de retorno (%)', '', pct(returnRatePct(p)));
    add(s, 'Média de idade (anos)', '', p.averageAge ?? '');
    add(s, 'Procedimentos por paciente', 'Média', p.averageProceduresPerPatient);
    p.topPatients.forEach((t) => add('Pacientes com mais agendamentos', t.name, 'Agendamentos', t.appointments));
    p.topLocations.forEach((l) => add('Localidades (CEP)', l.location, 'Pacientes', l.count));
  }

  if (tab === 'procedures') {
    const p = data.procedures;
    const s = 'Procedimentos';
    add(s, 'No catálogo', 'Quantidade', p.totalCatalog);
    add(s, 'Ativos no catálogo', 'Quantidade', p.activeCatalog);
    add(s, 'Realizados', 'Quantidade', p.totalPerformed);
    add(s, 'Diferentes realizados', 'Quantidade', p.uniquePerformed);
    add(s, 'Duração média (min)', '', p.averageDuration);
    add(s, 'Preço médio (R$)', '', money(p.averagePrice));
    if (p.averageRealDuration != null) add(s, 'Tempo real médio (min)', '', p.averageRealDuration);
    p.ranking.forEach((r) => {
      add('Ranking', r.name, 'Realizados', r.count);
      add('Ranking', r.name, 'Receita (R$)', money(r.revenue));
      add('Ranking', r.name, 'Duração média (min)', r.avgDuration);
    });
    p.byProfessional.forEach((r) => add('Por profissional', `${r.procedure} · ${r.professional}`, 'Realizados', r.count));
    p.byMonth.forEach((m) => add('Evolução mensal', m.month, 'Realizados', m.count));
    p.durationByProcedure.forEach((d) => {
      add('Tempo real por procedimento', d.name, 'Média (min)', d.avgMinutes);
      add('Tempo real por procedimento', d.name, 'Atendimentos', d.count);
    });
    p.durationByProfessional.forEach((d) => {
      add('Tempo real por profissional', d.name, 'Média (min)', d.avgMinutes);
      add('Tempo real por profissional', d.name, 'Atendimentos', d.count);
    });
    p.materialCost.forEach((m) => {
      add('Margem por procedimento', m.name, 'Preço (R$)', money(m.price));
      add('Margem por procedimento', m.name, 'Custo de materiais (R$)', money(m.baseCost));
      add('Margem por procedimento', m.name, 'Margem (R$)', money(m.margin));
    });
  }

  if (tab === 'packages') {
    const p = data.packages;
    const s = 'Pacotes';
    add(s, 'Vendidos no período', 'Quantidade', p.totalSold);
    add(s, 'Receita no período (R$)', '', money(p.totalRevenue));
    add(s, 'Ativos (todos os períodos)', 'Quantidade', p.activeCount);
    add(s, 'Concluídos', 'Quantidade', p.completedCount);
    add(s, 'Sessões consumidas', 'Quantidade', p.sessionsUsed);
    add(s, 'Sessões contratadas', 'Quantidade', p.sessionsTotal);
    add(s, 'Taxa de conclusão (%)', '', p.completionRate);
    p.topPackages.forEach((t) => {
      add('Pacotes mais vendidos', t.name, 'Vendidos', t.sold);
      add('Pacotes mais vendidos', t.name, 'Receita (R$)', money(t.revenue));
    });
  }

  if (tab === 'finance') {
    const { income, expense, categoryRows } = summarizeFinance(financeEntries);
    const s = 'Financeiro';
    add(s, 'Receitas (R$)', '', money(income));
    add(s, 'Despesas (R$)', '', money(expense));
    add(s, 'Saldo (R$)', '', money(income - expense));
    buildDailyFlow(financeEntries).forEach((d) => {
      const day = dayjs(d.key).format('DD/MM/YYYY');
      add('Fluxo diário', day, 'Receita (R$)', money(d.receita));
      add('Fluxo diário', day, 'Despesa (R$)', money(d.despesa));
    });
    categoryRows.forEach((c) => add('Receita por categoria', c.name, 'Receita (R$)', money(c.value)));
  }

  return rows;
}
