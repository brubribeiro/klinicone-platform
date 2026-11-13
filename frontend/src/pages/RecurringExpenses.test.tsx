import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { recurringExpensesApi } from '../api/recurring-expenses';
import type { RecurringExpense } from '../types';
import { RecurringExpensesPage } from './RecurringExpenses';

vi.mock('../api/recurring-expenses', () => ({
  recurringExpensesApi: { list: vi.fn(), remove: vi.fn(), generate: vi.fn() },
}));
// Os componentes abaixo têm testes próprios; aqui interessa como a página os alimenta.
vi.mock('../components/finance/HourlyCostCard', () => ({
  HourlyCostCard: ({ activeFixedMonthly, activeVariableMonthly }: { activeFixedMonthly: number; activeVariableMonthly: number }) => (
    <div data-testid="hourly">{`fixo=${activeFixedMonthly};variavel=${activeVariableMonthly}`}</div>
  ),
}));
vi.mock('../components/finance/RecurringExpenseFormDialog', () => ({
  RecurringExpenseFormDialog: ({ open, expense }: { open: boolean; expense?: RecurringExpense | null }) =>
    open ? <div role="dialog" aria-label="form">{expense ? `Editar ${expense.name}` : 'Nova despesa'}</div> : null,
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), showToast: vi.fn() }));
const dialogs = vi.hoisted(() => ({ confirm: vi.fn(), alert: vi.fn() }));
vi.mock('../contexts/AppToastContext', () => ({ useAppToast: () => toast }));
vi.mock('../contexts/AppDialogContext', () => ({ useAppDialog: () => dialogs }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

// Hoje: 15/03/2026.
const items: RecurringExpense[] = [
  { id: 'a', name: 'Aluguel', description: 'Sala 12', amount: 3000, category: 'Imóvel', expenseType: 'FIXED', dueDay: 20, active: true, _count: { generatedEntries: 2 } },
  { id: 'b', name: 'Salários', amount: '5000', expenseType: 'FIXED', dueDay: 5, active: true, _count: { generatedEntries: 1 } },
  { id: 'c', name: 'Material de consumo', amount: 1000, category: 'Insumos', expenseType: 'VARIABLE', dueDay: 17, active: true },
  { id: 'd', name: 'Internet', amount: 200, expenseType: 'FIXED', dueDay: 10, active: false },
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <RecurringExpensesPage />
      </BrowserRouter>
    </QueryClientProvider>,
  );
  return { invalidate };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 2, 15, 10, 0, 0));
  window.history.replaceState({}, '', '/despesas');
  vi.clearAllMocks();
  mocked(recurringExpensesApi.list).mockResolvedValue(items);
  mocked(recurringExpensesApi.remove).mockResolvedValue(undefined);
  mocked(recurringExpensesApi.generate).mockResolvedValue({ generated: 3, items: [], month: '2026-03' });
  dialogs.confirm.mockResolvedValue(true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('RecurringExpensesPage', () => {
  it('resume total mensal, proporção fixo/variável e vencimentos', async () => {
    renderPage();
    await screen.findByText('Aluguel');
    expect(screen.getByText(/R\$\s?9\.000,00$/, { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?108\.000,00 \/ ano/)).toBeInTheDocument();
    expect(screen.getByText(/Fixo 89% · R\$\s?8\.000,00/)).toBeInTheDocument();
    expect(screen.getByText(/Variável 11% · R\$\s?1\.000,00/)).toBeInTheDocument();
    expect(screen.getByText('despesas recorrentes em vigor').previousSibling).toHaveTextContent('3');
    expect(screen.getByText('Vencem em 7 dias').closest('.MuiCard-root')).toHaveTextContent('2');
    expect(screen.getByTestId('hourly')).toHaveTextContent('fixo=8000;variavel=1000');
    expect(screen.getByText('4 despesas cadastradas')).toBeInTheDocument();
  });

  it('mostra cada despesa com valor, periodicidade, próximo vencimento e status', async () => {
    renderPage();
    await screen.findByText('Aluguel');
    expect(screen.getAllByText('Sala 12').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/R\$\s?3\.000,00/).length).toBeGreaterThan(0);
    expect(screen.getByText('2 lançamentos gerados')).toBeInTheDocument();
    expect(screen.getByText('1 lançamento gerado')).toBeInTheDocument();
    expect(screen.getByText('Mensal · dia 20')).toBeInTheDocument();
    expect(screen.getByText('20 mar')).toBeInTheDocument();
    expect(screen.getByText('em 5 dias')).toBeInTheDocument();
    expect(screen.getByText('05 abr')).toBeInTheDocument();
    expect(screen.getByText('em 21 dias')).toBeInTheDocument();
    expect(screen.getAllByText('Inativa').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Variável').length).toBeGreaterThan(0);
    expect(screen.getByText('Mostrando 1–4 de 4')).toBeInTheDocument();
  });

  it('mostra esqueletos enquanto carrega e o vazio sem cadastros', async () => {
    mocked(recurringExpensesApi.list).mockResolvedValue([]);
    renderPage();
    expect(document.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
    expect(await screen.findByText('Nenhuma despesa recorrente cadastrada')).toBeInTheDocument();
    expect(screen.getByText('0 despesas cadastradas')).toBeInTheDocument();
  });

  it('filtra por tipo, status e busca', async () => {
    renderPage();
    await screen.findByText('Aluguel');
    await userEvent.click(screen.getByRole('combobox', { name: 'Tipo' }));
    await userEvent.click(within(screen.getByRole('listbox')).getByText('Variável'));
    await waitFor(() => expect(screen.queryByText('Aluguel')).not.toBeInTheDocument());
    expect(screen.getByText('Material de consumo')).toBeInTheDocument();
    expect(screen.getByText('1 de 4 despesas')).toBeInTheDocument();
    expect(window.location.search).toContain('tipo=VARIABLE');

    await userEvent.click(screen.getByRole('combobox', { name: 'Tipo' }));
    await userEvent.click(within(screen.getByRole('listbox')).getByText('Todos os tipos'));
    await userEvent.click(screen.getByRole('combobox', { name: 'Status' }));
    await userEvent.click(within(screen.getByRole('listbox')).getByText('Inativas'));
    await waitFor(() => expect(screen.queryByText('Aluguel')).not.toBeInTheDocument());
    expect(screen.getByText('Internet')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('combobox', { name: 'Status' }));
    await userEvent.click(within(screen.getByRole('listbox')).getByText('Todos os status'));
    await userEvent.type(screen.getByPlaceholderText('Buscar despesa, categoria...'), 'imóvel');
    await waitFor(() => expect(screen.queryByText('Salários')).not.toBeInTheDocument());
    expect(screen.getByText('Aluguel')).toBeInTheDocument();
    await userEvent.clear(screen.getByPlaceholderText('Buscar despesa, categoria...'));
    await userEvent.type(screen.getByPlaceholderText('Buscar despesa, categoria...'), 'zzz');
    expect(await screen.findByText('Nenhuma despesa encontrada com os filtros')).toBeInTheDocument();
  });

  it('pagina de 8 em 8', async () => {
    const many = Array.from({ length: 10 }, (_, i): RecurringExpense => ({
      id: `x${i}`, name: `Conta ${String(i + 1).padStart(2, '0')}`, amount: 100, expenseType: 'FIXED', dueDay: 10, active: true,
    }));
    mocked(recurringExpensesApi.list).mockResolvedValue(many);
    renderPage();
    await screen.findByText('Conta 01');
    expect(screen.getByText('Mostrando 1–8 de 10')).toBeInTheDocument();
    expect(screen.queryByText('Conta 09')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    expect(await screen.findByText('Conta 09')).toBeInTheDocument();
    expect(screen.getByText('Mostrando 9–10 de 10')).toBeInTheDocument();
  });

  it('abre o diálogo para criar e para editar', async () => {
    renderPage();
    await screen.findByText('Aluguel');
    await userEvent.click(screen.getByRole('button', { name: 'Nova despesa' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Nova despesa');
    await userEvent.keyboard('{Escape}');
  });

  it('abre a edição pelo botão da linha', async () => {
    renderPage();
    await screen.findByText('Aluguel');
    await userEvent.click(screen.getByRole('button', { name: 'Editar Salários' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Editar Salários');
  });

  it('exclui após confirmar e trata erro e recusa', async () => {
    const { invalidate } = renderPage();
    await screen.findByText('Aluguel');
    await userEvent.click(screen.getByRole('button', { name: 'Excluir Aluguel' }));
    expect(dialogs.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Excluir despesa', message: 'Excluir "Aluguel"? Esta ação não pode ser desfeita.' }));
    await waitFor(() => expect(recurringExpensesApi.remove).toHaveBeenCalledWith('a', {}));
    expect(toast.success).toHaveBeenCalledWith('Despesa excluída.');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['recurring-expenses'] });

    mocked(recurringExpensesApi.remove).mockRejectedValue({ response: { data: { message: 'Em uso' } } });
    await userEvent.click(screen.getByRole('button', { name: 'Excluir Internet' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Em uso'));

    dialogs.confirm.mockResolvedValue(false);
    mocked(recurringExpensesApi.remove).mockClear();
    await userEvent.click(screen.getByRole('button', { name: 'Excluir Internet' }));
    await waitFor(() => expect(dialogs.confirm).toHaveBeenCalledTimes(3));
    expect(recurringExpensesApi.remove).not.toHaveBeenCalled();
  });

  it('gera os lançamentos do mês e informa o resultado', async () => {
    const { invalidate } = renderPage();
    await screen.findByText('Aluguel');
    await userEvent.click(screen.getByRole('button', { name: 'Gerar lançamentos do mês' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('3 lançamentos gerados para 2026-03.'));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['finance'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['finance-summary'] });

    mocked(recurringExpensesApi.generate).mockResolvedValueOnce({ generated: 1, items: [], month: '2026-03' });
    await userEvent.click(screen.getByRole('button', { name: 'Gerar lançamentos do mês' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('1 lançamento gerado para 2026-03.'));

    mocked(recurringExpensesApi.generate).mockResolvedValueOnce({ generated: 0, items: [], month: '2026-03' });
    await userEvent.click(screen.getByRole('button', { name: 'Gerar lançamentos do mês' }));
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith('Todos os lançamentos do mês já foram gerados.'));

    mocked(recurringExpensesApi.generate).mockRejectedValueOnce({ response: { data: {} } });
    await userEvent.click(screen.getByRole('button', { name: 'Gerar lançamentos do mês' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não foi possível gerar os lançamentos.'));
  });
});
