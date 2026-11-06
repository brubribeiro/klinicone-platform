import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { packagesApi } from '../../api/packages';
import { proceduresApi } from '../../api/procedures';
import type { Package } from '../../types';
import { PackageFormDialog } from './PackageFormDialog';

vi.mock('../../api/packages', () => ({ packagesApi: { create: vi.fn(), update: vi.fn() } }));
vi.mock('../../api/procedures', () => ({ proceduresApi: { list: vi.fn() } }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), showToast: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const procedures = [
  { id: 'p1', name: 'Peeling', active: true, price: 200 },
  { id: 'p2', name: 'Botox', active: true, price: 900 },
  { id: 'p3', name: 'Antigo', active: false, price: 10 },
];

function renderDialog(props: Partial<React.ComponentProps<typeof PackageFormDialog>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <PackageFormDialog open onClose={onClose} {...props} />
    </QueryClientProvider>,
  );
  return { onClose, invalidate };
}

const submit = (label = 'Salvar pacote') => userEvent.click(screen.getByRole('button', { name: label }));
const nameInput = () => screen.getByPlaceholderText('Ex.: Harmonização Facial');
const fullPriceInput = () => screen.getAllByPlaceholderText('0,00')[0];

async function selectProcedures(...names: string[]) {
  await userEvent.click(screen.getByText('Selecione os procedimentos'));
  const listbox = await screen.findByRole('listbox');
  for (const n of names) await userEvent.click(within(listbox).getByRole('option', { name: n }));
  await userEvent.keyboard('{Escape}');
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked(proceduresApi.list).mockResolvedValue(procedures);
});

