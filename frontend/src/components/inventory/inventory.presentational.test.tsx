import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { inventoryApi, type InventoryItemWithMovements } from '../../api/inventory';
import type { InventoryItem } from '../../types';
import { InventoryListRow } from './InventoryListRow';
import { InventoryDetailBody, InventoryDetailHero, StatusPill } from './InventoryDetailParts';
import { InventoryDetailDrawer } from './InventoryDetailDrawer';
import { BulkPurchaseTotals } from './BulkPurchaseTotals';
import { allocateFreight, emptyLine, lineProductTotal, parseNum } from './bulkPurchase';
import { daysToExpiry, isLowStock, stockStatus } from './inventoryStatus';
import { INVENTORY_UNIT_OPTIONS, inventoryUnitOptions } from './inventoryUnits';

vi.mock('../../api/inventory', () => ({ inventoryApi: { findOne: vi.fn() } }));

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const base: InventoryItem = { id: 'i1', name: 'Ácido hialurônico', quantity: 20, minQuantity: 5, unit: 'ml' };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 2, 10, 10, 0, 0)); // 10/03/2026
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('inventoryStatus', () => {
  it('prioriza falta de estoque sobre validade', () => {
    expect(stockStatus({ ...base, quantity: 20, expiresAt: '2026-12-01' })).toBe('OK');
    expect(stockStatus({ ...base, quantity: 5 })).toBe('LOW');
    expect(stockStatus({ ...base, quantity: 2.5 })).toBe('CRITICAL');
    expect(stockStatus({ ...base, quantity: 0 })).toBe('CRITICAL');
    expect(stockStatus({ ...base, quantity: 4, expiresAt: '2026-01-01' })).toBe('LOW');
    expect(stockStatus({ ...base, expiresAt: '2026-03-20' })).toBe('EXPIRING');
    expect(stockStatus({ ...base, expiresAt: '2026-04-09' })).toBe('EXPIRING');
    expect(stockStatus({ ...base, expiresAt: '2026-04-10' })).toBe('OK');
    expect(stockStatus({ ...base, expiresAt: '2026-03-09' })).toBe('EXPIRED');
  });

  it('isLowStock e daysToExpiry aceitam strings numéricas e datas ISO', () => {
    expect(isLowStock({ quantity: '5' as unknown as number, minQuantity: 5 })).toBe(true);
    expect(isLowStock({ quantity: 6, minQuantity: 5 })).toBe(false);
    expect(daysToExpiry(null)).toBeNull();
    expect(daysToExpiry('2026-03-10')).toBe(0);
    expect(daysToExpiry('2026-03-13T12:00:00.000Z')).toBe(3);
    expect(daysToExpiry('2026-03-08')).toBe(-2);
  });

  it('unidades vêm do catálogo (com fallback)', () => {
    expect(inventoryUnitOptions().length).toBeGreaterThan(0);
    expect(INVENTORY_UNIT_OPTIONS.map((u) => u.value)).toContain('un');
  });
});

describe('bulkPurchase helpers', () => {
  it('parseNum aceita vírgula decimal e ignora lixo', () => {
    expect(parseNum('12,5')).toBe(12.5);
    expect(parseNum('')).toBe(0);
    expect(parseNum(null)).toBe(0);
    expect(parseNum('abc')).toBe(0);
    expect(parseNum(7)).toBe(7);
  });

  it('allocateFreight rateia proporcionalmente e joga a sobra de centavos no último item', () => {
    expect(allocateFreight([{ productTotal: 100 }, { productTotal: 100 }, { productTotal: 100 }], 10)).toEqual([3.33, 3.33, 3.34]);
    expect(allocateFreight([{ productTotal: 300 }, { productTotal: 100 }], 40)).toEqual([30, 10]);
    expect(allocateFreight([{ productTotal: 0 }], 10)).toEqual([0]);
    expect(allocateFreight([{ productTotal: 50 }], 0)).toEqual([0]);
    const shares = allocateFreight([{ productTotal: 33.33 }, { productTotal: 66.67 }, { productTotal: 12.1 }], 17.77);
    expect(Math.round(shares.reduce((s, v) => s + v, 0) * 100) / 100).toBe(17.77);
  });

  it('lineProductTotal = quantidade × valor unitário em centavos; emptyLine tem padrão', () => {
    expect(lineProductTotal({ quantity: 3, unitPrice: 10.1 })).toBe(30.3);
    expect(lineProductTotal({ quantity: 2, unitPrice: '' })).toBe(0);
    expect(emptyLine('new')).toMatchObject({ mode: 'new', newUnit: 'un', quantity: 1, item: null });
  });
});

