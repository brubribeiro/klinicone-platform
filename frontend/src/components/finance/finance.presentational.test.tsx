import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';

import { TransactionRow } from './TransactionRow';
import { FinanceKpiCard, FinancePill } from './FinanceKpiCard';
import { PeriodField } from './PeriodField';
import { RecurringSummaryCards } from './RecurringSummaryCards';
import { RecurringExpenseRow } from './RecurringExpenseRow';
import { nextDueDate, formatDue, dueInLabel, UPCOMING_DAYS } from './recurringDue';
import type { FinancialEntry, RecurringExpense } from '../../types';

const money = (s: string) => new RegExp(s.replace(/[.$]/g, '\\$&').replace(/ /g, '\\s'));

describe('TransactionRow', () => {
  const income: FinancialEntry = {
    id: 'e1',
    type: 'INCOME',
    description: 'Limpeza de pele',
    amount: '1000',
    netAmount: '965',
    feePercent: '3.5',
    category: 'Atendimentos',
    paidAt: '2026-03-10T12:00:00.000Z',
    paymentMethod: { id: 'pm', name: 'Crédito', kind: 'CREDIT', feePercent: 3.5, active: true },
    installments: 3,
    appointmentId: 'a1',
    invoiceIssued: false,
    profitMargin: 62.34,
    materialCost: 40,
  };

  function setup(entry: FinancialEntry) {
    const h = { onEdit: vi.fn(), onDelete: vi.fn(), onToggleInvoice: vi.fn() };
    render(<TransactionRow entry={entry} {...h} />);
    return h;
  }

  it('receita: valor bruto com sinal +, líquido após taxa, custo de material e margem', () => {
    setup(income);
    expect(screen.getByText(/^\+\s*R\$\s*1\.000,00/)).toBeInTheDocument();
    expect(screen.getByText(/líq\.\s*R\$\s*965,00/)).toBeInTheDocument();
    expect(screen.getByText(/mat\.\s*R\$\s*40,00/)).toBeInTheDocument();
    expect(screen.getByText('62.3%')).toBeInTheDocument();
    expect(screen.getByText(/Atendimentos · Agendamento · /)).toBeInTheDocument();
    expect(screen.getByText(/Crédito/)).toBeInTheDocument();
  });

  it('despesa: sinal −, sem líquido nem NF, mostra tipo e "vence" quando não paga', () => {
    setup({
      id: 'e2',
      type: 'EXPENSE',
      description: 'Aluguel',
      amount: 2500,
      expenseType: 'FIXED',
      dueDate: '2026-03-05T12:00:00.000Z',
      recurringExpenseId: 'r1',
    });
    expect(screen.getByText(/^−\s*R\$\s*2\.500,00/)).toBeInTheDocument();
    expect(screen.queryByText(/líq\./)).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText('Recorrente')).toBeInTheDocument();
    expect(screen.getByText(/Despesa · Fixa · vence /)).toBeInTheDocument();
  });

  it('margem abaixo de 50% usa o aviso de revisão no tooltip', async () => {
    setup({ ...income, profitMargin: 30 });
    await userEvent.hover(screen.getByText('30.0%'));
    expect(await screen.findByText(/Margem abaixo de 50%/)).toBeInTheDocument();
  });

  it('alterna nota fiscal, edita e exclui', async () => {
    const h = setup(income);
    await userEvent.click(screen.getByRole('checkbox'));
    expect(h.onToggleInvoice).toHaveBeenCalledWith(true);
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(h.onEdit).toHaveBeenCalledTimes(1);
    expect(h.onDelete).toHaveBeenCalledTimes(1);
  });

  it('nota já emitida vem marcada e desmarcar pede reabrir', async () => {
    const h = setup({ ...income, invoiceIssued: true });
    const box = screen.getByRole('checkbox');
    expect(box).toBeChecked();
    await userEvent.click(box);
    expect(h.onToggleInvoice).toHaveBeenCalledWith(false);
  });
});

describe('FinanceKpiCard / FinancePill / PeriodField', () => {
  it('mostra rótulo, valor e rodapé; skeleton no loading; clique quando clicável', async () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <FinanceKpiCard label="Receitas" tone="#0a0" value="R$ 10,00" footer={<span>rodapé</span>} onClick={onClick} />,
    );
    expect(screen.getByText('Receitas')).toBeInTheDocument();
    expect(screen.getByText('R$ 10,00')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Receitas'));
    expect(onClick).toHaveBeenCalled();

    rerender(<FinanceKpiCard label="Receitas" tone="#0a0" value="R$ 10,00" footer={<span>rodapé</span>} loading />);
    expect(screen.queryByText('R$ 10,00')).not.toBeInTheDocument();
    expect(screen.queryByText('rodapé')).not.toBeInTheDocument();
  });

  it('FinancePill renderiza o texto', () => {
    render(<FinancePill tone="#f00">Atrasado</FinancePill>);
    expect(screen.getByText('Atrasado')).toBeInTheDocument();
  });

  it('PeriodField repassa a data digitada', () => {
    const onChange = vi.fn();
    render(<PeriodField label="De" value="2026-03-01" onChange={onChange} />);
    const input = screen.getByLabelText('De') as HTMLInputElement;
    expect(input.value).toBe('2026-03-01');
    // fireEvent via user-event não digita em input date no jsdom; usa setter nativo
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input, '2026-03-15');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith('2026-03-15');
  });
});

