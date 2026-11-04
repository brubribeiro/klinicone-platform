import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { inventoryApi } from '../../api/inventory';
import { FALLBACK_INVENTORY_UNITS } from '../../features/platformCatalog';
import type { InventoryItem } from '../../types';
import { BulkPurchaseDialog } from './BulkPurchaseDialog';

vi.mock('../../api/inventory', () => ({ inventoryApi: { list: vi.fn(), createBulkPurchase: vi.fn() } }));
vi.mock('../../hooks/usePlatformCatalog', () => ({ usePlatformCatalog: () => FALLBACK_INVENTORY_UNITS }));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), showToast: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const items: InventoryItem[] = [
  { id: 'i1', name: 'Toxina', sku: 'TX-1', quantity: 5, minQuantity: 2, unit: 'un' },
  { id: 'i2', name: 'Gaze', quantity: 50, minQuantity: 10, unit: 'pct' },
];

function renderDialog() {
  const onClose = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <BulkPurchaseDialog open onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose, invalidate };
}

const confirm = () => screen.getByRole('button', { name: 'Confirmar compra' });

async function pickProduct(index: number, name: string) {
  await userEvent.click(screen.getAllByRole('combobox', { name: 'Produto' })[index]);
  await userEvent.click(await screen.findByRole('option', { name: name }));
}

async function fill(label: string, index: number, value: string) {
  const el = screen.getAllByLabelText(label)[index];
  await userEvent.clear(el);
  await userEvent.type(el, value);
}

function setDate(index: number, value: string) {
  return fill('Validade do lote', index, value);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked(inventoryApi.list).mockResolvedValue(items);
});

describe('BulkPurchaseDialog', () => {
  it('começa com uma linha, totais zerados e confirmação desabilitada', () => {
    renderDialog();
    expect(screen.getByText('Compra em lote')).toBeInTheDocument();
    expect(screen.getByText('ITENS DA COMPRA · 1')).toBeInTheDocument();
    expect(confirm()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remover linha' })).toBeDisabled();
    expect(screen.getAllByText(/R\$\s*0,00/).length).toBeGreaterThanOrEqual(3);
  });

  it('rateia o frete proporcionalmente e envia o payload da compra com produto existente e novo', async () => {
    mocked(inventoryApi.createBulkPurchase).mockResolvedValue({});
    const { onClose, invalidate } = renderDialog();

    // linha 1: produto existente, 2 × R$ 10,00
    await pickProduct(0, 'Toxina (TX-1)');
    await fill('Quantidade', 0, '2');
    await fill('Valor unitário', 0, '1000');
    await setDate(0, '2027-01-31');
    expect(screen.getByText('un')).toBeInTheDocument();

    // linha 2: produto novo, 1 × R$ 30,00
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar produto' }));
    expect(screen.getByText('ITENS DA COMPRA · 2')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Nome do novo produto'), '  Cânula 25G ');
    await userEvent.type(screen.getByLabelText('SKU do novo produto'), 'CN-25');
    await fill('Estoque mínimo', 0, '4');
    await fill('Quantidade', 1, '1');
    await fill('Valor unitário', 1, '3000');
    await setDate(1, '2027-02-28');
    await userEvent.click(screen.getByLabelText('Unidade'));
    await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'Caixa (cx)' }));

    await userEvent.type(screen.getByLabelText('Frete da compra'), '1000');
    await userEvent.type(screen.getByLabelText('Descrição da compra'), ' NF 123 ');

    // subtotal 50, frete 10 -> total 60; custo final: (20+4)/2 = 12 e 30+6 = 36
    expect(screen.getByText('Subtotal produtos').nextSibling).toHaveTextContent(/R\$\s*50,00/);
    expect(screen.getByText('Total da compra').nextSibling).toHaveTextContent(/R\$\s*60,00/);
    expect(screen.getByText(/R\$\s*4,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*6,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*12,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*36,00/)).toBeInTheDocument();

    expect(confirm()).toBeEnabled();
    await userEvent.click(confirm());
    await waitFor(() => expect(inventoryApi.createBulkPurchase).toHaveBeenCalled());
    expect(mocked(inventoryApi.createBulkPurchase).mock.calls[0][0]).toEqual({
      reason: 'NF 123',
      freight: 10,
      lines: [
        { itemId: 'i1', quantity: 2, productTotal: 20, expiresAt: '2027-01-31T12:00:00.000Z' },
        {
          newItem: { name: 'Cânula 25G', sku: 'CN-25', minQuantity: 4, unit: 'cx' },
          quantity: 1,
          productTotal: 30,
          expiresAt: '2027-02-28T12:00:00.000Z',
        },
      ],
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith('Compra registrada.');
    for (const key of ['inventory', 'finance', 'finance-summary']) {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: [key] });
    }
  });

  it('só habilita a confirmação com produto, quantidade, valor e validade em todas as linhas', async () => {
    renderDialog();
    await pickProduct(0, 'Gaze');
    await fill('Valor unitário', 0, '500');
    expect(confirm()).toBeDisabled(); // falta validade
    await setDate(0, '2027-03-01');
    expect(confirm()).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'Adicionar linha' }));
    expect(confirm()).toBeDisabled(); // linha nova vazia
    const remove = screen.getAllByRole('button', { name: 'Remover linha' });
    expect(remove[1]).toBeEnabled();
    await userEvent.click(remove[1]);
    expect(screen.getByText('ITENS DA COMPRA · 1')).toBeInTheDocument();
    expect(confirm()).toBeEnabled();
  });

  it('quantidade zero mantém a confirmação desabilitada e sem frete o payload não leva freight', async () => {
    mocked(inventoryApi.createBulkPurchase).mockResolvedValue({});
    renderDialog();
    await pickProduct(0, 'Gaze');
    await fill('Valor unitário', 0, '500');
    await setDate(0, '2027-03-01');
    await fill('Quantidade', 0, '0');
    expect(confirm()).toBeDisabled();
    await fill('Quantidade', 0, '1.5');
    expect(screen.getByText('Subtotal produtos').nextSibling).toHaveTextContent(/R\$\s*7,50/);
    await userEvent.click(confirm());
    await waitFor(() => expect(inventoryApi.createBulkPurchase).toHaveBeenCalled());
    expect(mocked(inventoryApi.createBulkPurchase).mock.calls[0][0]).toEqual({
      lines: [{ itemId: 'i2', quantity: 1.5, productTotal: 7.5, expiresAt: '2027-03-01T12:00:00.000Z' }],
    });
  });

  it('erro da API aparece no alerta e a compra não fecha', async () => {
    mocked(inventoryApi.createBulkPurchase).mockRejectedValue({ response: { data: { message: 'Item inativo' } } });
    const { onClose } = renderDialog();
    await pickProduct(0, 'Gaze');
    await fill('Valor unitário', 0, '500');
    await setDate(0, '2027-03-01');
    await userEvent.click(confirm());
    expect(await screen.findByText('Item inativo')).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith('Item inativo');
    expect(onClose).not.toHaveBeenCalled();
  });
});
