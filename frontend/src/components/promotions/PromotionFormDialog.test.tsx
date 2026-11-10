import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { packagesApi } from '../../api/packages';
import { proceduresApi } from '../../api/procedures';
import { promotionsApi } from '../../api/promotions';
import type { Promotion } from '../../types';
import { PromotionFormDialog } from './PromotionFormDialog';

vi.mock('../../api/promotions', () => ({ promotionsApi: { create: vi.fn(), update: vi.fn() } }));
vi.mock('../../api/procedures', () => ({ proceduresApi: { list: vi.fn() } }));
vi.mock('../../api/packages', () => ({ packagesApi: { list: vi.fn() } }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), showToast: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const procedures = [
  { id: 'p1', name: 'Peeling', active: true, price: 200 },
  { id: 'p2', name: 'Botox', active: true, price: 900 },
  { id: 'p3', name: 'Antigo', active: false, price: 10 },
];
const packages = [
  { id: 'k1', name: 'Pacote Face', active: true },
  { id: 'k2', name: 'Pacote Corpo', active: true },
];

function renderDialog(props: Partial<React.ComponentProps<typeof PromotionFormDialog>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <PromotionFormDialog open onClose={onClose} {...props} />
    </QueryClientProvider>,
  );
  return { onClose, invalidate };
}

const dates = () => Array.from(document.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
const setDates = (start: string, end: string) => {
  fireEvent.change(dates()[0], { target: { value: start } });
  fireEvent.change(dates()[1], { target: { value: end } });
};
const submit = (label = 'Salvar promoção') => userEvent.click(screen.getByRole('button', { name: label }));
const nameInput = () => screen.getByPlaceholderText('Ex.: Inverno na Pele');

async function pickFromCombo(combo: HTMLElement, option: string) {
  await userEvent.click(combo);
  await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: option }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked(proceduresApi.list).mockResolvedValue(procedures);
  mocked(packagesApi.list).mockResolvedValue(packages);
});

