import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { financeApi } from '../api/finance';
import { downloadCsv } from '../utils/csv';
import type { FinancialEntry } from '../types';
import { Finance } from './Finance';

vi.mock('../api/finance', () => ({
  financeApi: { list: vi.fn(), summary: vi.fn(), setInvoiceIssued: vi.fn(), remove: vi.fn() },
}));
vi.mock('../hooks/useFinanceBackgroundSync', () => ({ useFinanceBackgroundSync: vi.fn() }));
vi.mock('../utils/csv', () => ({ downloadCsv: vi.fn() }));
// O formulário tem testes próprios; aqui só interessa se abre vazio ou com o lançamento escolhido.
vi.mock('../components/finance/FinanceFormDialog', () => ({
  FinanceFormDialog: ({ open, entry }: { open: boolean; entry?: FinancialEntry | null }) =>
    open ? <div role="dialog">{entry ? `Editando ${entry.description}` : 'Novo lançamento vazio'}</div> : null,
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), showToast: vi.fn() }));
const dialogs = vi.hoisted(() => ({ confirm: vi.fn(), alert: vi.fn() }));
vi.mock('../contexts/AppToastContext', () => ({ useAppToast: () => toast }));
vi.mock('../contexts/AppDialogContext', () => ({ useAppDialog: () => dialogs }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const income = (over: Partial<FinancialEntry>): FinancialEntry => ({
  id: 'x',
  type: 'INCOME',
  description: 'x',
  amount: 100,
  paidAt: '2026-03-10T12:00:00.000Z',
  invoiceIssued: false,
  ...over,
});

const entries: FinancialEntry[] = [
  income({ id: 'e1', description: 'Limpeza de pele', amount: 1000, netAmount: 965, feePercent: 3.5, category: 'Atendimentos', paymentMethod: { id: 'c', name: 'Crédito', kind: 'CREDIT', feePercent: 3.5, active: true } }),
  income({ id: 'e2', description: 'Peeling', amount: 500, invoiceIssued: true, category: 'Atendimentos' }),
  { id: 'e3', type: 'EXPENSE', description: 'Aluguel', amount: 3000, expenseType: 'FIXED', category: 'Instalações', paidAt: '2026-03-05T12:00:00.000Z' },
  ...Array.from({ length: 9 }, (_, i): FinancialEntry => ({
    id: `m${i + 1}`,
    type: 'EXPENSE',
    description: `Material ${i + 1}`,
    amount: 10,
    paidAt: '2026-03-06T12:00:00.000Z',
  })),
];

const summary = { totalIncome: 5000, totalNetIncome: 4825, totalFees: 175, totalExpense: 3000, balance: 2000, netBalance: 1825 };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Finance />
      </BrowserRouter>
    </QueryClientProvider>,
  );
  return { invalidate };
}

