import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../api/client';
import { appointmentsApi } from '../api/appointments';
import { financeApi } from '../api/finance';
import { goalsApi } from '../api/goals';
import { patientsApi } from '../api/patients';
import { Dashboard } from './Dashboard';

vi.mock('../api/client', () => ({ api: { get: vi.fn() } }));
vi.mock('../api/appointments', () => ({ appointmentsApi: { list: vi.fn() } }));
vi.mock('../api/patients', () => ({ patientsApi: { list: vi.fn() } }));
vi.mock('../api/goals', () => ({ goalsApi: { list: vi.fn() } }));
vi.mock('../api/finance', () => ({ financeApi: { listUpcomingUnpaidExpenses: vi.fn(), markPaid: vi.fn() } }));

// Os diálogos têm testes próprios; aqui só interessa o que a página entrega a eles.
vi.mock('../components/appointments/AppointmentFormDialog', () => ({
  AppointmentFormDialog: ({ open, appointment }: { open: boolean; appointment?: { id: string } | null }) =>
    open ? <div role="dialog">Editando agendamento {appointment?.id}</div> : null,
}));
vi.mock('../components/messages/SendWhatsAppDialog', () => ({
  SendWhatsAppDialog: ({ open, phone, title, preferredCategory }: { open: boolean; phone?: string; title: string; preferredCategory: string }) =>
    open ? (
      <div role="dialog">
        {title}|{phone}|{preferredCategory}
      </div>
    ) : null,
}));

const auth = vi.hoisted(() => ({ permissions: [] as string[], restrict: false }));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'Ana', permissions: auth.permissions, restrictToOwnAppointments: auth.restrict },
  }),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), showToast: vi.fn() }));
vi.mock('../contexts/AppToastContext', () => ({ useAppToast: () => toast }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;
const at = (iso: string) => dayjs(iso).toISOString();
const money = (n: string) => new RegExp(`R\\$\\s${n.replace(/\./g, '\\.')}`);

const ALL = ['finance:view', 'finance:edit', 'appointments:view', 'goals:view', 'patients:view', 'inventory:view', 'promotions:create'];

const appt = (id: string, startAt: string, status: string, patient: string) => ({
  id,
  kind: 'PROCEDURE',
  startAt: at(startAt),
  status,
  patient: { id: `p-${id}`, name: patient },
  professional: { id: 'u1', name: 'Ana Souza' },
  procedure: { id: 'pr1', name: 'Limpeza de pele' },
});

const monthAppointments = [
  appt('a1', '2026-11-04T08:00', 'COMPLETED', 'Maria Silva'),
  appt('a2', '2026-11-04T14:00', 'CONFIRMED', 'Joana Lima'),
  appt('a3', '2026-11-04T16:00', 'CANCELLED', 'Carla Dias'),
  appt('a4', '2026-11-10T09:00', 'SCHEDULED', 'Paula Reis'),
];
const weekAppointments = [
  appt('a5', '2026-11-06T09:00', 'SCHEDULED', 'Paula Reis'),
  appt('a2', '2026-11-04T14:00', 'CONFIRMED', 'Joana Lima'),
  appt('a1', '2026-11-04T08:00', 'COMPLETED', 'Maria Silva'), // já passou
  appt('a6', '2026-11-05T10:00', 'CANCELLED', 'Carla Dias'),
  appt('a7', '2026-11-05T11:00', 'NO_SHOW', 'Rita Gomes'),
];

const patients = [
  { id: 'p1', name: 'Maria Silva', phone: '(15) 99999-1111', birthDate: '1990-11-04', createdAt: '2026-11-02T12:00:00.000Z' },
  { id: 'p2', name: 'Joana Lima', phone: '(15) 98888-2222', birthDate: '1985-11-20T00:00:00.000Z', createdAt: '2026-10-20T12:00:00.000Z' },
  { id: 'p3', name: 'Carla Dias', phone: '(15) 97777-3333', birthDate: '1990-12-30', createdAt: '2026-11-03T12:00:00.000Z' },
  { id: 'p4', name: 'Paula Reis', birthDate: '1992-11-05', createdAt: '2025-01-01T12:00:00.000Z' },
  { id: 'p5', name: 'Sem Nascimento', createdAt: '2026-11-01T12:00:00.000Z' },
];

const goal = (id: string, name: string, over = {}) => ({
  id,
  name,
  metric: 'REVENUE',
  format: 'CURRENCY',
  target: 10000,
  manualValue: null,
  periodType: 'MONTH',
  periodStart: '2026-11-01',
  periodEnd: '2026-11-30',
  color: '#15998B',
  currentValue: 4000,
  progress: 40,
  ...over,
});

const expenses = [
  { id: 'x1', type: 'EXPENSE', description: 'Aluguel', amount: 3000, dueDate: '2026-11-03' },
  { id: 'x2', type: 'EXPENSE', description: 'Internet', amount: 150, dueDate: '2026-11-06T00:00:00.000Z' },
  { id: 'x3', type: 'EXPENSE', description: 'Seguro anual', amount: 900, dueDate: '2027-02-01' },
  { id: 'x4', type: 'EXPENSE', description: 'Sem vencimento', amount: 10 },
];

function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.pathname + l.search}</output>;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Dashboard />
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { invalidate };
}

