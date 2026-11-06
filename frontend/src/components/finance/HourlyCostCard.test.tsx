import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { recurringExpensesApi, type HourlyCostSummary } from '../../api/recurring-expenses';
import { HourlyCostCard } from './HourlyCostCard';

vi.mock('../../api/recurring-expenses', () => ({
  recurringExpensesApi: {
    getHourlyCostSettings: vi.fn(),
    getHourlyCostSummary: vi.fn(),
    updateHourlyCostSettings: vi.fn(),
  },
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), showToast: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const fixedOnly: HourlyCostSummary = {
  hourlyCost: 50,
  recurringExpensesMonthly: 6000,
  recurringFixedMonthly: 6000,
  financeExpensesMonthly: 6000,
  financeFixedMonthly: 6000,
  includeVariable: false,
  weeklyHours: 30,
  monthlyHours: 120,
  primaryProfessional: { id: 'p', name: 'Dra. Ana' },
};
const withVariable: HourlyCostSummary = {
  ...fixedOnly,
  hourlyCost: 62.5,
  recurringExpensesMonthly: 7500,
  includeVariable: true,
};

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <HourlyCostCard activeFixedMonthly={6000} activeVariableMonthly={1500} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { invalidate };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocked(recurringExpensesApi.getHourlyCostSettings).mockResolvedValue({ includeVariable: false });
  mocked(recurringExpensesApi.getHourlyCostSummary).mockImplementation(async (v: boolean) => (v ? withVariable : fixedOnly));
});

const expand = () => userEvent.click(screen.getByRole('button', { name: 'Expandir custo por hora' }));

describe('HourlyCostCard', () => {
  it('começa minimizado mostrando só o custo por hora', async () => {
    renderCard();
    expect(await screen.findByText(/R\$\s*50,00/)).toBeInTheDocument();
    expect(screen.getByText('/ hora')).toBeInTheDocument();
    expect(screen.getByText('Base de cálculo: apenas custos fixos ativos')).toBeInTheDocument();
    expect(screen.queryByText('Carga horária / mês')).not.toBeInTheDocument();
    expect(recurringExpensesApi.getHourlyCostSummary).toHaveBeenCalledWith(false);
  });

  it('expande e mostra carga horária, custos, base de cálculo e profissional; lembra a preferência', async () => {
    renderCard();
    await screen.findByText('/ hora');
    await expand();
    expect(screen.getByText('Carga horária / mês')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('Agenda de Dra. Ana')).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s*6\.000,00/, { selector: 'p' })).toHaveLength(2); // custo fixo e base de cálculo
    expect(screen.getByText(/\+ variável: R\$\s*1\.500,00/)).toBeInTheDocument();
    expect(screen.getByText('÷ 120 horas')).toBeInTheDocument();
    expect(screen.getByText(/em despesas fixas$/)).toBeInTheDocument();
    expect(localStorage.getItem('mila.recurring-expenses.hourly-cost-collapsed')).toBe('0');
    expect(screen.getByRole('checkbox', { name: 'Incluir despesas variáveis no cálculo' })).not.toBeChecked();

    await userEvent.click(screen.getByRole('button', { name: 'Minimizar custo por hora' }));
    expect(screen.queryByText('Carga horária / mês')).not.toBeInTheDocument();
    expect(localStorage.getItem('mila.recurring-expenses.hourly-cost-collapsed')).toBe('1');
  });

  it('preferência salva como expandido abre expandido', async () => {
    localStorage.setItem('mila.recurring-expenses.hourly-cost-collapsed', '0');
    renderCard();
    expect(await screen.findByText('Carga horária / mês')).toBeInTheDocument();
  });

  it('ligar "incluir variáveis" salva a configuração, recalcula e atualiza procedimentos', async () => {
    mocked(recurringExpensesApi.updateHourlyCostSettings).mockResolvedValue({ includeVariable: true });
    const { invalidate } = renderCard();
    await screen.findByText('/ hora');
    await expand();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Incluir despesas variáveis no cálculo' }));

    await waitFor(() => expect(recurringExpensesApi.updateHourlyCostSettings).toHaveBeenCalledWith(true));
    expect(await screen.findByText('Base de cálculo: custos fixos + variáveis ativos')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*62,50/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*7\.500,00/, { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Incluir despesas variáveis no cálculo' })).toBeChecked();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['procedures'] });
  });

  it('falha ao salvar volta o switch ao valor anterior e avisa', async () => {
    mocked(recurringExpensesApi.updateHourlyCostSettings).mockRejectedValue(new Error('x'));
    renderCard();
    await screen.findByText('/ hora');
    await expand();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Incluir despesas variáveis no cálculo' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Não foi possível atualizar a configuração de custo/hora.'),
    );
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Incluir despesas variáveis no cálculo' })).not.toBeChecked(),
    );
  });

  it('sem profissional principal alerta e oferece link para configurar', async () => {
    mocked(recurringExpensesApi.getHourlyCostSummary).mockResolvedValue({ ...fixedOnly, primaryProfessional: null });
    renderCard();
    await screen.findByText('/ hora');
    await expand();
    expect(screen.getByText('Sem profissional principal')).toBeInTheDocument();
    expect(screen.getByText(/Nenhum profissional principal cadastrado/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Configurar' })).toHaveAttribute('href', '/profissionais');
  });

  it('tooltip de detalhes explica o cálculo e destaca diferença com o financeiro', async () => {
    mocked(recurringExpensesApi.getHourlyCostSummary).mockResolvedValue({ ...fixedOnly, financeExpensesMonthly: 5000 });
    renderCard();
    await screen.findByText('/ hora');
    await userEvent.hover(screen.getByRole('button', { name: 'Detalhes do cálculo de custo por hora' }));
    expect(await screen.findByText(/carga horária mensal do profissional principal \(120 h\)/)).toBeInTheDocument();
    expect(screen.getByText(/Financeiro \(mês atual\): R\$\s*5\.000,00 em despesas fixas/)).toBeInTheDocument();
  });
});