describe('PromotionFormDialog', () => {
  it('valida nome, valor e datas', async () => {
    renderDialog();
    await submit();
    expect(await screen.findByText('Nome é obrigatório')).toBeInTheDocument();
    expect(screen.getByText('Informe o valor do desconto')).toBeInTheDocument();
    expect(screen.getByText('Início é obrigatório')).toBeInTheDocument();
    expect(screen.getByText('Fim é obrigatório')).toBeInTheDocument();
    expect(promotionsApi.create).not.toHaveBeenCalled();
  });

  it('percentual limitado a 100% e fim não pode ser antes do início', async () => {
    renderDialog();
    await userEvent.type(nameInput(), 'Inverno');
    await userEvent.type(screen.getByPlaceholderText('20'), '150');
    setDates('2026-06-10', '2026-06-01');
    await submit();
    expect(await screen.findByText('Máximo 100%')).toBeInTheDocument();
    expect(screen.getByText('Deve ser igual ou posterior ao início')).toBeInTheDocument();
    expect(promotionsApi.create).not.toHaveBeenCalled();
  });

  it('cria promoção percentual para todos os procedimentos', async () => {
    mocked(promotionsApi.create).mockResolvedValue({});
    const { onClose, invalidate } = renderDialog();
    await userEvent.type(nameInput(), 'Inverno na Pele');
    await userEvent.type(screen.getByPlaceholderText('Ex.: 20% OFF em tratamentos faciais'), '20% OFF');
    await userEvent.type(screen.getByPlaceholderText('20'), '20');
    setDates('2026-06-01', '2026-06-30');
    const combos = screen.getAllByRole('combobox');
    await pickFromCombo(combos[combos.length - 1], 'Inverno');
    await submit();

    await waitFor(() =>
      expect(promotionsApi.create).toHaveBeenCalledWith({
        name: 'Inverno na Pele',
        description: '20% OFF',
        commemorativeDate: 'Inverno',
        startAt: '2026-06-01T12:00:00.000Z',
        endAt: '2026-06-30T12:00:00.000Z',
        discountType: 'PERCENTAGE',
        discountValue: 20,
        active: true,
        procedureIds: [],
        packageIds: [],
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith('Promoção criada.');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['promotions'] });
  });

  it('desconto em valor fixo para procedimentos específicos (só os ativos aparecem), inativando a campanha', async () => {
    mocked(promotionsApi.create).mockResolvedValue({});
    renderDialog();
    await userEvent.type(nameInput(), 'Vale 50');
    await userEvent.click(screen.getByRole('button', { name: 'Valor' }));
    await userEvent.type(screen.getAllByPlaceholderText('0,00')[0], '5000');
    expect(screen.getByPlaceholderText('0,00')).toHaveValue('50,00');
    setDates('2026-06-01', '2026-06-01');

    await pickFromCombo(screen.getAllByRole('combobox')[0], 'Procedimentos específicos');
    await userEvent.click(screen.getByText('Selecione os procedimentos'));
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).queryByRole('option', { name: 'Antigo' })).not.toBeInTheDocument();
    await userEvent.click(within(listbox).getByRole('option', { name: 'Botox' }));
    await userEvent.click(within(listbox).getByRole('option', { name: 'Peeling' }));
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getAllByRole('button', { name: 'Inativa' })[0]);
    await submit();

    await waitFor(() => expect(promotionsApi.create).toHaveBeenCalledTimes(1));
    expect(promotionsApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        discountType: 'FIXED',
        discountValue: 50,
        active: false,
        procedureIds: ['p2', 'p1'],
        packageIds: [],
      }),
    );
  });

  it('combo: exige preço, passa a aplicar a pacotes e bloqueia "Todos os procedimentos"', async () => {
    mocked(promotionsApi.create).mockResolvedValue({});
    renderDialog();
    await userEvent.type(nameInput(), 'Combo Noiva');
    await userEvent.click(screen.getByRole('button', { name: 'Combo' }));
    expect(screen.getByText('Preço do combo')).toBeInTheDocument();
    expect(screen.getByText(/o valor acima é o preço final de cada procedimento ou pacote/)).toBeInTheDocument();
    setDates('2026-05-01', '2026-05-31');

    await submit();
    expect(await screen.findByText('Informe o preço do combo')).toBeInTheDocument();
    expect(promotionsApi.create).not.toHaveBeenCalled();

    await userEvent.type(screen.getByPlaceholderText('0,00'), '30000');
    const combo = screen.getAllByRole('combobox')[0];
    expect(combo).toHaveTextContent('Pacotes específicos');
    await userEvent.click(combo);
    expect(within(await screen.findByRole('listbox')).getByRole('option', { name: 'Todos os procedimentos' })).toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{Escape}');

    await userEvent.click(screen.getByText('Selecione os pacotes'));
    await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'Pacote Face' }));
    await userEvent.keyboard('{Escape}');
    await submit();
    await waitFor(() => expect(promotionsApi.create).toHaveBeenCalledTimes(1));
    expect(promotionsApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ discountType: 'COMBO', discountValue: 300, packageIds: ['k1'], procedureIds: [] }),
    );
  });

  it('entrar ou sair de combo limpa o valor digitado', async () => {
    renderDialog();
    await userEvent.type(screen.getByPlaceholderText('20'), '15');
    await userEvent.click(screen.getByRole('button', { name: 'Combo' }));
    expect(screen.getByPlaceholderText('0,00')).toHaveValue('');
    await userEvent.type(screen.getByPlaceholderText('0,00'), '10000');
    await userEvent.click(screen.getByRole('button', { name: 'Percentual' }));
    expect(screen.getByPlaceholderText('20')).toHaveValue(null);
  });

  it('edita promoção existente e preserva data comemorativa fora da lista', async () => {
    const editing: Promotion = {
      id: 'pr1',
      name: 'Combo Verão',
      description: 'Descrição',
      commemorativeDate: 'Aniversário da clínica',
      startAt: '2026-01-10T12:00:00.000Z',
      endAt: '2026-02-10T12:00:00.000Z',
      discountType: 'COMBO',
      discountValue: '450',
      active: false,
      procedures: [{ procedureId: 'p1', procedure: { id: 'p1', name: 'Peeling', price: 200 } }],
    };
    mocked(promotionsApi.update).mockResolvedValue({});
    const { onClose } = renderDialog({ editing });
    expect(screen.getByText('Editar promoção')).toBeInTheDocument();
    expect(nameInput()).toHaveValue('Combo Verão');
    expect(dates()[0]).toHaveValue('2026-01-10');
    expect(screen.getByPlaceholderText('0,00')).toHaveValue('450,00');
    expect(screen.getAllByRole('combobox')[0]).toHaveTextContent('Procedimentos específicos');
    expect(await screen.findByText('Peeling')).toBeInTheDocument();
    const combos = screen.getAllByRole('combobox');
    expect(combos[combos.length - 1]).toHaveTextContent('Aniversário da clínica');

    await userEvent.clear(nameInput());
    await userEvent.type(nameInput(), 'Combo Verão 2');
    await submit('Salvar');
    await waitFor(() =>
      expect(promotionsApi.update).toHaveBeenCalledWith('pr1', {
        name: 'Combo Verão 2',
        description: 'Descrição',
        commemorativeDate: 'Aniversário da clínica',
        startAt: '2026-01-10T12:00:00.000Z',
        endAt: '2026-02-10T12:00:00.000Z',
        discountType: 'COMBO',
        discountValue: 450,
        active: false,
        procedureIds: ['p1'],
        packageIds: [],
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith('Promoção atualizada.');
  });

  it('edição com pacotes abre em "Pacotes específicos"; data inicial vinda da URL pré-seleciona a comemorativa', async () => {
    const editing = {
      id: 'pr2', name: 'P', startAt: '2026-01-10', endAt: '2026-01-11', discountType: 'PERCENTAGE', discountValue: 0, active: true,
      packages: [{ packageId: 'k2', package: { id: 'k2', name: 'Pacote Corpo', totalPrice: 1 } }],
    } as Promotion;
    renderDialog({ editing });
    expect(screen.getAllByRole('combobox')[0]).toHaveTextContent('Pacotes específicos');
    expect(await screen.findByText('Pacote Corpo')).toBeInTheDocument();
  });

  it('data comemorativa inicial é preenchida ao criar', () => {
    renderDialog({ initialCommemorativeDate: 'Natal' });
    const combos = screen.getAllByRole('combobox');
    expect(combos[combos.length - 1]).toHaveTextContent('Natal');
  });

  it('erro da API aparece no alerta e em toast, sem fechar', async () => {
    mocked(promotionsApi.create).mockRejectedValue({ response: { data: { message: 'Combo precisa de itens' } } });
    const { onClose } = renderDialog();
    await userEvent.type(nameInput(), 'X');
    await userEvent.type(screen.getByPlaceholderText('20'), '10');
    setDates('2026-01-01', '2026-01-02');
    await submit();
    expect((await screen.findAllByText('Combo precisa de itens')).length).toBeGreaterThan(0);
    expect(toast.error).toHaveBeenCalledWith('Combo precisa de itens');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('erro ao atualizar usa mensagem padrão', async () => {
    mocked(promotionsApi.update).mockRejectedValue({});
    renderDialog({
      editing: { id: 'pr3', name: 'A', startAt: '2026-01-01', endAt: '2026-01-02', discountType: 'PERCENTAGE', discountValue: 10, active: true },
    });
    await submit('Salvar');
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não foi possível atualizar a promoção.'));
    expect(await screen.findByText('Erro ao salvar promoção')).toBeInTheDocument();
  });

  it('cancelar fecha o diálogo', async () => {
    const { onClose } = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
  });
});