const card = (label: string) => screen.getByText(label).closest('.MuiCard-root, a') as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 4, 10, 0, 0)); // quarta, 04/11/2026
  vi.clearAllMocks();
  auth.permissions = ALL;
  auth.restrict = false;
  mocked(api.get).mockImplementation(async (url: string) => {
    if (url === '/finance/summary') return { data: { totalIncome: 12000, totalExpense: 3500, balance: 8500 } };
    if (url === '/appointments') return { data: monthAppointments };
    if (url === '/inventory')
      return {
        data: [
          { id: 'i1', quantity: 2, minQuantity: 5 },
          { id: 'i2', quantity: '5', minQuantity: '5' },
          { id: 'i3', quantity: 20, minQuantity: 5 },
        ],
      };
    throw new Error(`unexpected ${url}`);
  });
  mocked(appointmentsApi.list).mockResolvedValue(weekAppointments);
  mocked(patientsApi.list).mockResolvedValue(patients);
  mocked(goalsApi.list).mockResolvedValue([goal('g1', 'Faturamento')]);
  mocked(financeApi.listUpcomingUnpaidExpenses).mockResolvedValue(expenses);
  mocked(financeApi.markPaid).mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Dashboard page', () => {
  it('cartões de resumo: faturamento, saldo, agendamentos de hoje e novos pacientes do mês', async () => {
    renderPage();
    await waitFor(() => expect(within(card('Faturamento do mês')).getByText(money('12.000,00'))).toBeInTheDocument());
    expect(within(card('Faturamento do mês')).getByText(/Saldo:\s*R\$\s8\.500,00/)).toBeInTheDocument();
    // a1 e a2 hoje; a3 cancelado não conta
    await waitFor(() => expect(within(card('Agendamentos hoje')).getByText('2')).toBeInTheDocument());
    // p1, p3 e p5 criados em novembro
    await waitFor(() => expect(within(card('Novos pacientes')).getByText('3')).toBeInTheDocument());
    expect(screen.getByText('Taxa de ocupação')).toBeInTheDocument();
    expect(screen.getByText('sem dados ainda')).toBeInTheDocument();
  });

  it('consulta o mês corrente e os próximos 7 dias', async () => {
    renderPage();
    await screen.findByText('Faturamento do mês');
    const from = new Date(2026, 10, 1).toISOString();
    const to = new Date(2026, 10, 30, 23, 59, 59, 999).toISOString();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/finance/summary', { params: { from, to } }));
    expect(api.get).toHaveBeenCalledWith('/appointments', { params: { from, to } });
    expect(appointmentsApi.list).toHaveBeenCalledWith(
      new Date(2026, 10, 4).toISOString(),
      new Date(2026, 10, 10, 23, 59, 59, 999).toISOString(),
    );
    expect(goalsApi.list).toHaveBeenCalledWith({ at: '2026-11-01' });
  });

  it('agenda da semana lista só o que ainda vai acontecer, em ordem, e abre o agendamento', async () => {
    renderPage();
    const user = userEvent.setup();
    expect(await screen.findByText('Agenda para os próximos dias')).toBeInTheDocument();
    const weekCard = card('Agenda para os próximos dias');
    await within(weekCard).findByText('Joana Lima');
    const names = within(weekCard)
      .getAllByRole('button')
      .map((b) => b.textContent ?? '')
      .filter((t) => /Joana|Paula|Rita|Maria|Carla/.test(t));
    expect(names).toHaveLength(3);
    expect(names[0]).toContain('Joana Lima');
    expect(names[0]).toContain('Limpeza de pele · Ana Souza');
    expect(names[0]).toContain('Confirmado');
    expect(names[1]).toContain('Rita Gomes'); // quinta
    expect(names[1]).toContain('Faltou');
    expect(names[2]).toContain('Paula Reis'); // sexta
    expect(names[2]).toContain('Agendado');
    expect(within(weekCard).queryByText('Maria Silva')).not.toBeInTheDocument(); // 08:00 já passou
    expect(within(weekCard).queryByText('Carla Dias')).not.toBeInTheDocument(); // cancelado

    await user.click(within(weekCard).getByText('Joana Lima'));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Editando agendamento a2');
  });

  it('agenda vazia', async () => {
    mocked(appointmentsApi.list).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('Sem agendamentos nesta semana.')).toBeInTheDocument();
  });

  it('metas do mês: mostra progresso e limita a 3 com link para ver todas', async () => {
    mocked(goalsApi.list).mockResolvedValue([
      goal('g1', 'Faturamento'),
      goal('g2', 'Novos pacientes', { format: 'NUMBER', target: 20, currentValue: 25, progress: 125 }),
      goal('g3', 'Retorno', { format: 'PERCENT', target: 60, currentValue: 33.5, progress: 55.8 }),
      goal('g4', 'Pacotes'),
    ]);
    renderPage();
    const goalsCard = await waitFor(() => card('Metas do mês'));
    await within(goalsCard).findByText('Faturamento');
    expect(within(goalsCard).getByText('40%')).toBeInTheDocument();
    expect(within(goalsCard).getByText(/R\$\s4\.000 de R\$\s10\.000/)).toBeInTheDocument();
    expect(within(goalsCard).getByText('125%')).toBeInTheDocument();
    expect(within(goalsCard).getByText('25 de 20')).toBeInTheDocument();
    expect(within(goalsCard).getByText('56%')).toBeInTheDocument();
    expect(within(goalsCard).getByText('33,5% de 60%')).toBeInTheDocument();
    expect(within(goalsCard).queryByText('Pacotes')).not.toBeInTheDocument();
    expect(within(goalsCard).getByRole('link', { name: 'Ver todas (4)' })).toHaveAttribute('href', '/metas');
  });

  it('metas vazias', async () => {
    mocked(goalsApi.list).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('Nenhuma meta definida para este período')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver metas' })).toBeInTheDocument();
  });

  it('aniversariantes dos próximos 30 dias, do mais próximo ao mais distante, com WhatsApp', async () => {
    renderPage();
    const user = userEvent.setup();
    const bdays = await waitFor(() => card('Aniversariantes'));
    await within(bdays).findByText('Maria Silva');
    expect(within(bdays).getByText('36 anos · 04/11')).toBeInTheDocument();
    expect(within(bdays).getByText('hoje')).toBeInTheDocument();
    expect(within(bdays).getByText('41 anos · 20/11')).toBeInTheDocument();
    expect(within(bdays).getByText('em 16 dias')).toBeInTheDocument();
    expect(within(bdays).getByText('amanhã')).toBeInTheDocument();
    expect(within(bdays).queryByText('Carla Dias')).not.toBeInTheDocument(); // 56 dias
    expect(within(bdays).queryByText('Sem Nascimento')).not.toBeInTheDocument();
    expect(within(bdays).getAllByText(/Silva|Reis|Lima/).map((e) => e.textContent)).toEqual([
      'Maria Silva',
      'Paula Reis',
      'Joana Lima',
    ]);
    expect(within(bdays).getByText('MS')).toBeInTheDocument();

    // sem telefone: desabilitado
    expect(within(bdays).getByRole('button', { name: 'Enviar WhatsApp para Paula Reis' })).toBeDisabled();

    await user.click(within(bdays).getByRole('button', { name: 'Enviar WhatsApp para Maria Silva' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Feliz aniversário — Maria Silva|(15) 99999-1111|aniversario');
  });

  it('aniversariantes: estado vazio', async () => {
    mocked(patientsApi.list).mockResolvedValue([patients[2]]);
    renderPage();
    expect(await screen.findByText('Nenhum aniversário neste período.')).toBeInTheDocument();
  });

  it('contas a pagar: só as vencidas ou dos próximos dias, com total, vencidas e marcar como paga', async () => {
    const { invalidate } = renderPage();
    const user = userEvent.setup();
    const bills = await waitFor(() => card('Contas a pagar'));
    await within(bills).findByText('Aluguel');
    expect(within(bills).getByText('vencida')).toBeInTheDocument();
    expect(within(bills).getByText('Internet')).toBeInTheDocument();
    expect(within(bills).getByText('em 2 dias')).toBeInTheDocument();
    expect(within(bills).queryByText('Seguro anual')).not.toBeInTheDocument();
    expect(within(bills).queryByText('Sem vencimento')).not.toBeInTheDocument();
    expect(within(bills).getByText(money('3.150,00'))).toBeInTheDocument(); // total = 3000 + 150
    expect(financeApi.listUpcomingUnpaidExpenses).toHaveBeenCalledWith(
      new Date(2026, 9, 5).toISOString(),
      new Date(2026, 10, 11, 23, 59, 59, 999).toISOString(),
    );

    mocked(financeApi.listUpcomingUnpaidExpenses).mockResolvedValue(expenses.filter((e) => e.id !== 'x1'));
    await user.click(within(bills).getByRole('button', { name: 'Marcar Aluguel como pago' }));
    await waitFor(() => expect(financeApi.markPaid).toHaveBeenCalledWith('x1', true));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Despesa marcada como paga.'));
    await waitFor(() => expect(within(bills).queryByText('Aluguel')).not.toBeInTheDocument());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['finance-summary'] });
  });

  it('contas a pagar: erro devolve a despesa à lista e avisa', async () => {
    mocked(financeApi.markPaid).mockRejectedValue({ response: { data: { message: 'Lançamento já pago' } } });
    renderPage();
    const user = userEvent.setup();
    const bills = await waitFor(() => card('Contas a pagar'));
    await user.click(await within(bills).findByRole('button', { name: 'Marcar Internet como pago' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Lançamento já pago'));
    expect(await within(bills).findByText('Internet')).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('contas a pagar: sem permissão de editar não mostra o botão de pagar; vazio', async () => {
    auth.permissions = ['finance:view'];
    mocked(financeApi.listUpcomingUnpaidExpenses).mockResolvedValue([]);
    renderPage();
    const bills = await waitFor(() => card('Contas a pagar'));
    expect(await within(bills).findByText(/Nenhuma despesa pendente/)).toBeInTheDocument();
    expect(within(bills).queryByRole('button')).not.toBeInTheDocument();
  });

  it('datas comemorativas: próximos 60 dias ordenados, com atalho de promoção', async () => {
    renderPage();
    const user = userEvent.setup();
    const dates = card('Datas comemorativas');
    const blackFriday = within(dates).getByText('Black Friday');
    expect(within(dates).getByText('em 23 dias')).toBeInTheDocument(); // 27/11
    expect(within(dates).getByText('Início do Verão')).toBeInTheDocument(); // 21/12
    expect(within(dates).getByText('em 47 dias')).toBeInTheDocument();
    expect(within(dates).getByText('Natal')).toBeInTheDocument();
    expect(within(dates).queryByText('Dia das Mães')).not.toBeInTheDocument();
    const order = within(dates)
      .getAllByText(/^(Black Friday|Início do Verão|Natal)$/)
      .map((e) => e.textContent);
    expect(order).toEqual(['Black Friday', 'Início do Verão', 'Natal']);
    expect(blackFriday).toBeInTheDocument();
    const buttons = within(dates).getAllByRole('button', { name: /Promoção/ });
    expect(buttons).toHaveLength(3);
    await user.click(buttons[0]);
    expect(screen.getByTestId('where')).toHaveTextContent('/promocoes?data=Black%20Friday');
  });

  it('datas comemorativas: sem permissão de criar promoção não mostra o botão', async () => {
    auth.permissions = ['finance:view'];
    renderPage();
    const dates = card('Datas comemorativas');
    expect(within(dates).queryByRole('button', { name: /Promoção/ })).not.toBeInTheDocument();
  });

  it('datas comemorativas: calcula Dia das Mães e Black Friday de outro ano (maio)', async () => {
    vi.setSystemTime(new Date(2027, 3, 20, 10, 0, 0)); // 20/04/2027
    renderPage();
    const dates = card('Datas comemorativas');
    expect(within(dates).getByText('Dia das Mães')).toBeInTheDocument();
    expect(within(dates).getByText('em 19 dias')).toBeInTheDocument(); // 2º domingo de maio de 2027 = 09/05
  });

  it('sem permissões extras: troca o card financeiro por estoque baixo e esconde o resto', async () => {
    auth.permissions = [];
    auth.restrict = true;
    renderPage();
    expect(await screen.findByText('Itens em baixa')).toBeInTheDocument();
    await waitFor(() => expect(within(card('Itens em baixa')).getByText('2')).toBeInTheDocument()); // i1 e i2 (<= mínimo)
    expect(screen.getByText('Meus agendamentos hoje')).toBeInTheDocument();
    expect(screen.queryByText('Faturamento do mês')).not.toBeInTheDocument();
    expect(screen.queryByText('Metas do mês')).not.toBeInTheDocument();
    expect(screen.queryByText('Aniversariantes')).not.toBeInTheDocument();
    expect(screen.queryByText('Contas a pagar')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ver tudo' })).not.toBeInTheDocument();
    expect(appointmentsApi.list).not.toHaveBeenCalled();
    expect(api.get).not.toHaveBeenCalledWith('/finance/summary', expect.anything());
  });

  it('cartões de resumo viram links conforme a permissão', async () => {
    renderPage();
    await screen.findByText('Faturamento do mês');
    expect(screen.getByRole('link', { name: /Faturamento do mês/ })).toHaveAttribute('href', '/financeiro');
    expect(screen.getByRole('link', { name: /Agendamentos hoje/ })).toHaveAttribute('href', '/agenda');
    expect(screen.getByRole('link', { name: /Novos pacientes/ })).toHaveAttribute('href', '/pacientes');
  });
});
