import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { inventoryApi, type InventoryItemWithMovements } from '../api/inventory';
import { downloadCsv } from '../utils/csv';
import type { InventoryItem } from '../types';
import { Inventory } from './Inventory';

vi.mock('../api/inventory', () => ({
  inventoryApi: { list: vi.fn(), findOne: vi.fn(), getDeletionPreview: vi.fn(), remove: vi.fn() },
}));
vi.mock('../utils/csv', () => ({ downloadCsv: vi.fn() }));
// Os diálogos têm testes próprios; aqui só interessa com quais props a página os abre.
vi.mock('../components/inventory/InventoryFormDialog', () => ({
  InventoryFormDialog: ({ open, item }: { open: boolean; item?: InventoryItem | null }) =>
    open ? <div role="dialog" aria-label="form">{item ? `Editar ${item.name}` : 'Novo produto'}</div> : null,
}));
vi.mock('../components/inventory/MovementDialog', () => ({
  MovementDialog: ({ open, item, items }: { open: boolean; item: InventoryItem | null; items?: InventoryItem[] }) =>
    open ? (
      <div role="dialog" aria-label="movimento">
        {item ? `Movimento de ${item.name}` : `Movimento livre (${items?.length} produtos)`}
      </div>
    ) : null,
}));
vi.mock('../components/inventory/BulkPurchaseDialog', () => ({
  BulkPurchaseDialog: ({ open }: { open: boolean }) => (open ? <div role="dialog" aria-label="lote">Compra em lote aberta</div> : null),
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), showToast: vi.fn() }));
const dialogs = vi.hoisted(() => ({ confirm: vi.fn(), alert: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: 'u', name: 'Ana', permissions: [] as string[] } }));
vi.mock('../contexts/AppToastContext', () => ({ useAppToast: () => toast }));
vi.mock('../contexts/AppDialogContext', () => ({ useAppDialog: () => dialogs }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const items: InventoryItem[] = [
  { id: 'a', name: 'Toxina', sku: 'TX-1', quantity: 8, minQuantity: 3, unit: 'un', costPrice: 900, expiresAt: '2027-01-01' },
  { id: 'b', name: 'Gaze', quantity: 2, minQuantity: 10, unit: 'pct', costPrice: 5 },
  { id: 'c', name: 'Ácido', sku: 'AC-9', description: 'hialurônico', quantity: 5, minQuantity: 5, costPrice: 100, expiresAt: '2026-03-25' },
  { id: 'd', name: 'Seringa', quantity: 50, minQuantity: 10, costPrice: 2, expiresAt: '2026-03-20' },
  ...Array.from({ length: 8 }, (_, i): InventoryItem => ({ id: `f${i}`, name: `Insumo ${i + 1}`, quantity: 100, minQuantity: 1, costPrice: 1 })),
];

const detail: InventoryItemWithMovements = { ...items[0], movements: [] };

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Routes>
          <Route path="/estoque" element={<Inventory />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>,
  );
  return { invalidate };
}

const stat = (label: string) => screen.getByText(label).parentElement as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 2, 15, 10, 0, 0));
  window.history.replaceState({}, '', '/estoque');
  vi.clearAllMocks();
  auth.user.permissions = ['inventory:create', 'inventory:edit', 'inventory:delete'];
  mocked(inventoryApi.list).mockResolvedValue(items);
  mocked(inventoryApi.findOne).mockResolvedValue(detail);
  dialogs.confirm.mockResolvedValue(true);
  dialogs.alert.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Inventory (página)', () => {
  it('mostra indicadores: itens, estoque baixo, vencendo em 30 dias e valor em estoque', async () => {
    renderPage();
    await screen.findByText('Toxina');
    await waitFor(() => expect(within(stat('Itens cadastrados')).getByText('12')).toBeInTheDocument());
    expect(within(stat('Estoque baixo')).getByText('2')).toBeInTheDocument();
    expect(within(stat('Vencendo (30d)')).getByText('2')).toBeInTheDocument();
    // 8×900 + 2×5 + 5×100 + 50×2 + 8×(100×1) = 8.610
    expect(within(stat('Valor em estoque')).getByText(/R\$\s*8\.610/)).toBeInTheDocument();
    expect(screen.getByText(/Mostrando 1–10 de 12 itens/)).toBeInTheDocument();
  });

  it('pagina e navega para a segunda página', async () => {
    renderPage();
    await screen.findByText('Toxina');
    expect(screen.queryByText('Insumo 8')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Próxima página' }));
    expect(await screen.findByText('Insumo 8')).toBeInTheDocument();
    expect(screen.getByText(/Mostrando 11–12 de 12 itens/)).toBeInTheDocument();
  });

  it('busca por nome, SKU ou descrição e mostra estado de nada encontrado', async () => {
    renderPage();
    await screen.findByText('Toxina');
    const search = screen.getByLabelText('Buscar por nome ou SKU');
    await userEvent.type(search, 'hialur');
    expect(await screen.findByText(/Mostrando 1–1 de 1 item \(de 12\)/)).toBeInTheDocument();
    expect(screen.getByText('Ácido')).toBeInTheDocument();
    expect(screen.queryByText('Toxina')).not.toBeInTheDocument();

    await userEvent.clear(search);
    await userEvent.type(search, 'tx-1');
    expect(await screen.findByText('Toxina')).toBeInTheDocument();

    await userEvent.clear(search);
    await userEvent.type(search, 'nada');
    expect(await screen.findByText('Nenhum item encontrado com os filtros')).toBeInTheDocument();
    expect(screen.getByText('Tente ajustar a busca ou o filtro.')).toBeInTheDocument();
  });

  it('filtro "Abaixo do mínimo" lista só itens com estoque baixo', async () => {
    renderPage();
    await screen.findByText('Toxina');
    await userEvent.click(screen.getByRole('combobox', { name: 'Filtrar estoque' }));
    await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'Abaixo do mínimo' }));
    expect(await screen.findByText(/Mostrando 1–2 de 2 itens \(de 12\)/)).toBeInTheDocument();
    expect(screen.getByText('Gaze')).toBeInTheDocument();
    expect(screen.getByText('Ácido')).toBeInTheDocument();
    expect(screen.queryByText('Toxina')).not.toBeInTheDocument();
  });

  it('estoque vazio: mensagem de cadastro, Movimentar desabilitado e exportação avisa', async () => {
    mocked(inventoryApi.list).mockResolvedValue([]);
    mocked(downloadCsv).mockReturnValue(false);
    renderPage();
    expect(await screen.findByText('Nenhum item no estoque')).toBeInTheDocument();
    expect(screen.getByText('Cadastre produtos e insumos para controlar o estoque.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Movimentar' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    await waitFor(() => expect(dialogs.alert).toHaveBeenCalledWith(expect.objectContaining({ message: 'Nenhum item para exportar.' })));
  });

  it('exporta CSV com todos os itens', async () => {
    mocked(downloadCsv).mockReturnValue(true);
    renderPage();
    await screen.findByText('Toxina');
    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    const [filename, rows, headers] = mocked(downloadCsv).mock.calls[0];
    expect(filename).toBe('estoque.csv');
    expect(rows).toHaveLength(12);
    expect(rows[0]).toEqual({ Nome: 'Toxina', SKU: 'TX-1', Quantidade: '8', 'Qtd Mínima': '3', Unidade: 'un', 'Custo Unitário': '900.00' });
    expect(rows[3]['Unidade']).toBe('');
    expect(headers).toEqual(['Nome', 'SKU', 'Quantidade', 'Qtd Mínima', 'Unidade', 'Custo Unitário']);
    expect(dialogs.alert).not.toHaveBeenCalled();
  });

  it('botões da barra abrem movimentação livre e compra em lote', async () => {
    renderPage();
    await screen.findByText('Toxina');
    await userEvent.click(screen.getByRole('button', { name: 'Movimentar' }));
    expect(screen.getByRole('dialog', { name: 'movimento' })).toHaveTextContent('Movimento livre (12 produtos)');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar item' }));
    expect(screen.getByRole('dialog', { name: 'lote' })).toBeInTheDocument();
  });

  it('sem permissões esconde adicionar item e as ações do detalhe', async () => {
    auth.user.permissions = [];
    renderPage();
    await screen.findByText('Toxina');
    expect(screen.queryByRole('button', { name: 'Cadastrar produto' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adicionar item' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('Toxina'));
    await waitFor(() => expect(inventoryApi.findOne).toHaveBeenCalledWith('a'));
    await screen.findByText('Lotes cadastrados');
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    // Excluir fica visível; sem permissão, explica em vez de esconder.
    await userEvent.click(screen.getByRole('button', { name: 'Excluir item' }));
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('não tem permissão para excluir itens'));
  });

  it('clicar numa linha abre o detalhe; de lá edita, movimenta e abre a página do item', async () => {
    renderPage();
    await userEvent.click(await screen.findByText('Toxina'));
    await screen.findByText('Lotes cadastrados');

    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    // os stubs ficam fora da gaveta modal, então o MUI os marca como aria-hidden
    expect(screen.getByRole('dialog', { name: 'form', hidden: true })).toHaveTextContent('Editar Toxina');

    // o botão "Movimentar" da gaveta (a barra da página fica por trás da gaveta modal)
    await userEvent.click(screen.getAllByRole('button', { name: 'Movimentar', hidden: true }).pop()!);
    expect(screen.getByRole('dialog', { name: 'movimento', hidden: true })).toHaveTextContent('Movimento de Toxina');

    await userEvent.click(screen.getByRole('button', { name: 'Abrir página do item' }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/estoque/a');
  });

  it('ícone Excluir na linha confirma e remove sem abrir o detalhe', async () => {
    mocked(inventoryApi.getDeletionPreview).mockResolvedValue({ procedures: [], appointmentCount: 0, movementsCount: 0, canDelete: true });
    mocked(inventoryApi.remove).mockResolvedValue(undefined);
    renderPage();
    await screen.findByText('Toxina');
    await userEvent.click(screen.getByRole('button', { name: 'Excluir Toxina' }));
    await waitFor(() => expect(inventoryApi.remove).toHaveBeenCalledWith('a'));
    expect(inventoryApi.findOne).not.toHaveBeenCalled();
  });

  it('exclusão: consulta o que será afetado, confirma e remove', async () => {
    mocked(inventoryApi.getDeletionPreview).mockResolvedValue({
      procedures: [{ id: 'p1', name: 'Botox glabela' }],
      appointmentCount: 2,
      movementsCount: 5,
      canDelete: true,
    });
    mocked(inventoryApi.remove).mockResolvedValue(undefined);
    const { invalidate } = renderPage();
    await userEvent.click(await screen.findByText('Toxina'));
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir item' }));

    await waitFor(() => expect(dialogs.confirm).toHaveBeenCalled());
    expect(inventoryApi.getDeletionPreview).toHaveBeenCalledWith('a');
    expect(dialogs.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Excluir item',
        message: 'Excluir o item "Toxina"? Esta ação não pode ser desfeita.',
        detailsTitle: 'Procedimentos que usam este item:',
        details: ['Botox glabela', '2 agendamento(s) com este material', '5 movimentação(ões) de estoque serão removidas'],
        disableConfirm: false,
      }),
    );
    await waitFor(() => expect(inventoryApi.remove).toHaveBeenCalledWith('a'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Item excluído.'));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['inventory'] });
  });

  it('item em uso: o diálogo vem com a confirmação desabilitada e nada é excluído se cancelar', async () => {
    mocked(inventoryApi.getDeletionPreview).mockResolvedValue({
      procedures: [{ id: 'p1', name: 'Botox' }],
      appointmentCount: 3,
      movementsCount: 4,
      canDelete: false,
    });
    dialogs.confirm.mockResolvedValue(false);
    renderPage();
    await userEvent.click(await screen.findByText('Toxina'));
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir item' }));
    await waitFor(() => expect(dialogs.confirm).toHaveBeenCalled());
    const arg = dialogs.confirm.mock.calls[0][0];
    expect(arg.message).toBe('O item "Toxina" não pode ser excluído enquanto estiver em uso. Há 3 agendamento(s) com este material.');
    expect(arg.disableConfirm).toBe(true);
    expect(arg.details).toEqual(['Botox', '3 agendamento(s) com este material']);
    expect(inventoryApi.remove).not.toHaveBeenCalled();
  });

  it('falha ao consultar a exclusão mostra alerta de erro; falha ao excluir mostra toast', async () => {
    mocked(inventoryApi.getDeletionPreview).mockRejectedValueOnce({ response: { data: { message: 'Sem acesso' } } });
    renderPage();
    await userEvent.click(await screen.findByText('Toxina'));
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir item' }));
    await waitFor(() => expect(dialogs.alert).toHaveBeenCalledWith({ title: 'Erro', message: 'Sem acesso', severity: 'error' }));
    expect(dialogs.confirm).not.toHaveBeenCalled();

    mocked(inventoryApi.getDeletionPreview).mockResolvedValueOnce({ procedures: [], appointmentCount: 0, movementsCount: 0, canDelete: true });
    mocked(inventoryApi.remove).mockRejectedValueOnce({ response: { data: { message: 'Falhou' } } });
    await userEvent.click(screen.getByRole('button', { name: 'Excluir item' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Falhou'));
    expect(dialogs.confirm.mock.calls[0][0].details).toBeUndefined();
  });
});