describe('InventoryListRow', () => {
  it('mostra quantidade/mínimo, validade relativa, status e custo', async () => {
    const onOpen = vi.fn();
    render(
      <InventoryListRow
        item={{ ...base, sku: 'AH-01', quantity: 1.5, minQuantity: 5, costPrice: '120.5', expiresAt: '2026-03-08' }}
        onOpen={onOpen}
      />,
    );
    expect(screen.getByText('Ácido hialurônico')).toBeInTheDocument();
    expect(screen.getByText('AH-01')).toBeInTheDocument();
    expect(screen.getByText('08/03/2026')).toBeInTheDocument();
    expect(screen.getByText('vencido há 2 dias')).toBeInTheDocument();
    expect(screen.getByText(/1,5 \/ 5/)).toBeInTheDocument();
    expect(screen.getByText('Crítico')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*120,50/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['2026-03-10', 'vence hoje'],
    ['2026-03-11', 'em 1 dia'],
    ['2026-03-15', 'em 5 dias'],
    ['2026-03-09', 'vencido há 1 dia'],
  ])('validade %s -> %s', (expiresAt, text) => {
    render(<InventoryListRow item={{ ...base, expiresAt }} onOpen={vi.fn()} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('sem validade, sem SKU e sem custo mostra traços; Enter e Espaço abrem', async () => {
    const onOpen = vi.fn();
    render(<InventoryListRow item={base} onOpen={onOpen} />);
    expect(screen.getByText('sem validade')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(3);
    screen.getByRole('button').focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('StatusPill traduz o status', () => {
    render(<StatusPill item={{ ...base, quantity: 4 }} />);
    expect(screen.getByText('Baixo')).toBeInTheDocument();
  });
});

describe('BulkPurchaseTotals', () => {
  it('mostra subtotal, frete e total em reais', () => {
    render(<BulkPurchaseTotals productsTotal={1000} freight={50.5} grandTotal={1050.5} />);
    expect(screen.getByText(/R\$\s*1\.000,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*50,50/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*1\.050,50/)).toBeInTheDocument();
    expect(screen.getByText(/Uma despesa será lançada/)).toBeInTheDocument();
  });
});

const detail: InventoryItemWithMovements = {
  ...base,
  quantity: 10,
  sku: 'AH-01',
  description: 'Seringa 1ml',
  costPrice: 12.5,
  expiryNotifyDaysBefore: 15,
  expiresAt: '2026-03-20',
  movements: [
    { id: 'm1', itemId: 'i1', type: 'OUT', quantity: 5, reason: 'Procedimento Maria', createdAt: '2026-03-09T10:00:00' },
    { id: 'm2', itemId: 'i1', type: 'IN', quantity: 15, expiresAt: '2026-03-20', createdAt: '2026-03-05T09:30:00' },
    { id: 'm3', itemId: 'i1', type: 'ADJUSTMENT', quantity: 5, reason: 'Inventário', createdAt: '2026-03-01T08:00:00' },
    { id: 'm4', itemId: 'i1', type: 'IN', quantity: 20, expiresAt: '2026-03-20', createdAt: '2026-02-20T08:00:00' },
  ],
};

describe('InventoryDetailHero / InventoryDetailBody', () => {
  it('hero mostra SKU, custo por unidade, validade e alerta', () => {
    render(<InventoryDetailHero item={detail} action={<button>Ação</button>} />);
    expect(screen.getByText('SKU AH-01')).toBeInTheDocument();
    expect(screen.getByText('Seringa 1ml')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*12,50\/ml/)).toBeInTheDocument();
    expect(screen.getByText('20/03/2026')).toBeInTheDocument();
    expect(screen.getByText(/15 dias antes/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ação' })).toBeInTheDocument();
  });

  it('hero sem dados opcionais usa padrões', () => {
    render(<InventoryDetailHero item={{ ...detail, sku: undefined, unit: undefined, costPrice: undefined, expiresAt: undefined, expiryNotifyDaysBefore: undefined, description: undefined }} />);
    expect(screen.getByText('Produto')).toBeInTheDocument();
    expect(screen.getByText(/desativado/)).toBeInTheDocument();
    expect(screen.getByText('—/un')).toBeInTheDocument();
  });

  it('corpo: totais de entradas/saídas, lote agrupado e saldo após cada movimentação', async () => {
    const onNew = vi.fn();
    render(<InventoryDetailBody item={detail} onNewMovement={onNew} />);
    expect(screen.getByText('10 ml')).toBeInTheDocument();
    expect(screen.getByText('+35')).toBeInTheDocument();
    expect(screen.getByText('−5')).toBeInTheDocument();
    expect(screen.getByText(/mín\. 5 ml/)).toBeInTheDocument();
    expect(screen.getByText('val. 20/03/2026')).toBeInTheDocument();
    expect(screen.getByText(/35 ml · 2 entradas ·/)).toBeInTheDocument();
    expect(screen.getByText('Vence em breve')).toBeInTheDocument();

    expect(screen.getByText('Procedimento Maria')).toBeInTheDocument();
    expect(screen.getByText('−5 ml')).toBeInTheDocument();
    expect(screen.getByText('saldo 10')).toBeInTheDocument();
    expect(screen.getByText('+15 ml')).toBeInTheDocument();
    expect(screen.getByText('saldo 15')).toBeInTheDocument();
    expect(screen.getByText('= 5 ml')).toBeInTheDocument();
    expect(screen.getByText('saldo 5')).toBeInTheDocument();
    // a entrada anterior ao ajuste não tem saldo conhecido
    expect(screen.getAllByText(/^saldo /)).toHaveLength(3);
    expect(screen.getByText(/09\/03\/2026 10:00 · Saída/)).toBeInTheDocument();
    expect(screen.getAllByText(/lote val\./)).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: 'Nova' }));
    expect(onNew).toHaveBeenCalled();
  });

  it('corpo sem movimentações mostra estados vazios', () => {
    render(<InventoryDetailBody item={{ ...detail, movements: [] }} />);
    expect(screen.getByText('Nenhuma entrada com data de validade registrada.')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma movimentação registrada.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nova' })).not.toBeInTheDocument();
  });

  it('lote vencido e lote válido recebem o rótulo certo', () => {
    render(
      <InventoryDetailBody
        item={{
          ...detail,
          movements: [
            { id: 'a', itemId: 'i1', type: 'IN', quantity: 1, expiresAt: '2026-03-01', createdAt: '2026-02-01T10:00:00' },
            { id: 'b', itemId: 'i1', type: 'IN', quantity: 2, expiresAt: '2027-01-01', createdAt: '2026-02-02T10:00:00' },
          ],
        }}
      />,
    );
    expect(screen.getByText('Vencido')).toBeInTheDocument();
    expect(screen.getByText('Válido')).toBeInTheDocument();
    expect(screen.getAllByText(/1 entrada ·/)).toHaveLength(2);
  });
});

describe('InventoryDetailDrawer', () => {
  function renderDrawer(props: Partial<React.ComponentProps<typeof InventoryDetailDrawer>> = {}) {
    const h = { onClose: vi.fn(), onMovement: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(), onOpenPage: vi.fn() };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <InventoryDetailDrawer itemId="i1" {...h} {...props} />
      </QueryClientProvider>,
    );
    return h;
  }

  it('carrega o item e dispara as ações do rodapé e do topo', async () => {
    mocked(inventoryApi.findOne).mockResolvedValue(detail);
    const h = renderDrawer();
    expect(await screen.findByRole('heading', { name: /Ácido hialurônico/ })).toBeInTheDocument();
    expect(inventoryApi.findOne).toHaveBeenCalledWith('i1');

    await userEvent.click(screen.getByRole('button', { name: 'Movimentar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Excluir item' }));
    await userEvent.click(screen.getByRole('button', { name: 'Abrir página do item' }));
    await userEvent.click(screen.getByRole('button', { name: 'Fechar detalhes' }));
    expect(h.onMovement).toHaveBeenCalledWith(detail);
    expect(h.onEdit).toHaveBeenCalledWith(detail);
    expect(h.onDelete).toHaveBeenCalledWith(detail);
    expect(h.onOpenPage).toHaveBeenCalledWith('i1');
    expect(h.onClose).toHaveBeenCalled();
  });

  it('sem onEdit/onDelete os botões não aparecem', async () => {
    mocked(inventoryApi.findOne).mockResolvedValue(detail);
    renderDrawer({ onEdit: undefined, onDelete: undefined });
    await screen.findByRole('heading', { name: /Ácido hialurônico/ });
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excluir item' })).not.toBeInTheDocument();
  });

  it('erro na busca mostra "Item não encontrado."', async () => {
    mocked(inventoryApi.findOne).mockRejectedValue(new Error('404'));
    const h = renderDrawer();
    const dialog = await screen.findByText('Item não encontrado.');
    expect(dialog).toBeInTheDocument();
    await userEvent.click(within(document.body).getByRole('button', { name: 'Fechar detalhes' }));
    expect(h.onClose).toHaveBeenCalled();
  });

  it('fechado (itemId null) não busca nada', () => {
    renderDrawer({ itemId: null });
    expect(inventoryApi.findOne).not.toHaveBeenCalled();
  });
});
