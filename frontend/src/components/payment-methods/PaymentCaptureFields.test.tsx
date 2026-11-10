import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  emptyPaymentCapture,
  PaymentCaptureFields,
  paymentCaptureToPayload,
  type PaymentCaptureValues,
} from './PaymentCaptureFields';

vi.setConfig({ testTimeout: 30_000 });

function Harness({ kind, allowInstallments }: { kind: 'CREDIT' | 'DEBIT' | 'PIX' | null; allowInstallments?: boolean }) {
  const [values, setValues] = useState<PaymentCaptureValues>(emptyPaymentCapture);
  return (
    <>
      <PaymentCaptureFields
        kind={kind}
        values={values}
        allowInstallments={allowInstallments}
        onChange={(p) => setValues((v) => ({ ...v, ...p }))}
      />
      <output data-testid="payload">{JSON.stringify(paymentCaptureToPayload(values))}</output>
    </>
  );
}

describe('PaymentCaptureFields', () => {
  it('não renderiza nada para métodos que não são cartão', () => {
    const { container } = render(<Harness kind="PIX" />);
    expect(container.querySelector('input')).toBeNull();
  });

  it('crédito mostra bandeira, parcelas e NSU e monta o payload', async () => {
    render(<Harness kind="CREDIT" />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'Visa' }));
    await userEvent.type(screen.getByPlaceholderText('1 = à vista'), '3');
    await userEvent.type(screen.getByPlaceholderText(/comprovante da maquininha/), '  NSU9 ');
    expect(JSON.parse(screen.getByTestId('payload').textContent!)).toEqual({
      installments: 3,
      cardBrand: 'Visa',
      authorizationCode: 'NSU9',
    });
  });

  it('débito não pede parcelas, e allowInstallments=false também as oculta', () => {
    const { unmount } = render(<Harness kind="DEBIT" />);
    expect(screen.queryByPlaceholderText('1 = à vista')).not.toBeInTheDocument();
    unmount();
    render(<Harness kind="CREDIT" allowInstallments={false} />);
    expect(screen.queryByPlaceholderText('1 = à vista')).not.toBeInTheDocument();
  });
});

describe('paymentCaptureToPayload', () => {
  it('ignora parcela 1 e campos vazios', () => {
    expect(paymentCaptureToPayload({ installments: '1', cardBrand: ' ', authorizationCode: '' })).toEqual({
      installments: undefined,
      cardBrand: undefined,
      authorizationCode: undefined,
    });
  });
});
