import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { financeApi } from '../../api/finance';
import { patientsApi } from '../../api/patients';
import { paymentMethodsApi } from '../../api/paymentMethods';
import { recurringExpensesApi } from '../../api/recurring-expenses';
import type { FinancialEntry, PaymentMethodEntry, RecurringExpense } from '../../types';
import { FinanceFormDialog } from './FinanceFormDialog';
import { RecurringExpenseFormDialog } from './RecurringExpenseFormDialog';

vi.mock('../../api/finance', () => ({ financeApi: { create: vi.fn(), update: vi.fn() } }));
vi.mock('../../api/patients', () => ({ patientsApi: { list: vi.fn() } }));
vi.mock('../../api/paymentMethods', () => ({ paymentMethodsApi: { list: vi.fn() } }));
vi.mock('../../api/recurring-expenses', () => ({
  recurringExpensesApi: { create: vi.fn(), update: vi.fn() },
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), showToast: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const methods: PaymentMethodEntry[] = [
  { id: 'pix', name: 'Pix', kind: 'PIX', feePercent: 0, active: true },
  { id: 'credit', name: 'Crédito', kind: 'CREDIT', feePercent: '3.5', active: true },
  { id: 'old', name: 'Cheque', kind: 'OTHER', feePercent: 0, active: false },
];

function renderWith(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return { invalidate };
}

// Os rótulos não são associados aos campos; a descrição é o primeiro textbox do diálogo.
const desc = () => screen.getAllByRole('textbox')[0];

async function typeMoney(input: HTMLElement, digits: string) {
  await userEvent.clear(input);
  await userEvent.type(input, digits);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked(patientsApi.list).mockResolvedValue([{ id: 'p1', name: 'Maria Silva' }]);
  mocked(paymentMethodsApi.list).mockResolvedValue(methods);
});

describe('FinanceFormDialog', () => {
  it('valida descrição e valor antes de enviar', async () => {
    const onClose = vi.fn();
    renderWith(<FinanceFormDialog open onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Criar lançamento' }));
    expect(await screen.findByText('Descrição é obrigatória')).toBeInTheDocument();
    expect(screen.getByText('Informe um valor maior que zero')).toBeInTheDocument();
    expect(financeApi.create).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('cria receita com paciente, forma de pagamento de cartão e dados da maquininha', async () => {
    mocked(financeApi.create).mockResolvedValue({ id: 'new' });
    const onClose = vi.fn();
    const { invalidate } = renderWith(<FinanceFormDialog open onClose={onClose} />);

    await userEvent.type(desc(), 'Peeling facial');
    await typeMoney(screen.getByPlaceholderText('0,00'), '45000');
    expect(screen.getByPlaceholderText('0,00')).toHaveValue('450,00');

    await userEvent.click(screen.getByLabelText('Vincular a paciente'));
    await userEvent.click(await screen.findByRole('option', { name: 'Maria Silva' }));

    // forma de pagamento: só métodos ativos, com taxa no rótulo
    const selects = screen.getAllByRole('combobox');
    await userEvent.click(selects[selects.length - 1]);
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).queryByRole('option', { name: 'Cheque' })).not.toBeInTheDocument();
    await userEvent.click(within(listbox).getByRole('option', { name: 'Crédito (3.5%)' }));

    // campos de cartão
    await userEvent.type(await screen.findByPlaceholderText('1 = à vista'), '3');
    await userEvent.type(screen.getByPlaceholderText(/comprovante da maquininha/), 'NSU123');

    await userEvent.click(screen.getByRole('button', { name: 'Criar lançamento' }));
    await waitFor(() => expect(financeApi.create).toHaveBeenCalledTimes(1));
    const payload = mocked(financeApi.create).mock.calls[0][0];
    expect(payload).toMatchObject({
      type: 'INCOME',
      description: 'Peeling facial',
      amount: 450,
      paymentMethodId: 'credit',
      patientId: 'p1',
      installments: 3,
      authorizationCode: 'NSU123',
    });
    expect(payload.paidAt).toMatch(/^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/);
    expect(payload).not.toHaveProperty('expenseType');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith('Lançamento criado.');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['finance'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['finance-summary'] });
  });

  it('despesa: troca para o tipo Despesa, escolhe Fixa e não envia dados de paciente nem maquininha', async () => {
    mocked(financeApi.create).mockResolvedValue({ id: 'new' });
    renderWith(<FinanceFormDialog open onClose={vi.fn()} />);

    await userEvent.click(screen.getAllByRole('button', { name: 'Despesa' })[0]);
    expect(screen.getByText(/Fixa = recorrente/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Vincular a paciente')).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Fixa' })[0]);

    await userEvent.type(desc(), 'Aluguel');
    await userEvent.type(screen.getByPlaceholderText('Ex.: Material, Aluguel'), 'Instalações');
    await typeMoney(screen.getByPlaceholderText('0,00'), '250000');
    await userEvent.click(screen.getByRole('button', { name: 'Criar lançamento' }));

    await waitFor(() => expect(financeApi.create).toHaveBeenCalled());
    const payload = mocked(financeApi.create).mock.calls[0][0];
    expect(payload).toMatchObject({ type: 'EXPENSE', description: 'Aluguel', amount: 2500, category: 'Instalações', expenseType: 'FIXED' });
    expect(payload).not.toHaveProperty('patientId');
    expect(payload).not.toHaveProperty('installments');
  });

  it('edição: preenche o formulário, atualiza o lançamento e avisa', async () => {
    mocked(financeApi.update).mockResolvedValue({ id: 'e1' });
    const entry = {
      id: 'e1',
      type: 'INCOME',
      description: 'Botox',
      amount: '800',
      paymentMethodId: 'credit',
      installments: 2,
      cardBrand: 'Visa',
      authorizationCode: 'ABC',
      paidAt: '2026-03-10T12:00:00.000Z',
      patientId: 'p1',
      category: 'Atendimentos',
    } as FinancialEntry;
    const onClose = vi.fn();
    renderWith(<FinanceFormDialog open onClose={onClose} entry={entry} />);

    expect(screen.getByText('Editar lançamento')).toBeInTheDocument();
    expect(desc()).toHaveValue('Botox');
    expect(screen.getByPlaceholderText('0,00')).toHaveValue('800,00');
    expect(await screen.findByPlaceholderText('1 = à vista')).toHaveValue(2);

    await userEvent.clear(desc());
    await userEvent.type(desc(), 'Botox 2');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(financeApi.update).toHaveBeenCalled());
    const [id, payload] = mocked(financeApi.update).mock.calls[0];
    expect(id).toBe('e1');
    expect(payload).toMatchObject({
      description: 'Botox 2',
      amount: 800,
      paymentMethodId: 'credit',
      installments: 2,
      cardBrand: 'Visa',
      authorizationCode: 'ABC',
      paidAt: '2026-03-10T12:00:00.000Z',
    });
    expect(financeApi.create).not.toHaveBeenCalled();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Lançamento atualizado.'));
  });

  it('erro da API: mostra a mensagem do servidor e mantém o diálogo aberto', async () => {
    mocked(financeApi.create).mockRejectedValue({ response: { data: { message: 'Período fechado' } } });
    const onClose = vi.fn();
    renderWith(<FinanceFormDialog open onClose={onClose} />);
    await userEvent.type(desc(), 'X');
    await typeMoney(screen.getByPlaceholderText('0,00'), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Criar lançamento' }));
    expect(await screen.findByText('Período fechado')).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith('Período fechado');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Cancelar fecha sem salvar', async () => {
    const onClose = vi.fn();
    renderWith(<FinanceFormDialog open onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
    expect(financeApi.create).not.toHaveBeenCalled();
  });
});

describe('RecurringExpenseFormDialog', () => {
  const existing: RecurringExpense = {
    id: 'r1',
    name: 'Internet',
    description: 'Fibra',
    amount: '199.9',
    category: 'Utilidades',
    expenseType: 'FIXED',
    dueDay: 12,
    active: true,
  } as RecurringExpense;

  it('valida nome, valor e dia do vencimento', async () => {
    renderWith(<RecurringExpenseFormDialog open onClose={vi.fn()} />);
    const day = screen.getByRole('spinbutton');
    await userEvent.clear(day);
    await userEvent.type(day, '40');
    await userEvent.click(screen.getByRole('button', { name: 'Criar despesa' }));
    expect(await screen.findByText('Nome obrigatório')).toBeInTheDocument();
    expect(screen.getByText('Informe um valor maior que zero')).toBeInTheDocument();
    expect(screen.getByText('Use um dia entre 1 e 31')).toBeInTheDocument();
    expect(recurringExpensesApi.create).not.toHaveBeenCalled();
  });

  it('cria despesa variável inativa com o payload esperado', async () => {
    mocked(recurringExpensesApi.create).mockResolvedValue({ id: 'n' });
    const onClose = vi.fn();
    const { invalidate } = renderWith(<RecurringExpenseFormDialog open onClose={onClose} />);

    await userEvent.type(screen.getByPlaceholderText(/Aluguel — Unidade/), 'Material de limpeza');
    await userEvent.type(screen.getByPlaceholderText('Ex.: Instalações, Utilidades'), 'Insumos');
    await typeMoney(screen.getByPlaceholderText('0,00'), '15050');
    const day = screen.getByRole('spinbutton');
    await userEvent.clear(day);
    await userEvent.type(day, '31');

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'Variável' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Despesa ativa' }));

    await userEvent.click(screen.getByRole('button', { name: 'Criar despesa' }));
    await waitFor(() => expect(recurringExpensesApi.create).toHaveBeenCalled());
    expect(mocked(recurringExpensesApi.create).mock.calls[0][0]).toEqual({
      name: 'Material de limpeza',
      amount: 150.5,
      expenseType: 'VARIABLE',
      dueDay: 31,
      active: false,
      category: 'Insumos',
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith('Despesa criada.');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['recurring-expenses'] });
  });

  it('edição: carrega valores e envia update', async () => {
    mocked(recurringExpensesApi.update).mockResolvedValue({ id: 'r1' });
    renderWith(<RecurringExpenseFormDialog open onClose={vi.fn()} expense={existing} />);
    expect(screen.getByText('Editar despesa recorrente')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0,00')).toHaveValue('199,90');
    expect(screen.getByRole('spinbutton')).toHaveValue(12);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(recurringExpensesApi.update).toHaveBeenCalled());
    expect(mocked(recurringExpensesApi.update).mock.calls[0]).toEqual([
      'r1',
      { name: 'Internet', amount: 199.9, expenseType: 'FIXED', dueDay: 12, active: true, description: 'Fibra', category: 'Utilidades' },
    ]);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Despesa atualizada.'));
  });

  it('erro da API aparece no alerta', async () => {
    mocked(recurringExpensesApi.update).mockRejectedValue({ response: { data: { message: 'Nome duplicado' } } });
    renderWith(<RecurringExpenseFormDialog open onClose={vi.fn()} expense={existing} />);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Nome duplicado')).toBeInTheDocument();
  });
});