const money = (n: string) => new RegExp(`R\\$\\s${n.replace(/\./g, '\\.')}`);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 2, 15, 10, 0, 0)); // 15/03/2026
  window.history.replaceState({}, '', '/financeiro');
  vi.clearAllMocks();
  mocked(financeApi.list).mockResolvedValue(entries);
  mocked(financeApi.summary).mockResolvedValue(summary);
  dialogs.confirm.mockResolvedValue(true);
  dialogs.alert.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Finance (página)', () => {
  it('consulta o mês corrente e mostra receitas, taxas, líquido, despesas, lucro e margem', async () => {
    renderPage();
    expect(await screen.findByText('Limpeza de pele')).toBeInTheDocument();

    const [from, to] = mocked(financeApi.list).mock.calls[0];
    expect(dayjs(from).format('YYYY-MM-DD')).toBe('2026-03-01');
    expect(dayjs(to).format('YYYY-MM-DD')).toBe('2026-03-31');
    expect(financeApi.summary).toHaveBeenCalledWith(from, to);

    const kpi = (label: string) => screen.getByText(label).parentElement as HTMLElement;
    await waitFor(() => expect(within(kpi('Receitas')).getByText(money('5.000,00'))).toBeInTheDocument());
    expect(within(kpi('Receitas')).getByText(/Líquido\s+R\$\s*4\.825,00/)).toBeInTheDocument();
    expect(within(kpi('Receitas')).getByText(/Taxas\s+R\$\s*175,00/)).toBeInTheDocument();
    expect(within(kpi('Despesas')).getByText(money('3.000,00'))).toBeInTheDocument();
    expect(within(kpi('Despesas')).getByText('10 lançamentos')).toBeInTheDocument();
    expect(within(kpi('Lucro')).getByText(money('2.000,00'))).toBeInTheDocument();
    expect(within(kpi('Lucro')).getByText('Margem 40.0%')).toBeInTheDocument();
    expect(within(kpi('Notas pendentes')).getByText('1')).toBeInTheDocument();
    expect(screen.getByText(/lançamentos no período/)).toBeInTheDocument();
    expect(screen.getByText(/nota pendente/)).toBeInTheDocument();
  });

  it('lucro negativo e sem receita: sem margem e sem rodapé de taxas', async () => {
    mocked(financeApi.summary).mockResolvedValue({ ...summary, totalIncome: 0, totalNetIncome: 0, totalFees: 0, balance: -800 });
    renderPage();
    await screen.findByText('Limpeza de pele');
    const lucro = screen.getByText('Lucro').parentElement as HTMLElement;
    await waitFor(() => expect(within(lucro).getByText(/-\s*R\$\s*800,00/)).toBeInTheDocument());
    expect(within(lucro).queryByText(/Margem/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Taxas\s+R\$/)).not.toBeInTheDocument();
  });

  it('pagina 10 por vez e navega para a segunda página', async () => {
    renderPage();
    await screen.findByText('Limpeza de pele');
    expect(screen.getByText(/Mostrando 1–10 de 12 lançamentos/)).toBeInTheDocument();
    expect(screen.queryByText('Material 9')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Próxima página' }));
    expect(await screen.findByText('Material 9')).toBeInTheDocument();
    expect(screen.getByText(/Mostrando 11–12 de 12 lançamentos/)).toBeInTheDocument();
    expect(screen.queryByText('Limpeza de pele')).not.toBeInTheDocument();
  });

  it('busca por descrição, categoria ou forma de pagamento', async () => {
    renderPage();
    await screen.findByText('Limpeza de pele');
    const search = screen.getByLabelText('Buscar por descrição, categoria ou forma de pagamento');
    await userEvent.type(search, 'crédito');
    expect(await screen.findByText(/Mostrando 1–1 de 1 lançamento \(de 12\)/)).toBeInTheDocument();
    expect(screen.getByText('Limpeza de pele')).toBeInTheDocument();
    expect(screen.queryByText('Peeling')).not.toBeInTheDocument();

    await userEvent.clear(search);
    await userEvent.type(search, 'zzz');
    expect(await screen.findByText('Nenhum lançamento encontrado com os filtros')).toBeInTheDocument();
  });

  it('filtra por tipo e por situação da nota fiscal', async () => {
    renderPage();
    await screen.findByText('Limpeza de pele');

    await userEvent.click(screen.getByRole('combobox', { name: 'Tipo' }));
    await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'Receitas' }));
    expect(await screen.findByText(/Mostrando 1–2 de 2 lançamentos \(de 12\)/)).toBeInTheDocument();
    expect(screen.queryByText('Aluguel')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('combobox', { name: 'Nota' }));
    await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'Notas emitidas' }));
    expect(await screen.findByText(/Mostrando 1–1 de 1 lançamento \(de 12\)/)).toBeInTheDocument();
    expect(screen.getByText('Peeling')).toBeInTheDocument();
    expect(screen.queryByText('Limpeza de pele')).not.toBeInTheDocument();
  });

  it('clicar em "Notas pendentes" aplica o filtro', async () => {
    renderPage();
    await screen.findByText('Limpeza de pele');
    expect(screen.getByText('Ver pendentes')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Notas pendentes', { selector: 'p' }));
    expect(await screen.findByText('Filtro aplicado')).toBeInTheDocument();
    expect(screen.getByText(/Mostrando 1–1 de 1 lançamento \(de 12\)/)).toBeInTheDocument();
    expect(screen.queryByText('Peeling')).not.toBeInTheDocument();
  });

  it('marca a nota como emitida e avisa', async () => {
    mocked(financeApi.setInvoiceIssued).mockResolvedValue({});
    const { invalidate } = renderPage();
    await screen.findByText('Limpeza de pele');
    await userEvent.click(screen.getAllByRole('checkbox')[0]);
    await waitFor(() => expect(financeApi.setInvoiceIssued).toHaveBeenCalledWith('e1', true));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Nota fiscal marcada como emitida.'));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['finance'] });
  });

  it('desmarcar nota emitida avisa "desmarcada"; falha mostra erro', async () => {
    mocked(financeApi.setInvoiceIssued).mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('x'));
    renderPage();
    await screen.findByText('Peeling');
    const boxes = screen.getAllByRole('checkbox');
    await userEvent.click(boxes[1]); // Peeling já emitida
    await waitFor(() => expect(financeApi.setInvoiceIssued).toHaveBeenCalledWith('e2', false));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Nota fiscal desmarcada.'));
    await userEvent.click(boxes[0]);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('x'));
  });

  it('exclui após confirmar; não exclui se cancelar', async () => {
    mocked(financeApi.remove).mockResolvedValue(undefined);
    renderPage();
    await screen.findByText('Limpeza de pele');

    dialogs.confirm.mockResolvedValueOnce(false);
    await userEvent.click(screen.getAllByRole('button', { name: 'Excluir' })[0]);
    await waitFor(() => expect(dialogs.confirm).toHaveBeenCalledTimes(1));
    expect(financeApi.remove).not.toHaveBeenCalled();

    await userEvent.click(screen.getAllByRole('button', { name: 'Excluir' })[0]);
    await waitFor(() => expect(financeApi.remove).toHaveBeenCalledWith('e1'));
    expect(dialogs.confirm).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Excluir lançamento', confirmColor: 'error' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Lançamento excluído.'));
  });

  it('erro ao excluir mostra a mensagem do servidor', async () => {
    mocked(financeApi.remove).mockRejectedValue({ response: { data: { message: 'Lançamento vinculado' } } });
    renderPage();
    await screen.findByText('Limpeza de pele');
    await userEvent.click(screen.getAllByRole('button', { name: 'Excluir' })[0]);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Lançamento vinculado'));
  });

  it('abre o formulário vazio em "Novo lançamento" e com o lançamento em "Editar"', async () => {
    renderPage();
    await screen.findByText('Limpeza de pele');
    await userEvent.click(screen.getAllByRole('button', { name: 'Editar' })[1]);
    expect(await screen.findByRole('dialog')).toHaveTextContent('Editando Peeling');
    await userEvent.click(screen.getByRole('button', { name: 'Novo lançamento' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Novo lançamento vazio');
  });

  it('exporta o período inteiro em CSV com valores e flags', async () => {
    renderPage();
    await screen.findByText('Limpeza de pele');
    await userEvent.click(screen.getByRole('button', { name: 'Exportar período' }));
    expect(downloadCsv).toHaveBeenCalledTimes(1);
    const [filename, rows, headers] = mocked(downloadCsv).mock.calls[0];
    expect(filename).toBe('financeiro-2026-03-01_2026-03-31.csv');
    expect(rows).toHaveLength(12);
    expect(rows[0]).toMatchObject({
      Data: '10/03/2026',
      Tipo: 'Receita',
      Descrição: 'Limpeza de pele',
      Categoria: 'Atendimentos',
      'Forma de pagamento': 'Crédito',
      Valor: '1000.00',
      'Nota emitida': 'Não',
      Recorrente: 'Não',
    });
    expect(rows[1]['Nota emitida']).toBe('Sim');
    expect(rows[2]).toMatchObject({ Tipo: 'Despesa', 'Nota emitida': '' });
    expect(headers).toHaveLength(10);
  });

  it('sem lançamentos: estado vazio, exportar avisa e KPIs ficam zerados', async () => {
    mocked(financeApi.list).mockResolvedValue([]);
    mocked(financeApi.summary).mockResolvedValue({ totalIncome: 0, totalNetIncome: 0, totalFees: 0, totalExpense: 0, balance: 0, netBalance: 0 });
    renderPage();
    expect(await screen.findByText('Nenhum lançamento no período')).toBeInTheDocument();
    expect(screen.getByText('Ajuste o período ou registre um novo lançamento.')).toBeInTheDocument();
    expect(screen.getByText('0 lançamentos')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Exportar período' }));
    expect(dialogs.alert).toHaveBeenCalledWith(expect.objectContaining({ message: 'Nenhum lançamento no período para exportar.' }));
    expect(downloadCsv).not.toHaveBeenCalled();
  });

  it('mudar o período refaz a consulta com as novas datas', async () => {
    renderPage();
    await screen.findByText('Limpeza de pele');
    const de = screen.getByLabelText('De') as HTMLInputElement;
    expect(de.value).toBe('2026-03-01');
    fireEvent.change(de, { target: { value: '2026-02-01' } });
    await waitFor(() => {
      const calls = mocked(financeApi.list).mock.calls;
      expect(dayjs(calls[calls.length - 1][0]).format('YYYY-MM-DD')).toBe('2026-02-01');
    });
    expect(window.location.search).toContain('de=2026-02-01');
  });
});
