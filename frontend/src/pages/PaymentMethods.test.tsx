import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { paymentMethodsApi } from '../api/paymentMethods';
import type { PaymentMethodEntry } from '../types';
import { PaymentMethods } from './PaymentMethods';

vi.mock('../api/paymentMethods', () => ({ paymentMethodsApi: { list: vi.fn(), remove: vi.fn() } }));
vi.mock('../components/payment-methods/PaymentMethodFormDialog', () => ({
  PaymentMethodFormDialog: ({ open, editing }: { open: boolean; editing?: PaymentMethodEntry | null }) =>
    open ? <div role="dialog" aria-label="form">{editing ? `Editar ${editing.name}` : 'Novo método'}</div> : null,
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), showToast: vi.fn() }));
const dialogs = vi.hoisted(() => ({ confirm: vi.fn(), alert: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: 'u', name: 'Ana', permissions: [] as string[] } }));
vi.mock('../contexts/AppToastContext', () => ({ useAppToast: () => toast }));
vi.mock('../contexts/AppDialogContext', () => ({ useAppDialog: () => dialogs }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;
const ALL = ['payment-methods:create', 'payment-methods:edit', 'payment-methods:delete'];

const methods: PaymentMethodEntry[] = [
  { id: 'm1', name: 'Pix', kind: 'PIX', settlementDays: 0, feePercent: 0, active: true, _count: { financialEntries: 0 } },
  { id: 'm2', name: 'Crédito', kind: 'CREDIT', settlementDays: 30, feePercent: '3.5', active: true, _count: { financialEntries: 1 } },
  { id: 'm3', name: 'Cheque', kind: 'OTHER', settlementDays: 1, feePercent: 0, active: false, _count: { financialEntries: 7 } },
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <PaymentMethods />
    </QueryClientProvider>,
  );
  return { invalidate };
}

const cardOf = (name: string) => screen.getByText(name).closest('.MuiCard-root') as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  auth.user.permissions = ALL;
  mocked(paymentMethodsApi.list).mockResolvedValue(methods);
});

describe('PaymentMethods', () => {
  it('mostra tipo, prazo, uso, taxa e líquido de cada método', async () => {
    renderPage();
    await screen.findByText('Pix');
    expect(screen.getByText(/· 2 de 3 ativas/)).toBeInTheDocument();

    const credit = within(cardOf('Crédito'));
    expect(credit.getByText(/Crédito · 30 dias para receber · Usada em 1 lançamento$/)).toBeInTheDocument();
    expect(credit.getByText('3,5%')).toBeInTheDocument();
    expect(credit.getByText(/R\$\s*96,50/)).toBeInTheDocument();

    const pix = within(cardOf('Pix'));
    expect(pix.getByText(/PIX · Ainda sem lançamentos/)).toBeInTheDocument();
    expect(pix.getByText('0%')).toBeInTheDocument();
    expect(pix.getByText(/líquido a cada/)).toBeInTheDocument();

    const cheque = within(cardOf('Cheque'));
    expect(cheque.getByText('Inativa')).toBeInTheDocument();
    expect(cheque.getByText(/Outro · 1 dia útil para receber · Usada em 7 lançamentos/)).toBeInTheDocument();
  });

  it('filtra por status e busca', async () => {
    renderPage();
    await screen.findByText('Pix');
    await userEvent.click(screen.getByRole('combobox', { name: 'Status' }));
    await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'Inativas' }));
    expect(screen.getByText('Cheque')).toBeInTheDocument();
    expect(screen.queryByText('Pix')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('combobox', { name: 'Status' }));
    await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'Todos os status' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Buscar método' }), 'créd');
    expect(screen.getByText('Crédito')).toBeInTheDocument();
    expect(screen.queryByText('Pix')).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: 'Buscar método' }), 'zzz');
    expect(screen.getByText('Nenhuma forma de pagamento encontrada')).toBeInTheDocument();
  });

  it('estado vazio', async () => {
    mocked(paymentMethodsApi.list).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('Nenhuma forma de pagamento cadastrada')).toBeInTheDocument();
  });

  it('abre o formulário ao criar, ao clicar no cartão e no botão de editar', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Adicionar método' }));
    expect(screen.getByRole('dialog', { name: 'form' })).toHaveTextContent('Novo método');
    await userEvent.click(screen.getByRole('button', { name: 'Editar Pix' }));
    expect(screen.getByRole('dialog', { name: 'form' })).toHaveTextContent('Editar Pix');
    await userEvent.click(cardOf('Crédito'));
    expect(screen.getByRole('dialog', { name: 'form' })).toHaveTextContent('Editar Crédito');
  });

  it('exclui após confirmar sem abrir o formulário; cancelar não exclui; erro da API vira toast', async () => {
    renderPage();
    await screen.findByText('Pix');
    mocked(dialogs.confirm).mockResolvedValueOnce(false);
    await userEvent.click(screen.getByRole('button', { name: 'Excluir Pix' }));
    await waitFor(() => expect(dialogs.confirm).toHaveBeenCalledTimes(1));
    expect(paymentMethodsApi.remove).not.toHaveBeenCalled();

    mocked(dialogs.confirm).mockResolvedValueOnce(true);
    mocked(paymentMethodsApi.remove).mockResolvedValueOnce(undefined);
    await userEvent.click(screen.getByRole('button', { name: 'Excluir Pix' }));
    expect(dialogs.confirm).toHaveBeenLastCalledWith(expect.objectContaining({ message: 'Excluir a forma de pagamento "Pix"?' }));
    await waitFor(() => expect(paymentMethodsApi.remove).toHaveBeenCalledWith('m1'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Forma de pagamento excluída.'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    mocked(dialogs.confirm).mockResolvedValueOnce(true);
    mocked(paymentMethodsApi.remove).mockRejectedValueOnce({ response: { data: { message: 'Há lançamentos vinculados' } } });
    await userEvent.click(screen.getByRole('button', { name: 'Excluir Cheque' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Há lançamentos vinculados'));
  });

  it('somente leitura: sem botões nem cartão clicável', async () => {
    auth.user.permissions = [];
    renderPage();
    await screen.findByText('Pix');
    expect(screen.queryByRole('button', { name: 'Adicionar método' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar|Excluir/ })).not.toBeInTheDocument();
    await userEvent.click(cardOf('Pix'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('com um único método usa o singular', async () => {
    mocked(paymentMethodsApi.list).mockResolvedValue([methods[0]]);
    renderPage();
    expect(await screen.findByText(/· 1 de 1 ativa$/)).toBeInTheDocument();
  });
});
