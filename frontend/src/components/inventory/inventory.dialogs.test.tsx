import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { inventoryApi } from '../../api/inventory';
import { FALLBACK_INVENTORY_UNITS } from '../../features/platformCatalog';
import type { InventoryItem } from '../../types';
import { InventoryFormDialog } from './InventoryFormDialog';
import { MovementDialog } from './MovementDialog';

vi.mock('../../api/inventory', () => ({
  inventoryApi: { create: vi.fn(), update: vi.fn(), createMovement: vi.fn() },
}));
vi.mock('../../hooks/usePlatformCatalog', () => ({ usePlatformCatalog: () => FALLBACK_INVENTORY_UNITS }));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), showToast: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

function renderWith(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return { invalidate };
}

const toxina: InventoryItem = {
  id: 'i1',
  name: 'Toxina botulínica',
  sku: 'TB-100',
  description: 'Frasco 100U',
  quantity: 8,
  minQuantity: 3,
  unit: 'un',
  costPrice: '900',
  expiryNotifyDaysBefore: 20,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('InventoryFormDialog', () => {
  const nameInput = () => screen.getAllByRole('textbox')[0];

  it('exige o nome do produto', async () => {
    renderWith(<InventoryFormDialog open onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Criar item' }));
    expect(await screen.findByText('Nome é obrigatório')).toBeInTheDocument();
    expect(inventoryApi.create).not.toHaveBeenCalled();
  });

  it('cria item enviando só os campos preenchidos', async () => {
    mocked(inventoryApi.create).mockResolvedValue({ id: 'n' });
    const onClose = vi.fn();
    const { invalidate } = renderWith(<InventoryFormDialog open onClose={onClose} />);
    expect(screen.getByText('Novo item de estoque')).toBeInTheDocument();

    await userEvent.type(nameInput(), 'Máscara descartável');
    await userEvent.click(screen.getByRole('button', { name: 'Criar item' }));

    await waitFor(() => expect(inventoryApi.create).toHaveBeenCalled());
    expect(mocked(inventoryApi.create).mock.calls[0][0]).toEqual({
      name: 'Máscara descartável',
      minQuantity: 0,
      expiryNotifyDaysBefore: null,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith('Item criado.');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['inventory'] });
  });

  it('cria item completo: SKU, unidade, mínimo, custo e alerta de validade', async () => {
    mocked(inventoryApi.create).mockResolvedValue({ id: 'n' });
    renderWith(<InventoryFormDialog open onClose={vi.fn()} />);

    await userEvent.type(nameInput(), 'Ácido');
    const [, sku] = screen.getAllByRole('textbox');
    await userEvent.type(sku, 'AC-1');

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'Mililitro (ml)' }));

    const [min, notify] = screen.getAllByRole('spinbutton');
    await userEvent.clear(min);
    await userEvent.type(min, '4');
    await userEvent.type(notify, '30');
    await userEvent.type(screen.getByPlaceholderText('0,00'), '12550');

    await userEvent.click(screen.getByRole('button', { name: 'Criar item' }));
    await waitFor(() => expect(inventoryApi.create).toHaveBeenCalled());
    expect(mocked(inventoryApi.create).mock.calls[0][0]).toEqual({
      name: 'Ácido',
      sku: 'AC-1',
      unit: 'ml',
      minQuantity: 4,
      costPrice: 125.5,
      expiryNotifyDaysBefore: 30,
    });
  });

  it('edição: preenche valores atuais e chama update', async () => {
    mocked(inventoryApi.update).mockResolvedValue(toxina);
    renderWith(<InventoryFormDialog open onClose={vi.fn()} item={toxina} />);
    expect(screen.getByText('Editar item')).toBeInTheDocument();
    expect(screen.getByText(/Toxina botulínica · 8 un em estoque/)).toBeInTheDocument();
    expect(nameInput()).toHaveValue('Toxina botulínica');
    expect(screen.getByPlaceholderText('0,00')).toHaveValue('900,00');
    expect(screen.getAllByRole('spinbutton')[1]).toHaveValue(20);

    await userEvent.clear(nameInput());
    await userEvent.type(nameInput(), 'Toxina 100U');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(inventoryApi.update).toHaveBeenCalled());
    expect(mocked(inventoryApi.update).mock.calls[0]).toEqual([
      'i1',
      {
        name: 'Toxina 100U',
        sku: 'TB-100',
        description: 'Frasco 100U',
        unit: 'un',
        minQuantity: 3,
        costPrice: 900,
        expiryNotifyDaysBefore: 20,
      },
    ]);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Item atualizado.'));
  });

  it('limpar o alerta de validade envia null', async () => {
    mocked(inventoryApi.update).mockResolvedValue(toxina);
    renderWith(<InventoryFormDialog open onClose={vi.fn()} item={toxina} />);
    await userEvent.clear(screen.getAllByRole('spinbutton')[1]);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(inventoryApi.update).toHaveBeenCalled());
    expect(mocked(inventoryApi.update).mock.calls[0][1]).toMatchObject({ expiryNotifyDaysBefore: null });
  });

  it('falha na API avisa por toast e não fecha', async () => {
    mocked(inventoryApi.create).mockRejectedValue({ response: { data: { message: 'SKU já existe' } } });
    const onClose = vi.fn();
    renderWith(<InventoryFormDialog open onClose={onClose} />);
    await userEvent.type(nameInput(), 'Dup');
    await userEvent.click(screen.getByRole('button', { name: 'Criar item' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('SKU já existe'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('MovementDialog', () => {
  const qty = () => screen.getByRole('spinbutton', { name: 'Quantidade' });
  const total = () => screen.getByRole('textbox', { name: 'Valor total da compra' });

  it('entrada exige valor total e validade; mostra custo unitário e quantidade resultante', async () => {
    renderWith(<MovementDialog open onClose={vi.fn()} item={toxina} />);
    expect(screen.getByText(/Toxina botulínica · estoque atual: 8 un/)).toBeInTheDocument();
    // item tem custo 900: o total já vem sugerido para 1 unidade
    expect(total()).toHaveValue('900,00');
    expect(screen.getByText('Quantidade resultante: 9')).toBeInTheDocument();

    await userEvent.clear(qty());
    await userEvent.type(qty(), '3');
    expect(screen.getByText('Quantidade resultante: 11')).toBeInTheDocument();
    await userEvent.clear(total());
    await userEvent.type(total(), '270000');
    expect(screen.getByText(/Custo unitário: R\$\s*900,00 · gera despesa/)).toBeInTheDocument();

    // sem validade não envia
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('Data de validade é obrigatória para entradas')).toBeInTheDocument();
    expect(inventoryApi.createMovement).not.toHaveBeenCalled();
  });

  it('registra a entrada com validade, valor total e motivo e atualiza estoque e financeiro', async () => {
    mocked(inventoryApi.createMovement).mockResolvedValue({});
    const onClose = vi.fn();
    const { invalidate } = renderWith(<MovementDialog open onClose={onClose} item={toxina} />);

    await userEvent.clear(qty());
    await userEvent.type(qty(), '2');
    await userEvent.clear(total());
    await userEvent.type(total(), '180000');
    await userEvent.type(screen.getByRole('textbox', { name: 'Motivo' }), 'Compra fornecedor');
    await userEvent.type(screen.getByLabelText('Data de validade do lote'), '2027-05-20');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(inventoryApi.createMovement).toHaveBeenCalled());
    expect(mocked(inventoryApi.createMovement).mock.calls[0]).toEqual([
      'i1',
      { type: 'IN', quantity: 2, reason: 'Compra fornecedor', expiresAt: '2027-05-20T12:00:00.000Z', totalPrice: 1800 },
    ]);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith('Movimentação registrada.');
    for (const key of ['inventory', 'finance', 'finance-summary']) {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: [key] });
    }
  });

  it('saída maior que o estoque bloqueia a confirmação', async () => {
    renderWith(<MovementDialog open onClose={vi.fn()} item={toxina} />);
    await userEvent.click(screen.getByRole('button', { name: 'Saída' }));
    await userEvent.clear(qty());
    await userEvent.type(qty(), '9');
    expect(screen.getByText('Estoque insuficiente para essa saída.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
  });

  it('saída válida não envia valor nem validade', async () => {
    mocked(inventoryApi.createMovement).mockResolvedValue({});
    renderWith(<MovementDialog open onClose={vi.fn()} item={toxina} />);
    await userEvent.click(screen.getByRole('button', { name: 'Saída' }));
    expect(screen.queryByRole('textbox', { name: 'Valor total da compra' })).not.toBeInTheDocument();
    await userEvent.clear(qty());
    await userEvent.type(qty(), '3');
    expect(screen.getByText('Quantidade resultante: 5')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(inventoryApi.createMovement).toHaveBeenCalled());
    expect(mocked(inventoryApi.createMovement).mock.calls[0]).toEqual(['i1', { type: 'OUT', quantity: 3 }]);
  });

  it('ajuste informa a nova quantidade total', async () => {
    mocked(inventoryApi.createMovement).mockResolvedValue({});
    renderWith(<MovementDialog open onClose={vi.fn()} item={toxina} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ajuste' }));
    expect(screen.getByText('Nova quantidade total')).toBeInTheDocument();
    await userEvent.clear(qty());
    await userEvent.type(qty(), '12');
    expect(screen.getByText('O estoque ficará com 12 unidades')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(inventoryApi.createMovement).toHaveBeenCalled());
    expect(mocked(inventoryApi.createMovement).mock.calls[0][1]).toEqual({ type: 'ADJUSTMENT', quantity: 12 });
  });

  it('ajuste pode zerar o estoque', async () => {
    mocked(inventoryApi.createMovement).mockResolvedValue({});
    renderWith(<MovementDialog open onClose={vi.fn()} item={toxina} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ajuste' }));
    await userEvent.clear(qty());
    await userEvent.type(qty(), '0');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(inventoryApi.createMovement).toHaveBeenCalled());
    expect(mocked(inventoryApi.createMovement).mock.calls[0][1]).toEqual({ type: 'ADJUSTMENT', quantity: 0 });
    expect(screen.queryByText('A quantidade mínima é 1')).not.toBeInTheDocument();
  });

  it('quantidade zero mostra a validação', async () => {
    renderWith(<MovementDialog open onClose={vi.fn()} item={{ ...toxina, costPrice: undefined }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Saída' }));
    await userEvent.clear(qty());
    await userEvent.type(qty(), '0');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('A quantidade mínima é 1')).toBeInTheDocument();
    expect(inventoryApi.createMovement).not.toHaveBeenCalled();
  });

  it('sem item fixo escolhe o produto na lista; sem item nem lista não renderiza', async () => {
    const other: InventoryItem = { id: 'i2', name: 'Seringa', sku: 'SR-1', quantity: 100, minQuantity: 10 };
    const { unmount } = render(
      <QueryClientProvider client={new QueryClient()}>
        <MovementDialog open onClose={vi.fn()} item={null} items={[toxina, other]} />
      </QueryClientProvider>,
    );
    expect(screen.getByText(/Escolha o produto/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
    await userEvent.click(screen.getByRole('combobox', { name: 'Produto' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Seringa (SR-1)' }));
    expect(screen.getByText('Quantidade resultante: 101')).toBeInTheDocument();
    unmount();

    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <MovementDialog open onClose={vi.fn()} item={null} />
      </QueryClientProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('erro da API aparece no alerta e por toast', async () => {
    mocked(inventoryApi.createMovement).mockRejectedValue({ response: { data: { message: 'Estoque mudou' } } });
    renderWith(<MovementDialog open onClose={vi.fn()} item={toxina} />);
    await userEvent.click(screen.getByRole('button', { name: 'Saída' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('Estoque mudou')).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith('Estoque mudou');
  });
});
