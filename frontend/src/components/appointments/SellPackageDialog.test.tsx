import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { SellPackageDialog } from './SellPackageDialog';
import type { Package, PaymentMethodEntry, Procedure } from '../../types';

const api = vi.hoisted(() => ({
  saleQuote: vi.fn(),
  createPatientPackage: vi.fn(),
}));
vi.mock('../../api/packages', () => ({ packagesApi: api }));

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));

const procedures = [
  { id: 'laser', name: 'Laser', price: '200.00' },
  { id: 'peel', name: 'Peeling', price: 150 },
] as Procedure[];

const methods: PaymentMethodEntry[] = [
  { id: 'pix', name: 'Pix', kind: 'PIX', feePercent: 0, active: true },
  { id: 'card', name: 'Cartão', kind: 'CREDIT', feePercent: 4, active: true },
  { id: 'off', name: 'Inativo', feePercent: 0, active: false },
];

function pkg(overrides: Partial<Package> = {}): Package {
  return {
    id: 'pkg1',
    name: 'Laser 3x',
    type: 'SESSIONS',
    sessionCount: 3,
    validityDays: 90,
    totalPrice: null,
    discountPercent: '10',
    items: [{ procedureId: 'laser', quantity: 3 }],
    ...overrides,
  } as Package;
}

function setup(selected: Package | null = pkg()) {
  const onCreated = vi.fn();
  const onClose = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <SellPackageDialog
        pkg={selected}
        patientId="pat1"
        patientName="Maria"
        procedures={procedures}
        paymentMethods={methods}
        onClose={onClose}
        onCreated={onCreated}
      />
    </QueryClientProvider>,
  );
  return { onCreated, onClose, invalidate, client };
}

const noPromotion = (price: number) => ({ originalPrice: price, discount: 0, finalPrice: price, promotion: null });
const valueInput = () => screen.getByLabelText('Valor acordado') as HTMLInputElement;

describe('SellPackageDialog (venda de pacote)', () => {
  beforeEach(() => {
    api.saleQuote.mockReset();
    api.createPatientPackage.mockReset();
    toast.error.mockReset();
  });

  it('sugere a soma dos procedimentos com o desconto do pacote e vende sem pagamento antecipado', async () => {
    api.saleQuote.mockResolvedValue(noPromotion(540));
    api.createPatientPackage.mockResolvedValue({ id: 'pp1' });
    const { onCreated, invalidate } = setup();

    expect(screen.getByText(/3 sessões · Validade: 90 dias/)).toBeInTheDocument();
    await waitFor(() => expect(valueInput().value).toBe('540'));

    await userEvent.click(screen.getByRole('button', { name: 'Vincular pacote' }));
    expect(api.createPatientPackage).toHaveBeenCalledWith({ patientId: 'pat1', packageId: 'pkg1', totalPaid: 540 });
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: 'pp1' }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['patient-packages-active'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['patient-packages'] });
  });

  it('preço fixo do pacote tem prioridade; valor combinado e pagamento antecipado vão no payload', async () => {
    let resolveQuote!: (q: ReturnType<typeof noPromotion>) => void;
    api.saleQuote.mockReturnValue(new Promise((r) => (resolveQuote = r)));
    api.createPatientPackage.mockResolvedValue({ id: 'pp2' });
    const { client } = setup(pkg({ totalPrice: '500', validityDays: null }));

    expect(screen.getByText(/Sem validade/)).toBeInTheDocument();
    expect(valueInput().value).toBe('500');
    // a cotação recalcula o valor: só digitar depois que ela chega e o efeito roda
    await act(async () => resolveQuote(noPromotion(500)));
    await waitFor(() => expect(client.getQueryData(['package-sale-quote', 'pkg1'])).toBeDefined());
    await act(() => new Promise((r) => setTimeout(r, 0)));
    fireEvent.change(valueInput(), { target: { value: '480' } });
    expect(valueInput().value).toBe('480');

    await userEvent.click(screen.getByLabelText('Método de pagamento'));
    const options = within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['—', 'Pix', 'Cartão (4%)']);
    await userEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Cartão (4%)' }));

    await userEvent.click(screen.getByRole('button', { name: 'Vincular pacote' }));
    expect(api.createPatientPackage).toHaveBeenCalledWith({
      patientId: 'pat1',
      packageId: 'pkg1',
      totalPaid: 480,
      paymentMethodId: 'card',
    });
  });

  it('com promoção vinculada ao pacote sugere o preço promocional e mostra o desconto', async () => {
    api.saleQuote.mockResolvedValue({
      originalPrice: 540,
      discount: 100,
      finalPrice: 440,
      promotion: { id: 'pr1', name: 'Black Friday', discountType: 'FIXED', discountValue: 100 },
    });
    setup();
    expect(await screen.findByText('Black Friday')).toBeInTheDocument();
    await waitFor(() => expect(valueInput().value).toBe('440'));
    expect(api.saleQuote).toHaveBeenCalledWith('pkg1');
  });

  it('erro da API vira aviso e não fecha', async () => {
    api.saleQuote.mockResolvedValue(noPromotion(540));
    api.createPatientPackage.mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: 'Informe um valor maior que zero para registrar pagamento antecipado.' } },
    });
    const { onCreated } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Vincular pacote' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error.mock.calls[0][0]).toMatch(/maior que zero|Erro ao vincular pacote/);
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('fechado quando não há pacote escolhido', () => {
    setup(null);
    expect(screen.queryByText('Adquirir pacote')).not.toBeInTheDocument();
    expect(api.saleQuote).not.toHaveBeenCalled();
  });
});