describe('PackageFormDialog', () => {
  it('exige nome e ao menos um procedimento', async () => {
    renderDialog();
    await submit();
    expect(await screen.findByText('Nome é obrigatório')).toBeInTheDocument();
    expect(screen.getByText('Selecione ao menos um procedimento')).toBeInTheDocument();
    expect(packagesApi.create).not.toHaveBeenCalled();
  });

  it('cria conjunto de procedimentos: valor cheio soma os preços e sessões = nº de procedimentos', async () => {
    mocked(packagesApi.create).mockResolvedValue({});
    const { onClose, invalidate } = renderDialog();
    await userEvent.type(nameInput(), 'Harmonização');
    await selectProcedures('Peeling', 'Botox');
    expect(screen.getByDisplayValue('2 sessões')).toBeDisabled();
    expect(fullPriceInput()).toHaveValue('1.100,00');

    await userEvent.type(screen.getAllByPlaceholderText('0,00')[1], '99000');
    await submit();

    await waitFor(() =>
      expect(packagesApi.create).toHaveBeenCalledWith({
        name: 'Harmonização',
        type: 'COMBO',
        totalPrice: 990,
        discountPercent: null,
        validityDays: null,
        highlight: null,
        active: true,
        items: [
          { procedureId: 'p1', quantity: 1, sortOrder: 0 },
          { procedureId: 'p2', quantity: 1, sortOrder: 1 },
        ],
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith('Pacote criado.');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['packages'] });
  });

  it('não oferece procedimentos inativos', async () => {
    renderDialog();
    await userEvent.click(screen.getByText('Selecione os procedimentos'));
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByRole('option', { name: 'Peeling' })).toBeInTheDocument();
    expect(within(listbox).queryByRole('option', { name: 'Antigo' })).not.toBeInTheDocument();
  });

  it('pacote de sessões: valor cheio = preço × sessões e envia quantity com o nº de sessões', async () => {
    mocked(packagesApi.create).mockResolvedValue({});
    renderDialog();
    await userEvent.type(nameInput(), 'Peeling 6x');
    await userEvent.click(screen.getByRole('button', { name: 'Sessões de um procedimento' }));
    await userEvent.click(screen.getAllByRole('combobox')[0]);
    await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'Peeling' }));

    const sessions = screen.getByRole('spinbutton');
    await userEvent.clear(sessions);
    await userEvent.type(sessions, '6');
    expect(fullPriceInput()).toHaveValue('1.200,00');

    await userEvent.type(screen.getAllByPlaceholderText('0,00')[1], '100000');
    // validade
    await userEvent.click(screen.getAllByRole('combobox')[1]);
    await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: '3 meses' }));
    // destaque
    await userEvent.click(screen.getAllByRole('combobox')[2]);
    await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'Mais vendido' }));
    await userEvent.click(screen.getByRole('button', { name: 'Inativo' }));
    await submit();

    await waitFor(() => expect(packagesApi.create).toHaveBeenCalledTimes(1));
    expect(packagesApi.create).toHaveBeenCalledWith({
      name: 'Peeling 6x',
      type: 'SESSIONS',
      totalPrice: 1000,
      discountPercent: null,
      validityDays: 90,
      highlight: 'BEST_SELLER',
      active: false,
      items: [{ procedureId: 'p1', quantity: 6, sortOrder: 0 }],
    });
  });

  it('trocar para sessões mantém só o primeiro procedimento escolhido', async () => {
    mocked(packagesApi.create).mockResolvedValue({});
    renderDialog();
    await userEvent.type(nameInput(), 'X');
    await selectProcedures('Peeling', 'Botox');
    await userEvent.click(screen.getByRole('button', { name: 'Sessões de um procedimento' }));
    expect(screen.getAllByRole('combobox')[0]).toHaveTextContent('Peeling');
    await submit();
    await waitFor(() => expect(packagesApi.create).toHaveBeenCalledTimes(1));
    expect(packagesApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ items: [{ procedureId: 'p1', quantity: 1, sortOrder: 0 }], totalPrice: null }),
    );
  });

  it('edita pacote de sessões: carrega valores e envia atualização', async () => {
    const pkg: Package = {
      id: 'k1',
      name: 'Peeling 4x',
      type: 'SESSIONS',
      sessionCount: 4,
      active: true,
      totalPrice: '700',
      validityDays: 45,
      highlight: 'RECURRING',
      items: [{ id: 'i1', packageId: 'k1', procedureId: 'p1', quantity: 4, sortOrder: 0 }],
    };
    mocked(packagesApi.update).mockResolvedValue({});
    const { onClose } = renderDialog({ pkg });
    expect(screen.getByText('Editar pacote')).toBeInTheDocument();
    expect(nameInput()).toHaveValue('Peeling 4x');
    expect(screen.getByRole('spinbutton')).toHaveValue(4);
    expect(await screen.findByText('45 dias')).toBeInTheDocument();
    expect(screen.getByText('Recorrente')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('0,00')[1]).toHaveValue('700,00');

    await userEvent.clear(nameInput());
    await userEvent.type(nameInput(), 'Peeling 4x v2');
    await submit('Salvar');
    await waitFor(() =>
      expect(packagesApi.update).toHaveBeenCalledWith('k1', {
        name: 'Peeling 4x v2',
        type: 'SESSIONS',
        totalPrice: 700,
        discountPercent: null,
        validityDays: 45,
        highlight: 'RECURRING',
        active: true,
        items: [{ procedureId: 'p1', quantity: 4, sortOrder: 0 }],
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith('Pacote atualizado.');
  });

  it('edita combo sem preço próprio usando o preço de venda calculado; mantém procedimento inativo já incluído', async () => {
    const pkg: Package = {
      id: 'k2',
      name: 'Combo',
      type: 'COMBO',
      sessionCount: 2,
      active: false,
      totalPrice: null,
      salePrice: 450,
      items: [
        { id: 'a', packageId: 'k2', procedureId: 'p3', quantity: 1, sortOrder: 0 },
        { id: 'b', packageId: 'k2', procedureId: 'p1', quantity: 1, sortOrder: 1 },
      ],
    };
    renderDialog({ pkg });
    expect(await screen.findByText('Antigo')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('0,00')[1]).toHaveValue('450,00');
    expect(fullPriceInput()).toHaveValue('210,00');
  });

  it('mostra erro da API no alerta e em toast e permanece aberto', async () => {
    mocked(packagesApi.create).mockRejectedValue({ response: { data: { message: 'Já existe um pacote com esse nome' } } });
    const { onClose } = renderDialog();
    await userEvent.type(nameInput(), 'Dup');
    await selectProcedures('Peeling');
    await submit();
    expect((await screen.findAllByText('Já existe um pacote com esse nome')).length).toBeGreaterThan(0);
    expect(toast.error).toHaveBeenCalledWith('Já existe um pacote com esse nome');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('erro sem mensagem usa texto padrão; cancelar fecha', async () => {
    mocked(packagesApi.create).mockRejectedValue({});
    const { onClose } = renderDialog();
    await userEvent.type(nameInput(), 'Dup');
    await selectProcedures('Peeling');
    await submit();
    expect(await screen.findByText('Erro ao salvar pacote')).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith('Não foi possível salvar o pacote.');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
  });
});
