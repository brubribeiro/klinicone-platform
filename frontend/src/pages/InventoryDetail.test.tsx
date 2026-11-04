import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { inventoryApi, type InventoryItemWithMovements } from '../api/inventory';
import type { InventoryItem } from '../types';
import { InventoryDetail } from './InventoryDetail';

vi.mock('../api/inventory', () => ({ inventoryApi: { findOne: vi.fn() } }));
vi.mock('../components/inventory/InventoryFormDialog', () => ({
  InventoryFormDialog: ({ open, onClose, item }: { open: boolean; onClose: () => void; item?: InventoryItem | null }) =>
    open ? (
      <div role="dialog" aria-label="form">
        Editar {item?.name}
        <button onClick={onClose}>fechar form</button>
      </div>
    ) : null,
}));
vi.mock('../components/inventory/MovementDialog', () => ({
  MovementDialog: ({ open, onClose, item }: { open: boolean; onClose: () => void; item: InventoryItem | null }) =>
    open ? (
      <div role="dialog" aria-label="movimento">
        Movimento de {item?.name}
        <button onClick={onClose}>fechar movimento</button>
      </div>
    ) : null,
}));

const auth = vi.hoisted(() => ({ user: { id: 'u', name: 'Ana', permissions: [] as string[] } }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const detail: InventoryItemWithMovements = {
  id: 'a',
  name: 'Toxina',
  sku: 'TX-1',
  quantity: 8,
  minQuantity: 3,
  unit: 'un',
  costPrice: 900,
  movements: [{ id: 'm1', itemId: 'a', type: 'IN', quantity: 8, expiresAt: '2027-01-01', createdAt: '2026-03-01T10:00:00' }],
};

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/estoque/a']}>
        <Routes>
          <Route path="/estoque/:id" element={<InventoryDetail />} />
          <Route path="/estoque" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { invalidate };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 2, 15, 10, 0, 0));
  vi.clearAllMocks();
  auth.user.permissions = ['inventory:edit'];
  mocked(inventoryApi.findOne).mockResolvedValue(detail);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('InventoryDetail (página)', () => {
  it('carrega o item da URL e mostra cabeçalho, estoque e movimentações', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: /Toxina/ })).toBeInTheDocument();
    expect(inventoryApi.findOne).toHaveBeenCalledWith('a');
    expect(screen.getByText('SKU TX-1')).toBeInTheDocument();
    expect(screen.getByText('8 un')).toBeInTheDocument();
    expect(screen.getByText('val. 01/01/2027')).toBeInTheDocument();
    expect(screen.getByText('+8 un')).toBeInTheDocument();
  });

  it('item inexistente mostra erro e permite voltar ao estoque', async () => {
    mocked(inventoryApi.findOne).mockRejectedValue(new Error('404'));
    renderPage();
    expect(await screen.findByText('Item não encontrado.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Voltar ao estoque' }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/estoque');
  });

  it('com permissão: edita e movimenta; ao fechar recarrega só este item', async () => {
    const { invalidate } = renderPage();
    await screen.findByRole('heading', { name: /Toxina/ });

    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByRole('dialog', { name: 'form' })).toHaveTextContent('Editar Toxina');
    await userEvent.click(screen.getByRole('button', { name: 'fechar form' }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['inventory', 'a'] });
    expect(screen.queryByRole('dialog', { name: 'form' })).not.toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Movimentar' })[0]);
    expect(screen.getByRole('dialog', { name: 'movimento' })).toHaveTextContent('Movimento de Toxina');
    await userEvent.click(screen.getByRole('button', { name: 'fechar movimento' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'movimento' })).not.toBeInTheDocument());

    // o botão "Nova" da lista de movimentações também abre a movimentação
    await userEvent.click(screen.getByRole('button', { name: 'Nova' }));
    expect(screen.getByRole('dialog', { name: 'movimento' })).toBeInTheDocument();
  });

  it('sem permissão de edição não mostra editar nem movimentar', async () => {
    auth.user.permissions = [];
    renderPage();
    await screen.findByRole('heading', { name: /Toxina/ });
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Movimentar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nova' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voltar ao estoque' })).toBeInTheDocument();
  });
});
