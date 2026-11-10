import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { goalsApi } from '../api/goals';
import {
  clampProgress,
  formatGoalPeriod,
  formatGoalValue,
  goalStatus,
  goalSummary,
  metricOption,
  normalizePeriodStart,
} from '../components/goals/goalUtils';
import type { Goal } from '../types';
import { Goals } from './Goals';

vi.mock('../api/goals', () => ({
  goalsApi: { list: vi.fn(), preview: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), showToast: vi.fn() }));
const dialogs = vi.hoisted(() => ({ confirm: vi.fn(), alert: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: 'u', name: 'Ana', permissions: [] as string[] } }));
vi.mock('../contexts/AppToastContext', () => ({ useAppToast: () => toast }));
vi.mock('../contexts/AppDialogContext', () => ({ useAppDialog: () => dialogs }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const goal = (over: Partial<Goal>): Goal => ({
  id: 'g1',
  name: 'Faturamento mensal',
  metric: 'REVENUE',
  format: 'CURRENCY',
  target: 20000,
  manualValue: null,
  periodType: 'MONTH',
  periodStart: '2026-03-01',
  periodEnd: '2026-03-31',
  color: '#15998B',
  currentValue: 15000,
  progress: 75,
  ...over,
});

const goals: Goal[] = [
  goal({}),
  goal({ id: 'g2', name: 'Novos pacientes', metric: 'NEW_PATIENTS', format: 'NUMBER', target: 30, currentValue: 33, progress: 110 }),
  goal({ id: 'g3', name: 'Ocupação', metric: 'OCCUPANCY', format: 'PERCENT', target: 80, currentValue: 32.5, progress: 40.6, periodType: 'QUARTER', periodStart: '2026-01-01' }),
  goal({ id: 'g4', name: 'Meta da Ana', metric: 'MANUAL', format: 'NUMBER', manualValue: 9, currentValue: 9, target: 10, progress: 90, periodType: 'YEAR', periodStart: '2026-01-01' }),
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <Goals />
    </QueryClientProvider>,
  );
  return { invalidate };
}

const ALL = ['goals:create', 'goals:edit', 'goals:delete'];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 2, 15, 10, 0, 0));
  vi.clearAllMocks();
  auth.user.permissions = ALL;
  mocked(goalsApi.list).mockResolvedValue(goals);
  mocked(goalsApi.preview).mockResolvedValue({ currentValue: 12000 });
  mocked(goalsApi.create).mockResolvedValue(goals[0]);
  mocked(goalsApi.update).mockResolvedValue(goals[0]);
  mocked(goalsApi.remove).mockResolvedValue(undefined);
  dialogs.confirm.mockResolvedValue(true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('goalUtils', () => {
  it('formata valores por tipo, com casas decimais só quando necessário', () => {
    expect(formatGoalValue(1500, 'CURRENCY')).toMatch(/R\$\s?1\.500$/);
    expect(formatGoalValue(1500.5, 'CURRENCY')).toMatch(/R\$\s?1\.500,50$/);
    expect(formatGoalValue(12, 'NUMBER')).toBe('12');
    expect(formatGoalValue(32.54, 'PERCENT')).toBe('32,5%');
    expect(formatGoalValue(80, 'PERCENT')).toBe('80%');
  });

  it('normaliza o início do período e o rotula em português', () => {
    expect(normalizePeriodStart('2026-05-17', 'MONTH')).toBe('2026-05-01');
    expect(normalizePeriodStart('2026-05-17', 'QUARTER')).toBe('2026-04-01');
    expect(normalizePeriodStart('2026-05-17', 'YEAR')).toBe('2026-01-01');
    expect(formatGoalPeriod('2026-03-01', 'MONTH')).toBe('Março 2026');
    expect(formatGoalPeriod('2026-07-01', 'QUARTER')).toBe('3º trimestre 2026');
    expect(formatGoalPeriod('2026-01-01', 'YEAR')).toBe('Ano 2026');
  });

  it('classifica o status pelas faixas de progresso', () => {
    expect(goalStatus(100).label).toBe('Atingida');
    expect(goalStatus(95).label).toBe('Quase lá');
    expect(goalStatus(60).label).toBe('No caminho');
    expect(goalStatus(59.9).label).toBe('Atenção');
  });

  it('limita o progresso, resume as metas e cai em "manual" para indicador desconhecido', () => {
    expect(clampProgress(150)).toBe(100);
    expect(clampProgress(-5)).toBe(0);
    expect(goalSummary([])).toEqual({ total: 0, reached: 0, average: 0 });
    expect(goalSummary(goals)).toEqual({ total: 4, reached: 1, average: 76 });
    expect(metricOption('XYZ' as never).value).toBe('MANUAL');
  });
});

describe('Goals page', () => {
  it('mostra o resumo e os cartões de cada meta', async () => {
    renderPage();
    expect(await screen.findByText('Faturamento mensal')).toBeInTheDocument();
    const stat = (l: string) => screen.getByText(l).parentElement as HTMLElement;
    expect(within(stat('Metas ativas')).getByText('4')).toBeInTheDocument();
    expect(within(stat('Atingidas')).getByText('1')).toBeInTheDocument();
    expect(within(stat('Progresso médio')).getByText('76%')).toBeInTheDocument();
    expect(screen.getByText('4 metas')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?15\.000/)).toBeInTheDocument();
    expect(screen.getByText(/\/ R\$\s?20\.000/)).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getAllByText('Março 2026')).toHaveLength(2);
    expect(screen.getByText('1º trimestre 2026')).toBeInTheDocument();
    expect(screen.getByText('Atingida')).toBeInTheDocument();
    expect(screen.getByText('Quase lá')).toBeInTheDocument();
    expect(screen.getByText('No caminho')).toBeInTheDocument();
    expect(screen.getByText('Atenção')).toBeInTheDocument();
    expect(screen.getByText('32,5%')).toBeInTheDocument();
    expect(screen.getByText(/Ano 2026 · manual/)).toBeInTheDocument();
    expect(goalsApi.list).toHaveBeenCalledWith({ scope: 'current' });
  });

  it('troca o período do filtro e recarrega a lista', async () => {
    renderPage();
    await screen.findByText('Faturamento mensal');
    mocked(goalsApi.list).mockResolvedValue([]);
    await userEvent.click(screen.getByRole('combobox', { name: 'Filtrar metas por período' }));
    await userEvent.click(within(screen.getByRole('listbox')).getByText('Encerradas'));
    await waitFor(() => expect(goalsApi.list).toHaveBeenLastCalledWith({ scope: 'past' }));
    expect(await screen.findByText('Nenhuma meta encontrada')).toBeInTheDocument();
    expect(screen.getByText('0 metas')).toBeInTheDocument();
    expect(screen.getByText('Metas')).toBeInTheDocument();
  });

  it('mostra o vazio de "em andamento" e o singular', async () => {
    mocked(goalsApi.list).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('Nenhuma meta em andamento')).toBeInTheDocument();
  });

  it('mostra "1 meta" no singular', async () => {
    mocked(goalsApi.list).mockResolvedValue([goals[0]]);
    renderPage();
    expect(await screen.findByText('1 meta')).toBeInTheDocument();
  });

  it('mostra carregando enquanto a lista não chega', () => {
    mocked(goalsApi.list).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Carregando…')).toBeInTheDocument();
  });

  it('sem permissões não exibe criar nem editar', async () => {
    auth.user.permissions = [];
    renderPage();
    await screen.findByText('Faturamento mensal');
    expect(screen.queryByRole('button', { name: 'Nova meta' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar meta/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('Faturamento mensal'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cria uma meta de faturamento com a prévia automática', async () => {
    const { invalidate } = renderPage();
    await screen.findByText('Faturamento mensal');
    await userEvent.click(screen.getByRole('button', { name: 'Nova meta' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText('Nova meta', { selector: 'h2, h6, p, span, div' })).toBeInTheDocument();
    expect(goalsApi.preview).toHaveBeenCalledWith({ metric: 'REVENUE', periodType: 'MONTH', periodStart: '2026-03-01' });
    expect((await within(dlg).findAllByText(/R\$\s?12\.000/)).length).toBeGreaterThan(0);
    expect(within(dlg).getByText('Calculado automaticamente')).toBeInTheDocument();

    await userEvent.click(within(dlg).getByRole('button', { name: 'Criar meta' }));
    expect(await within(dlg).findByText('Informe o objetivo')).toBeInTheDocument();
    expect(goalsApi.create).not.toHaveBeenCalled();

    const target = within(dlg).getByPlaceholderText('0');
    await userEvent.type(target, '0');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Criar meta' }));
    expect(await within(dlg).findByText('Deve ser maior que zero')).toBeInTheDocument();

    await userEvent.clear(target);
    await userEvent.type(target, '24000');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Cor #9B7BD4' }));
    expect(within(dlg).getByText('50% · Atenção')).toBeInTheDocument();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Criar meta' }));
    await waitFor(() =>
      expect(goalsApi.create).toHaveBeenCalledWith({
        name: 'Faturamento mensal',
        metric: 'REVENUE',
        format: 'CURRENCY',
        target: 24000,
        periodType: 'MONTH',
        periodStart: '2026-03-01',
        color: '#9B7BD4',
      }),
    );
    expect(toast.success).toHaveBeenCalledWith('Meta criada.');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['goals'] });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('exige nome e permite meta manual com valor atual informado', async () => {
    renderPage();
    await screen.findByText('Faturamento mensal');
    await userEvent.click(screen.getByRole('button', { name: 'Nova meta' }));
    const dlg = await screen.findByRole('dialog');

    await userEvent.click(within(dlg).getAllByRole('combobox')[0]);
    await userEvent.click(within(screen.getByRole('listbox')).getByText('Outro (informar manualmente)'));
    const name = within(dlg).getByPlaceholderText('Ex.: Faturamento mensal');
    expect(name).toHaveValue('');
    // formato fica livre para o manual
    await userEvent.click(within(dlg).getAllByRole('combobox')[1]);
    await userEvent.click(within(screen.getByRole('listbox')).getByText('Porcentagem (%)'));

    const [manual, target] = within(dlg).getAllByPlaceholderText('0');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Criar meta' }));
    expect(await within(dlg).findByText('Nome é obrigatório')).toBeInTheDocument();

    await userEvent.type(name, 'Satisfação');
    await userEvent.type(manual, '45.5');
    await userEvent.type(target, '90');
    expect(within(dlg).getByText(/51% · Atenção/)).toBeInTheDocument();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Criar meta' }));
    await waitFor(() =>
      expect(goalsApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Satisfação', metric: 'MANUAL', format: 'PERCENT', target: 90, manualValue: 45.5 }),
      ),
    );
    expect(goalsApi.preview).not.toHaveBeenCalledWith(expect.objectContaining({ metric: 'MANUAL' }));
  });

  it('troca de indicador mantém nome personalizado e altera o sugerido', async () => {
    renderPage();
    await screen.findByText('Faturamento mensal');
    await userEvent.click(screen.getByRole('button', { name: 'Nova meta' }));
    const dlg = await screen.findByRole('dialog');
    const name = within(dlg).getByPlaceholderText('Ex.: Faturamento mensal');
    await userEvent.click(within(dlg).getAllByRole('combobox')[0]);
    await userEvent.click(within(screen.getByRole('listbox')).getByText('Taxa de retorno'));
    expect(name).toHaveValue('Taxa de retorno');
    expect(within(dlg).getByText(/Pacientes atendidos no período/)).toBeInTheDocument();
    await userEvent.clear(name);
    await userEvent.type(name, 'Fidelização');
    await userEvent.click(within(dlg).getAllByRole('combobox')[0]);
    await userEvent.click(within(screen.getByRole('listbox')).getByText('Ticket médio'));
    expect(name).toHaveValue('Fidelização');
  });

  it('ajusta mês, trimestre e ano ao trocar o tipo de período', async () => {
    renderPage();
    await screen.findByText('Faturamento mensal');
    await userEvent.click(screen.getByRole('button', { name: 'Nova meta' }));
    const dlg = await screen.findByRole('dialog');
    // Período, Mês, Ano
    await userEvent.click(within(dlg).getAllByRole('combobox')[2]);
    await userEvent.click(within(screen.getByRole('listbox')).getByText('Trimestral'));
    expect(within(dlg).getByText('1º trimestre 2026', { selector: 'p' })).toBeInTheDocument();

    await userEvent.click(within(dlg).getAllByRole('combobox')[3]);
    await userEvent.click(within(screen.getByRole('listbox')).getByText('3º trimestre'));
    expect(within(dlg).getByText('3º trimestre 2026', { selector: 'p' })).toBeInTheDocument();

    await userEvent.click(within(dlg).getAllByRole('combobox')[4]);
    await userEvent.click(within(screen.getByRole('listbox')).getByText('2027'));
    expect(goalsApi.preview).toHaveBeenLastCalledWith({ metric: 'REVENUE', periodType: 'QUARTER', periodStart: '2027-07-01' });

    await userEvent.click(within(dlg).getAllByRole('combobox')[2]);
    await userEvent.click(within(screen.getByRole('listbox')).getByText('Anual'));
    expect(within(dlg).getByText('Ano 2027', { selector: 'p' })).toBeInTheDocument();
    expect(within(dlg).queryByText('Trimestre')).not.toBeInTheDocument();

    await userEvent.click(within(dlg).getAllByRole('combobox')[2]);
    await userEvent.click(within(screen.getByRole('listbox')).getByText('Mensal'));
    await userEvent.click(within(dlg).getAllByRole('combobox')[3]);
    await userEvent.click(within(screen.getByRole('listbox')).getByText('Dezembro'));
    expect(within(dlg).getByText('Dezembro 2027', { selector: 'p' })).toBeInTheDocument();
  });

  it('edita uma meta existente e envia o payload atualizado', async () => {
    renderPage();
    await screen.findByText('Novos pacientes');
    await userEvent.click(screen.getByRole('button', { name: 'Editar meta Novos pacientes' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText('Editar meta')).toBeInTheDocument();
    expect(within(dlg).getByText('Novos pacientes · Março 2026')).toBeInTheDocument();
    expect(within(dlg).getByDisplayValue('Novos pacientes')).toBeInTheDocument();
    const target = within(dlg).getByDisplayValue('30');
    await userEvent.clear(target);
    await userEvent.type(target, '40');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(goalsApi.update).toHaveBeenCalledWith('g2', {
        name: 'Novos pacientes',
        metric: 'NEW_PATIENTS',
        format: 'NUMBER',
        target: 40,
        periodType: 'MONTH',
        periodStart: '2026-03-01',
        color: '#15998B',
      }),
    );
    expect(toast.success).toHaveBeenCalledWith('Meta atualizada.');
  });

  it('abre a edição ao clicar no cartão e mostra erro da API', async () => {
    mocked(goalsApi.update).mockRejectedValue({ response: { data: { message: 'Período duplicado' } } });
    renderPage();
    await userEvent.click(await screen.findByText('Meta da Ana'));
    const dlg = await screen.findByRole('dialog');
    const manual = within(dlg).getByDisplayValue('9');
    await userEvent.clear(manual);
    await userEvent.type(manual, '10');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Salvar' }));
    expect(await within(dlg).findByText('Período duplicado')).toBeInTheDocument();
    expect(goalsApi.update).toHaveBeenCalledWith('g4', expect.objectContaining({ manualValue: 10, periodType: 'YEAR', periodStart: '2026-01-01' }));
    expect(toast.error).toHaveBeenCalled();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('valida valor manual negativo', async () => {
    renderPage();
    await userEvent.click(await screen.findByText('Meta da Ana'));
    const dlg = await screen.findByRole('dialog');
    const manual = within(dlg).getByDisplayValue('9');
    await userEvent.clear(manual);
    await userEvent.type(manual, '-3');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Salvar' }));
    // a validação nativa do navegador (min=0) também bloqueia o envio
    expect(goalsApi.update).not.toHaveBeenCalled();
  });

  it('exclui a meta após confirmar', async () => {
    renderPage();
    await userEvent.click(await screen.findByText('Faturamento mensal'));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Excluir' }));
    expect(dialogs.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Excluir meta', message: 'Excluir a meta "Faturamento mensal"?' }));
    await waitFor(() => expect(goalsApi.remove).toHaveBeenCalledWith('g1'));
    expect(toast.success).toHaveBeenCalledWith('Meta excluída.');
  });

  it('não exclui se a confirmação for recusada', async () => {
    dialogs.confirm.mockResolvedValue(false);
    renderPage();
    await userEvent.click(await screen.findByText('Faturamento mensal'));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(dialogs.confirm).toHaveBeenCalled());
    expect(goalsApi.remove).not.toHaveBeenCalled();
  });

  it('sem permissão de excluir o diálogo de edição não tem o botão', async () => {
    auth.user.permissions = ['goals:edit'];
    renderPage();
    await userEvent.click(await screen.findByText('Faturamento mensal'));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();
  });
});
