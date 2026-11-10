import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pendenciasApi } from '../api/pendencias';
import { usersApi } from '../api/users';
import { PEND_ICONS, donutPaths, isManual, itemIcon } from '../components/pendencias/pendenciasUtils';
import type { PendingItem, PendingList, PendingRuleConfig, PendingTask } from '../types';
import { downloadCsv } from '../utils/csv';
import { Pendencias } from './Pendencias';

vi.mock('../api/pendencias', () => ({
  pendenciasApi: {
    list: vi.fn(),
    listResolved: vi.fn(),
    getRules: vi.fn(),
    updateRules: vi.fn(),
    resolve: vi.fn(),
    assign: vi.fn(),
    reopen: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));
vi.mock('../api/users', () => ({ usersApi: { listActive: vi.fn() } }));
vi.mock('../utils/csv', () => ({ downloadCsv: vi.fn() }));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), showToast: vi.fn() }));
const dialogs = vi.hoisted(() => ({ confirm: vi.fn(), alert: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: 'u', name: 'Ana', permissions: [] as string[] } }));
vi.mock('../contexts/AppToastContext', () => ({ useAppToast: () => toast }));
vi.mock('../contexts/AppDialogContext', () => ({ useAppDialog: () => dialogs }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const item = (over: Partial<PendingItem>): PendingItem => ({
  key: 'k',
  taskId: null,
  rule: null,
  category: 'ADMINISTRATIVE',
  group: 'URGENT',
  title: 't',
  subtitle: '',
  description: null,
  deadlineLabel: '',
  dueDate: null,
  urgent: false,
  link: null,
  assignee: null,
  ...over,
});

const lowStock = item({ key: 'LOW_STOCK:a', rule: 'LOW_STOCK', category: 'INVENTORY', group: 'URGENT', title: 'Estoque baixo: Toxina', subtitle: '2 un restantes', deadlineLabel: 'Hoje', link: '/estoque/a' });
const alvara = item({ key: 'MANUAL:t1', taskId: 't1', category: 'ADMINISTRATIVE', group: 'URGENT', title: 'Renovar alvará', description: 'Prefeitura', deadlineLabel: 'Vence hoje', dueDate: '2026-03-15', urgent: true, assignee: { id: 'u1', name: 'Ana' } });
const luz = item({ key: 'BILLS_DUE:l', rule: 'BILLS_DUE', category: 'FINANCE', group: 'OVERDUE', title: 'Conta de luz', subtitle: 'R$ 350,00', deadlineLabel: 'Atrasada há 2 dias', dueDate: '2026-03-13', link: '/financeiro' });
const fornecedor = item({ key: 'MANUAL:t2', taskId: 't2', category: 'OPERATIONAL', group: 'OVERDUE', title: 'Ligar fornecedor', deadlineLabel: 'Atrasada há 5 dias' });
const laser = item({ key: 'EQUIPMENT_MAINTENANCE:e', rule: 'EQUIPMENT_MAINTENANCE', category: 'MAINTENANCE', group: 'UPCOMING', title: 'Manutenção Laser', deadlineLabel: 'Em 10 dias', link: '/equipamentos' });

const list: PendingList = { items: [lowStock, alvara, luz, fornecedor, laser], resolvedCount: 4, activeRules: 6, totalRules: 7 };

const resolvedTasks: PendingTask[] = [
  { id: 'r1', rule: null, sourceKey: null, title: 'Pagar DAS', description: null, category: 'FINANCE', dueDate: null, urgent: false, link: null, assigneeId: null, assignee: null, resolvedAt: '2026-03-10T14:30:00', resolvedByName: 'Bia', createdAt: '2026-03-01T10:00:00' },
  { id: 'r2', rule: 'LOW_STOCK', sourceKey: 'x', title: 'Repor gaze', description: null, category: 'INVENTORY', dueDate: null, urgent: false, link: null, assigneeId: null, assignee: null, resolvedAt: '2026-03-11T09:05:00', resolvedByName: null, createdAt: '2026-03-01T10:00:00' },
];

const users = [
  { id: 'u1', name: 'Ana', email: 'a@x.com', active: true, providesAppointments: true },
  { id: 'u2', name: 'Bia', email: 'b@x.com', active: true, providesAppointments: false },
];

const rules: PendingRuleConfig[] = [
  { rule: 'LOW_STOCK', enabled: true, param: 0, assigneeId: null },
  { rule: 'BILLS_DUE', enabled: true, param: 5, assigneeId: 'u1' },
  { rule: 'APPOINTMENT_NO_OUTCOME', enabled: false, param: null, assigneeId: null },
];

function Where() {
  const l = useLocation();
  return <div data-testid="where">{l.pathname}</div>;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Routes>
          <Route path="/pendencias" element={<Pendencias />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>,
  );
  return { invalidate };
}

const ALL = ['pendencias:create', 'pendencias:edit', 'pendencias:delete'];
const stat = (label: string) => screen.getAllByText(label).find((e) => e.closest('[role="button"]'))!.closest('[role="button"]') as HTMLElement;
const tab = (name: RegExp) => screen.getByRole('tab', { name });
// A linha da lista é a que tem a coluna "Responsável"; o título também aparece no "Foco de hoje".
const rowOf = (title: string) =>
  screen
    .getAllByText(title, { selector: 'p' })
    .map((p) => p.parentElement!.parentElement as HTMLElement)
    .find((r) => within(r).queryByText('Responsável') !== null)!;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 2, 15, 10, 0, 0));
  window.history.replaceState({}, '', '/pendencias');
  vi.clearAllMocks();
  auth.user.permissions = ALL;
  mocked(pendenciasApi.list).mockResolvedValue(list);
  mocked(pendenciasApi.listResolved).mockResolvedValue(resolvedTasks);
  mocked(pendenciasApi.getRules).mockResolvedValue(rules);
  mocked(pendenciasApi.updateRules).mockResolvedValue(rules);
  mocked(pendenciasApi.resolve).mockResolvedValue(undefined);
  mocked(pendenciasApi.assign).mockResolvedValue(undefined);
  mocked(pendenciasApi.reopen).mockResolvedValue(undefined);
  mocked(pendenciasApi.create).mockResolvedValue({} as PendingTask);
  mocked(pendenciasApi.update).mockResolvedValue({} as PendingTask);
  mocked(pendenciasApi.remove).mockResolvedValue(undefined);
  mocked(usersApi.listActive).mockResolvedValue(users);
  mocked(downloadCsv).mockReturnValue(true);
  dialogs.confirm.mockResolvedValue(true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('pendenciasUtils', () => {
  it('monta a rosca proporcional e trata lista vazia e fatia única', () => {
    expect(donutPaths([])).toEqual([]);
    expect(donutPaths([{ n: 0, color: 'red' }])).toEqual([]);
    const two = donutPaths([{ n: 3, color: 'red' }, { n: 1, color: 'blue' }]);
    expect(two.map((p) => p.color)).toEqual(['red', 'blue']);
    expect(two[0].d).toContain(' 0 1 1 '); // 75% = arco grande
    expect(two[1].d).toContain(' 0 0 1 ');
    expect(donutPaths([{ n: 5, color: 'green' }])).toHaveLength(1);
  });

  it('distingue manual de regra e escolhe o ícone', () => {
    expect(isManual(alvara)).toBe(true);
    expect(isManual(lowStock)).toBe(false);
    expect(itemIcon(lowStock)).toBe('box');
    expect(itemIcon(alvara)).toBe('doc');
    expect(Object.keys(PEND_ICONS)).toContain('flame');
  });
});

describe('Pendencias page', () => {
  it('mostra o foco do dia, os totais por situação e a rosca por categoria', async () => {
    renderPage();
    await screen.findByText('Renovar alvará', { selector: 'p' });
    expect(screen.getByText('3 tarefas precisam da sua atenção hoje.')).toBeInTheDocument();
    // foco: atrasadas primeiro, depois urgentes
    const focusTitles = screen.getAllByText(/^(Conta de luz|Ligar fornecedor|Estoque baixo: Toxina)$/).map((e) => e.textContent);
    expect(focusTitles.slice(0, 3)).toEqual(['Conta de luz', 'Ligar fornecedor', 'Estoque baixo: Toxina']);
    expect(within(stat('Urgentes')).getByText('2')).toBeInTheDocument();
    expect(within(stat('Atrasadas')).getByText('2')).toBeInTheDocument();
    expect(within(stat('Próximas')).getByText('1')).toBeInTheDocument();
    expect(within(stat('Resolvidas')).getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Regras · 6')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Pendências por categoria' }).querySelectorAll('path').length).toBe(5);
    expect(screen.getByText('total').previousSibling).toHaveTextContent('5');
    // vista padrão: urgentes
    expect(screen.getByText('2 pendências')).toBeInTheDocument();
    expect(screen.getByText('Estoque · 2 un restantes')).toBeInTheDocument();
    expect(screen.getByText('Vence hoje')).toBeInTheDocument();
    expect(tab(/Urgentes/)).toHaveAttribute('aria-selected', 'true');
  });

  it('mostra carregando e depois vazio sem pendências', async () => {
    mocked(pendenciasApi.list).mockResolvedValue({ items: [], resolvedCount: 0, activeRules: 0, totalRules: 7 });
    renderPage();
    expect(screen.getByText('Carregando…')).toBeInTheDocument();
    expect(await screen.findByText('Nada urgente ou atrasado por agora.')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma pendência aberta.')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma pendência nesta categoria.')).toBeInTheDocument();
    expect(screen.getByText('Regras · 0')).toBeInTheDocument();
  });

  it('troca de aba, pelo cartão de resumo e pelas ações rápidas', async () => {
    renderPage();
    await screen.findByText('Renovar alvará', { selector: 'p' });
    await userEvent.click(tab(/Atrasadas/));
    expect(rowOf('Conta de luz')).toBeInTheDocument();
    expect(screen.queryByText('Renovar alvará', { selector: 'p' })).not.toBeInTheDocument();
    await userEvent.click(stat('Próximas'));
    expect(await screen.findByText('Manutenção Laser', { selector: 'p' })).toBeInTheDocument();
    await userEvent.click(screen.getByText('Ver todas as pendências'));
    expect(rowOf('Manutenção Laser')).toBeInTheDocument();
    expect(rowOf('Renovar alvará')).toBeInTheDocument();
    expect(rowOf('Conta de luz')).toBeInTheDocument();
  });

  it('filtra por categoria pelo seletor e pela rosca', async () => {
    renderPage();
    await screen.findByText('Renovar alvará', { selector: 'p' });
    await userEvent.click(screen.getByRole('combobox', { name: 'Categoria' }));
    await userEvent.click(within(screen.getByRole('listbox')).getByText('Estoque'));
    await waitFor(() => expect(screen.queryByText('Renovar alvará', { selector: 'p' })).not.toBeInTheDocument());
    expect(rowOf('Estoque baixo: Toxina')).toBeInTheDocument();
    expect(screen.getByText('1 pendência')).toBeInTheDocument();
    // clicar de novo na mesma categoria da lateral limpa o filtro
    const side = screen.getAllByText('Estoque').find((e) => e.closest('[aria-pressed]'))!.closest('[aria-pressed]') as HTMLElement;
    expect(side).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(side);
    expect(await screen.findByText('Renovar alvará', { selector: 'p' })).toBeInTheDocument();
    const admin = screen.getAllByText('Administrativo').find((e) => e.closest('[aria-pressed]'))!.closest('[aria-pressed]') as HTMLElement;
    await userEvent.click(admin);
    await waitFor(() => expect(screen.queryByText('Estoque · 2 un restantes')).not.toBeInTheDocument());
  });

  it('navega para o link da pendência gerada por regra', async () => {
    renderPage();
    await screen.findByText('Renovar alvará', { selector: 'p' });
    await userEvent.click(within(rowOf('Estoque baixo: Toxina')).getByRole('button', { name: 'Ver detalhes' }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/estoque/a');
  });

  it('abre o foco de hoje no link e a pendência manual na edição', async () => {
    renderPage();
    await screen.findByText('Renovar alvará', { selector: 'p' });
    await userEvent.click(screen.getByText('Conta de luz'));
    expect(await screen.findByTestId('where')).toHaveTextContent('/financeiro');
  });

  it('edita uma pendência manual, enviando o payload atualizado', async () => {
    const { invalidate } = renderPage();
    await screen.findByText('Renovar alvará', { selector: 'p' });
    await userEvent.click(within(rowOf('Renovar alvará')).getByRole('button', { name: 'Ver detalhes' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText('Editar pendência')).toBeInTheDocument();
    expect(within(dlg).getByDisplayValue('Renovar alvará')).toBeInTheDocument();
    expect(within(dlg).getByDisplayValue('Prefeitura')).toBeInTheDocument();
    expect(within(dlg).getByDisplayValue('2026-03-15')).toBeInTheDocument();
    const title = within(dlg).getByDisplayValue('Renovar alvará');
    await userEvent.clear(title);
    await userEvent.type(title, '  Renovar alvará 2026 ');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(pendenciasApi.update).toHaveBeenCalledWith('t1', {
        title: 'Renovar alvará 2026',
        description: 'Prefeitura',
        category: 'ADMINISTRATIVE',
        dueDate: '2026-03-15',
        urgent: true,
        assigneeId: 'u1',
      }),
    );
    expect(toast.success).toHaveBeenCalledWith('Pendência atualizada.');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['pendencias'] });
  });

  it('cria uma pendência manual com validação do título', async () => {
    renderPage();
    await screen.findByText('Renovar alvará', { selector: 'p' });
    await userEvent.click(screen.getByText('Nova pendência'));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText('Tarefa manual com responsável e prazo')).toBeInTheDocument();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Criar pendência' }));
    expect(await within(dlg).findByText('Título é obrigatório')).toBeInTheDocument();
    expect(pendenciasApi.create).not.toHaveBeenCalled();

    await userEvent.type(within(dlg).getByPlaceholderText('Ex.: Renovar alvará sanitário'), 'Comprar toner');
    const [category, assignee] = within(dlg).getAllByRole('combobox');
    await userEvent.click(category);
    await userEvent.click(within(screen.getByRole('listbox')).getByText('Marketing'));
    await userEvent.click(assignee);
    await userEvent.click(within(await screen.findByRole('listbox')).getByText('Bia'));
    await userEvent.type(dlg.querySelector('input[type="date"]') as HTMLInputElement, '2026-04-01');
    await userEvent.click(within(dlg).getByRole('checkbox'));
    await userEvent.click(within(dlg).getByRole('button', { name: 'Criar pendência' }));
    await waitFor(() =>
      expect(pendenciasApi.create).toHaveBeenCalledWith({
        title: 'Comprar toner',
        description: null,
        category: 'MARKETING',
        dueDate: '2026-04-01',
        urgent: true,
        assigneeId: 'u2',
      }),
    );
    expect(toast.success).toHaveBeenCalledWith('Pendência criada.');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('mostra erro ao salvar e exclui a pendência após confirmar', async () => {
    mocked(pendenciasApi.update).mockRejectedValueOnce({ response: { data: { message: 'Título repetido' } } });
    renderPage();
    await screen.findByText('Renovar alvará', { selector: 'p' });
    await userEvent.click(within(rowOf('Renovar alvará')).getByRole('button', { name: 'Ver detalhes' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Título repetido'));

    await userEvent.click(within(dlg).getByRole('button', { name: 'Excluir' }));
    expect(dialogs.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Excluir pendência', message: 'Excluir a pendência "Renovar alvará"?' }));
    await waitFor(() => expect(pendenciasApi.remove).toHaveBeenCalledWith('t1'));
    expect(toast.success).toHaveBeenCalledWith('Pendência excluída.');
  });

  it('não exclui se recusar a confirmação, e esconde "Excluir" sem permissão', async () => {
    dialogs.confirm.mockResolvedValue(false);
    renderPage();
    await screen.findByText('Renovar alvará', { selector: 'p' });
    await userEvent.click(within(rowOf('Renovar alvará')).getByRole('button', { name: 'Ver detalhes' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(dialogs.confirm).toHaveBeenCalled());
    expect(pendenciasApi.remove).not.toHaveBeenCalled();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('sem permissão de excluir o diálogo não oferece o botão', async () => {
    auth.user.permissions = ['pendencias:edit'];
    renderPage();
    await screen.findByText('Renovar alvará', { selector: 'p' });
    expect(screen.queryByText('Nova pendência')).not.toBeInTheDocument();
    await userEvent.click(within(rowOf('Renovar alvará')).getByRole('button', { name: 'Ver detalhes' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();
  });

  it('resolve a pendência e invalida a lista', async () => {
    const { invalidate } = renderPage();
    await screen.findByText('Renovar alvará', { selector: 'p' });
    await userEvent.click(screen.getByRole('button', { name: 'Marcar Renovar alvará como resolvida' }));
    expect(pendenciasApi.resolve).toHaveBeenCalledWith('MANUAL:t1');
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Pendência resolvida.'));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['pendencias'] });
  });

  it('resolve otimisticamente: a pendência sai da lista e o contador sobe antes da resposta', async () => {
    let finish: () => void = () => {};
    mocked(pendenciasApi.resolve).mockReturnValue(new Promise<void>((r) => { finish = r; }));
    renderPage();
    await screen.findByText('Renovar alvará', { selector: 'p' });
    await userEvent.click(screen.getByRole('button', { name: 'Marcar Renovar alvará como resolvida' }));
    await waitFor(() => expect(screen.queryByText('Renovar alvará', { selector: 'p' })).not.toBeInTheDocument());
    expect(within(stat('Resolvidas')).getByText('5')).toBeInTheDocument();
    finish();
  });

  it('reverte a lista quando a API falha ao resolver', async () => {
    mocked(pendenciasApi.resolve).mockRejectedValue({ response: { data: {} } });
    renderPage();
    await screen.findByText('Renovar alvará', { selector: 'p' });
    await userEvent.click(screen.getByRole('button', { name: 'Marcar Renovar alvará como resolvida' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não foi possível resolver a pendência.'));
    expect(await screen.findByText('Renovar alvará', { selector: 'p' })).toBeInTheDocument();
    expect(within(stat('Resolvidas')).getByText('4')).toBeInTheDocument();
  });

  it('sem permissão de editar não mostra resolver, responsável editável nem detalhes de manual', async () => {
    auth.user.permissions = [];
    renderPage();
    await screen.findByText('Renovar alvará', { selector: 'p' });
    expect(screen.queryByRole('button', { name: /como resolvida/ })).not.toBeInTheDocument();
    expect(screen.queryByTitle('Alterar responsável')).not.toBeInTheDocument();
    // a manual sem link não tem como abrir; a de regra com link tem
    expect(within(rowOf('Renovar alvará')).queryByRole('button', { name: 'Ver detalhes' })).not.toBeInTheDocument();
    expect(within(rowOf('Estoque baixo: Toxina')).getByRole('button', { name: 'Ver detalhes' })).toBeInTheDocument();
  });

  it('altera o responsável pelo menu, inclusive remover', async () => {
    renderPage();
    await screen.findByText('Renovar alvará', { selector: 'p' });
    const assignBtn = within(rowOf('Estoque baixo: Toxina')).getByTitle('Alterar responsável');
    expect(assignBtn).toHaveTextContent('Definir');
    await userEvent.click(assignBtn);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Bia' }));
    await waitFor(() => expect(pendenciasApi.assign).toHaveBeenCalledWith('LOW_STOCK:a', 'u2'));
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());

    await userEvent.click(within(rowOf('Renovar alvará')).getByTitle('Alterar responsável'));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sem responsável' }));
    await waitFor(() => expect(pendenciasApi.assign).toHaveBeenCalledWith('MANUAL:t1', null));
  });

  it('reverte o responsável quando a API falha', async () => {
    mocked(pendenciasApi.assign).mockRejectedValue({ response: { data: {} } });
    renderPage();
    await screen.findByText('Renovar alvará', { selector: 'p' });
    await userEvent.click(within(rowOf('Renovar alvará')).getByTitle('Alterar responsável'));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Bia' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não foi possível alterar o responsável.'));
    await waitFor(() => expect(within(rowOf('Renovar alvará')).getByTitle('Alterar responsável')).toHaveTextContent('Ana'));
  });

  it('lista as resolvidas, filtra por categoria e reabre', async () => {
    const { invalidate } = renderPage();
    await screen.findByText('Renovar alvará', { selector: 'p' });
    await userEvent.click(stat('Resolvidas'));
    expect(await screen.findByText('Resolvidas nos últimos 30 dias')).toBeInTheDocument();
    expect(await screen.findByText('Pagar DAS')).toBeInTheDocument();
    expect(screen.getByText('Financeiro · Resolvida em 10/03/2026 às 14:30 por Bia')).toBeInTheDocument();
    expect(screen.getByText('Estoque · Resolvida em 11/03/2026 às 09:05')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('combobox', { name: 'Categoria' }));
    await userEvent.click(within(screen.getByRole('listbox')).getByText('Estoque'));
    await waitFor(() => expect(screen.queryByText('Pagar DAS')).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole('combobox', { name: 'Categoria' }));
    await userEvent.click(within(screen.getByRole('listbox')).getByText('Marketing'));
    expect(await screen.findByText('Nenhuma pendência resolvida nesta categoria.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('combobox', { name: 'Categoria' }));
    await userEvent.click(within(screen.getByRole('listbox')).getByText('Todos'));

    await userEvent.click((await screen.findAllByRole('button', { name: 'Reabrir' }))[0]);
    await waitFor(() => expect(pendenciasApi.reopen).toHaveBeenCalledWith('r1'));
    expect(toast.success).toHaveBeenCalledWith('Pendência reaberta.');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['pendencias'] });
  });

  it('reabrir mostra erro da API e some sem permissão', async () => {
    mocked(pendenciasApi.reopen).mockRejectedValue({ response: { data: {} } });
    renderPage();
    await screen.findByText('Renovar alvará', { selector: 'p' });
    await userEvent.click(stat('Resolvidas'));
    await userEvent.click((await screen.findAllByRole('button', { name: 'Reabrir' }))[0]);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não foi possível reabrir a pendência.'));
  });

  it('resolvidas sem permissão de editar não tem "Reabrir"', async () => {
    auth.user.permissions = [];
    renderPage();
    await screen.findByText('Renovar alvará', { selector: 'p' });
    await userEvent.click(stat('Resolvidas'));
    await screen.findByText('Pagar DAS');
    expect(screen.queryByRole('button', { name: 'Reabrir' })).not.toBeInTheDocument();
  });

  it('exporta o relatório em CSV com as colunas esperadas', async () => {
    renderPage();
    await screen.findByText('Renovar alvará', { selector: 'p' });
    await userEvent.click(screen.getByText('Relatório de pendências'));
    expect(downloadCsv).toHaveBeenCalledTimes(1);
    const [name, rows, headers] = mocked(downloadCsv).mock.calls[0];
    expect(name).toBe('pendencias-2026-03-15.csv');
    expect(headers).toEqual(['Situação', 'Pendência', 'Categoria', 'Detalhe', 'Prazo', 'Responsável', 'Origem']);
    expect(rows).toHaveLength(5);
    expect(rows[1]).toEqual({ Situação: 'Urgente', Pendência: 'Renovar alvará', Categoria: 'Administrativo', Detalhe: '', Prazo: '15/03/2026', Responsável: 'Ana', Origem: 'Manual' });
    expect(rows[0]).toMatchObject({ Origem: 'Regra', Responsável: '', Prazo: '' });
  });

  it('avisa quando não há nada para exportar', async () => {
    mocked(downloadCsv).mockReturnValue(false);
    renderPage();
    await screen.findByText('Renovar alvará', { selector: 'p' });
    await userEvent.click(screen.getByText('Relatório de pendências'));
    expect(toast.info).toHaveBeenCalledWith('Nenhuma pendência para exportar.');
  });

  it('abre as regras, altera, e salva o payload completo', async () => {
    const { invalidate } = renderPage();
    await screen.findByText('Renovar alvará', { selector: 'p' });
    await userEvent.click(screen.getByRole('button', { name: /Regras · 6/ }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText('Regras de pendência')).toBeInTheDocument();
    expect(await within(dlg).findByText('Estoque abaixo do mínimo')).toBeInTheDocument();
    expect(within(dlg).getByText('Contas a vencer')).toBeInTheDocument();
    expect(within(dlg).getByRole('checkbox', { name: 'Agendamento sem desfecho' })).not.toBeChecked();
    // regra desativada: responsável bloqueado
    const sw = within(dlg).getByRole('checkbox', { name: 'Contas a vencer' });
    expect(sw).toBeChecked();

    const antecedencia = within(dlg).getByRole('spinbutton', { name: 'Antecedência' });
    await userEvent.clear(antecedencia);
    await userEvent.type(antecedencia, '999');
    expect(antecedencia).toHaveValue(365);
    await userEvent.clear(antecedencia);
    expect(antecedencia).toHaveValue(null);
    await userEvent.type(antecedencia, '10');

    await userEvent.click(within(dlg).getByRole('checkbox', { name: 'Estoque abaixo do mínimo' }));
    await userEvent.click(within(dlg).getByRole('checkbox', { name: 'Agendamento sem desfecho' }));

    const selects = within(dlg).getAllByRole('combobox', { name: 'Responsável padrão' });
    await userEvent.click(selects[1]);
    await userEvent.click(within(await screen.findByRole('listbox')).getByText('Bia'));

    await userEvent.click(within(dlg).getByRole('button', { name: 'Salvar regras' }));
    await waitFor(() =>
      expect(mocked(pendenciasApi.updateRules).mock.calls[0]?.[0]).toEqual([
        { rule: 'LOW_STOCK', enabled: false, param: 0, assigneeId: null },
        { rule: 'BILLS_DUE', enabled: true, param: 10, assigneeId: 'u2' },
        { rule: 'APPOINTMENT_NO_OUTCOME', enabled: true, param: null, assigneeId: null },
      ]),
    );
    expect(toast.success).toHaveBeenCalledWith('Regras salvas.');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['pendencias'] });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('regras: mostra erro ao salvar e fecha pelo Cancelar', async () => {
    mocked(pendenciasApi.updateRules).mockRejectedValue({ response: { data: {} } });
    renderPage();
    await screen.findByText('Renovar alvará', { selector: 'p' });
    await userEvent.click(screen.getByRole('button', { name: /Regras · 6/ }));
    const dlg = await screen.findByRole('dialog');
    await within(dlg).findByText('Estoque abaixo do mínimo');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Salvar regras' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não foi possível salvar as regras.'));
    await userEvent.click(within(dlg).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('regras: somente leitura sem permissão de editar', async () => {
    auth.user.permissions = [];
    renderPage();
    await screen.findByText('Renovar alvará', { selector: 'p' });
    await userEvent.click(screen.getByRole('button', { name: /Regras · 6/ }));
    const dlg = await screen.findByRole('dialog');
    await within(dlg).findByText('Estoque abaixo do mínimo');
    expect(within(dlg).queryByRole('button', { name: 'Salvar regras' })).not.toBeInTheDocument();
    expect(within(dlg).getByRole('checkbox', { name: 'Contas a vencer' })).toBeDisabled();
    expect(within(dlg).getByRole('spinbutton', { name: 'Antecedência' })).toBeDisabled();
    await userEvent.click(within(dlg).getAllByRole('button', { name: 'Fechar' }).slice(-1)[0]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
