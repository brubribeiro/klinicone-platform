import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';

import { CompletePaymentDialog } from './CompletePaymentDialog';
import type { PaymentMethodEntry } from '../../types';

const methods: PaymentMethodEntry[] = [
  { id: 'pix', name: 'Pix', kind: 'PIX', feePercent: 0, active: true },
  { id: 'credit', name: 'Crédito', kind: 'CREDIT', feePercent: '3.5', active: true },
  { id: 'old', name: 'Cheque', kind: 'OTHER', feePercent: 0, active: false },
];

function setup(props: Partial<Parameters<typeof CompletePaymentDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <CompletePaymentDialog
      open
      isMobile={false}
      patientName="Maria Silva"
      procedureName="Limpeza + Peeling"
      isPackage={false}
      amount={350}
      paymentMethods={methods}
      appointmentMonthKey={dayjs().format('YYYY-MM')}
      isPending={false}
      onCancel={onCancel}
      onConfirm={onConfirm}
      {...props}
    />,
  );
  return { onConfirm, onCancel };
}

const confirmButton = () => screen.getByRole('button', { name: 'Confirmar e registrar' });

async function pick(comboboxIndex: number, option: string | RegExp) {
  await userEvent.click(screen.getAllByRole('combobox')[comboboxIndex]);
  await userEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: option }));
}

describe('CompletePaymentDialog (concluir e pagar)', () => {
  it('mostra paciente, procedimentos e valor; só confirma depois de escolher a forma de pagamento', async () => {
    const { onConfirm } = setup();
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByText('Limpeza + Peeling')).toBeInTheDocument();
    expect(screen.getByText('Receita ao confirmar')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*350,00/)).toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();

    await pick(0, 'Pix');
    // Pix não tem campos de maquininha
    expect(screen.queryByText('Bandeira')).not.toBeInTheDocument();
    await userEvent.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledWith({
      paymentMethodId: 'pix',
      referenceMonth: '',
      installments: undefined,
      cardBrand: undefined,
      authorizationCode: undefined,
    });
  });

  it('lista só formas ativas e mostra a taxa', async () => {
    setup();
    await userEvent.click(screen.getAllByRole('combobox')[0]);
    const options = within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Pix', 'Crédito (3.5%)']);
  });

  it('crédito pede bandeira, parcelas e NSU e envia no payload', async () => {
    const { onConfirm } = setup();
    await pick(0, /Crédito/);

    expect(screen.getByText('Parcelas')).toBeInTheDocument();
    await pick(1, 'Visa');
    await userEvent.type(screen.getByPlaceholderText('1 = à vista'), '3');
    await userEvent.type(screen.getByPlaceholderText(/comprovante da maquininha/), ' 987654 ');
    await userEvent.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledWith({
      paymentMethodId: 'credit',
      referenceMonth: '',
      installments: 3,
      cardBrand: 'Visa',
      authorizationCode: '987654',
    });
  });

  it('parcela única (1) não é enviada como parcelamento', async () => {
    const { onConfirm } = setup();
    await pick(0, /Crédito/);
    await userEvent.type(screen.getByPlaceholderText('1 = à vista'), '1');
    await userEvent.click(confirmButton());
    expect(onConfirm.mock.calls[0][0].installments).toBeUndefined();
  });

  it('agendamento de mês passado oferece o mês de competência até o atual', async () => {
    const { onConfirm } = setup({ appointmentMonthKey: dayjs().subtract(2, 'month').format('YYYY-MM') });
    expect(screen.getByText('Mês de referência')).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('combobox')[1]);
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options[2]).toHaveTextContent('(atual)');
    await userEvent.click(options[0]);

    await pick(0, 'Pix');
    await userEvent.click(confirmButton());
    expect(onConfirm.mock.calls[0][0].referenceMonth).toBe(dayjs().subtract(2, 'month').format('YYYY-MM'));
  });

  it('agendamento do mês atual não pede competência; pacote e promoção mudam o resumo', () => {
    setup({
      isPackage: true,
      amount: 540,
      promotion: { originalPrice: 600, discount: 60, finalPrice: 540, promotion: { name: 'Black' } } as never,
    });
    expect(screen.queryByText('Mês de referência')).not.toBeInTheDocument();
    expect(screen.getByText('Receita do pacote ao confirmar')).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s*540,00/).length).toBeGreaterThan(0);
  });

  it('enquanto salva o botão fica desabilitado; cancelar fecha', async () => {
    const { onCancel } = setup({ isPending: true });
    expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
