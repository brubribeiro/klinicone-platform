import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { paymentMethodsApi } from '../../api/paymentMethods';
import type { PaymentMethodEntry } from '../../types';
import { PaymentMethodFormDialog } from './PaymentMethodFormDialog';

vi.mock('../../api/paymentMethods', () => ({ paymentMethodsApi: { create: vi.fn(), update: vi.fn() } }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), showToast: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

function renderDialog(props: Partial<React.ComponentProps<typeof PaymentMethodFormDialog>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <PaymentMethodFormDialog open onClose={onClose} {...props} />
    </QueryClientProvider>,
  );
  return { onClose, invalidate };
}

const nameInput = () => screen.getByPlaceholderText('Ex.: Crédito à vista');
const submit = (label = 'Criar forma de pagamento') => userEvent.click(screen.getByRole('button', { name: label }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PaymentMethodFormDialog', () => {
  it('exige o nome', async () => {
    renderDialog();
    await submit();
    expect(await screen.findByText('Nome é obrigatório')).toBeInTheDocument();
    expect(paymentMethodsApi.create).not.toHaveBeenCalled();
  });

  it('cria cartão de crédito com taxa e prazo, mostrando o líquido de R$ 100', async () => {
    mocked(paymentMethodsApi.create).mockResolvedValue({});
    const { onClose, invalidate } = renderDialog();
    await userEvent.type(nameInput(), '  Crédito 12x ');
    await userEvent.click(screen.getAllByRole('combobox')[1]);
    await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'Crédito' }));

    const [days, fee] = screen.getAllByRole('spinbutton');
    await userEvent.clear(days);
    await userEvent.type(days, '30');
    expect(screen.getByText('30 dias para receber')).toBeInTheDocument();
    await userEvent.type(fee, '3.5');
    expect(screen.getByText('3,5%')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*96,50/)).toBeInTheDocument();
    await submit();

    await waitFor(() =>
      expect(paymentMethodsApi.create).toHaveBeenCalledWith({
        name: 'Crédito 12x',
        kind: 'CREDIT',
        settlementDays: 30,
        feePercent: 3.5,
        active: true,
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith('Forma de pagamento criada.');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['payment-methods'] });
  });

  it('campos numéricos vazios viram zero e o prazo mostra recebimento imediato', async () => {
    mocked(paymentMethodsApi.create).mockResolvedValue({});
    renderDialog();
    await userEvent.type(nameInput(), 'Dinheiro');
    expect(screen.getByText('Recebimento imediato')).toBeInTheDocument();
    const [days] = screen.getAllByRole('spinbutton');
    await userEvent.clear(days);
    await submit();
    await waitFor(() => expect(paymentMethodsApi.create).toHaveBeenCalledTimes(1));
    expect(paymentMethodsApi.create).toHaveBeenCalledWith({
      name: 'Dinheiro',
      kind: 'OTHER',
      settlementDays: 0,
      feePercent: 0,
      active: true,
    });
  });

  it('valida taxa acima de 100% e prazo acima de 365 dias', async () => {
    renderDialog();
    await userEvent.type(nameInput(), 'X');
    const [days, fee] = screen.getAllByRole('spinbutton');
    await userEvent.clear(days);
    await userEvent.type(days, '400');
    await userEvent.type(fee, '150');
    await submit();
    expect(await screen.findByText('Máximo 100%')).toBeInTheDocument();
    expect(screen.getByText('Máximo 365 dias')).toBeInTheDocument();
    expect(screen.queryByText('líquido a cada', { exact: false })).not.toBeInTheDocument();
    expect(paymentMethodsApi.create).not.toHaveBeenCalled();
  });

  it('valida valores negativos', async () => {
    renderDialog();
    await userEvent.type(nameInput(), 'X');
    const [days, fee] = screen.getAllByRole('spinbutton');
    await userEvent.clear(days);
    await userEvent.type(days, '-1');
    await userEvent.type(fee, '-2');
    await submit();
    expect(await screen.findAllByText('Não pode ser negativo')).toHaveLength(2);
  });

  it('edita forma existente, com uso no subtítulo, e pode inativá-la', async () => {
    const editing: PaymentMethodEntry = {
      id: 'm1',
      name: 'Débito',
      kind: 'DEBIT',
      settlementDays: 1,
      feePercent: '1.99',
      active: true,
      _count: { financialEntries: 12 },
    };
    mocked(paymentMethodsApi.update).mockResolvedValue({});
    const { onClose } = renderDialog({ editing });
    expect(screen.getByText('Editar forma de pagamento')).toBeInTheDocument();
    expect(screen.getByText('Débito · 12 lançamento(s)')).toBeInTheDocument();
    expect(nameInput()).toHaveValue('Débito');
    expect(screen.getByText('1 dia útil para receber')).toBeInTheDocument();
    expect(screen.getByText('Disponível nos lançamentos')).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('combobox')[0]);
    await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'Inativa' }));
    expect(screen.getByText('Oculta nos lançamentos')).toBeInTheDocument();
    await submit('Salvar');
    await waitFor(() =>
      expect(paymentMethodsApi.update).toHaveBeenCalledWith('m1', {
        name: 'Débito',
        kind: 'DEBIT',
        settlementDays: 1,
        feePercent: 1.99,
        active: false,
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith('Forma de pagamento atualizada.');
  });

  it('mostra erro da API ao criar e ao atualizar', async () => {
    mocked(paymentMethodsApi.create).mockRejectedValue({ response: { data: { message: 'Nome já existe' } } });
    const first = renderDialog();
    await userEvent.type(nameInput(), 'Pix');
    await submit();
    expect((await screen.findAllByText('Nome já existe')).length).toBeGreaterThan(0);
    expect(toast.error).toHaveBeenCalledWith('Nome já existe');
    expect(first.onClose).not.toHaveBeenCalled();
  });

  it('erro ao atualizar usa mensagem padrão', async () => {
    mocked(paymentMethodsApi.update).mockRejectedValue({});
    renderDialog({ editing: { id: 'm2', name: 'Pix', feePercent: 0, active: true } });
    await submit('Salvar');
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não foi possível atualizar a forma de pagamento.'));
    expect(await screen.findByText('Erro ao salvar forma de pagamento')).toBeInTheDocument();
  });

  it('cancelar fecha', async () => {
    const { onClose } = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
  });
});