describe('recurringDue + recorrentes', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 1, 20, 10, 0, 0)); // 20/02/2026
  });
  afterEach(() => {
  vi.useRealTimers();
});

  it('nextDueDate: mesmo mês se ainda não passou, senão próximo; dia 31 vira último dia', () => {
    expect(nextDueDate(25).format('YYYY-MM-DD')).toBe('2026-02-25');
    expect(nextDueDate(10).format('YYYY-MM-DD')).toBe('2026-03-10');
    expect(nextDueDate(31).format('YYYY-MM-DD')).toBe('2026-02-28');
    expect(nextDueDate(20).format('YYYY-MM-DD')).toBe('2026-02-20');
  });

  it('dueInLabel e formatDue', () => {
    const today = dayjs().startOf('day');
    expect(dueInLabel(today)).toBe('hoje');
    expect(dueInLabel(today.add(1, 'day'))).toBe('amanhã');
    expect(dueInLabel(today.add(5, 'day'))).toBe('em 5 dias');
    expect(formatDue(dayjs('2026-02-25'))).toMatch(/^25 fev/i);
  });

  const expense: RecurringExpense = {
    id: 'r1',
    name: 'Internet',
    description: 'Fibra 500MB',
    amount: '199.9',
    category: 'Utilidades',
    expenseType: 'FIXED',
    dueDay: 25,
    active: true,
    _count: { generatedEntries: 2 },
  } as RecurringExpense;

  it('RecurringExpenseRow: dados, próximo vencimento e ações com nome', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<RecurringExpenseRow expense={expense} onEdit={onEdit} onDelete={onDelete} />);
    expect(screen.getByText('Internet')).toBeInTheDocument();
    expect(screen.getByText('Fibra 500MB')).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s*199,90/).length).toBeGreaterThan(0);
    expect(screen.getByText('2 lançamentos gerados')).toBeInTheDocument();
    expect(screen.getByText('Mensal · dia 25')).toBeInTheDocument();
    expect(screen.getByText('em 5 dias')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Editar Internet' }));
    await userEvent.click(screen.getByRole('button', { name: 'Excluir Internet' }));
    expect(onEdit).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
  });

  it('RecurringExpenseRow inativa: sem vencimento, singular de lançamento e sem descrição', () => {
    render(
      <RecurringExpenseRow
        expense={{ ...expense, active: false, description: undefined, category: undefined, expenseType: 'VARIABLE', _count: { generatedEntries: 1 } } as RecurringExpense}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText('1 lançamento gerado')).toBeInTheDocument();
    expect(screen.getAllByText('Inativa').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Variável').length).toBeGreaterThan(0);
    expect(screen.getByText('dia 25')).toBeInTheDocument();
  });

  it('RecurringSummaryCards: totais, divisão fixo × variável e próximo vencimento', () => {
    const { rerender } = render(
      <RecurringSummaryCards
        loading={false}
        totalMonthly={1000}
        activeFixedMonthly={750}
        activeVariableMonthly={250}
        fixedPct={75}
        variablePct={25}
        dueStats={{ activeCount: 4, upcoming: 2, next: dayjs('2026-02-25') }}
      />,
    );
    expect(screen.getByText(money('R$ 1.000,00'))).toBeInTheDocument();
    expect(screen.getByText(money('R$ 12.000,00 / ano'))).toBeInTheDocument();
    expect(screen.getByText(/Fixo 75% · R\$\s*750,00/)).toBeInTheDocument();
    expect(screen.getByText(/Variável 25% · R\$\s*250,00/)).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText(`Vencem em ${UPCOMING_DAYS} dias`)).toBeInTheDocument();
    expect(screen.getByText(/próximo: 25 fev/i)).toBeInTheDocument();

    rerender(
      <RecurringSummaryCards
        loading
        totalMonthly={0}
        activeFixedMonthly={0}
        activeVariableMonthly={0}
        fixedPct={0}
        variablePct={0}
        dueStats={{ activeCount: 0, upcoming: 0, next: null }}
      />,
    );
    expect(screen.getByText('nenhum vencimento')).toBeInTheDocument();
    expect(screen.queryByText(/\/ ano/)).not.toBeInTheDocument();
  });
});
