import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { equipmentApi } from '../api/equipment';
import { inventoryApi } from '../api/inventory';
import { proceduresApi } from '../api/procedures';
import { recurringExpensesApi } from '../api/recurring-expenses';
import { ProcedureCostSummary } from '../components/procedures/ProcedureCostSummary';
import type { Equipment, InventoryItem, Procedure } from '../types';
import { Procedures } from './Procedures';

vi.mock('../api/procedures', () => ({
  proceduresApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));
vi.mock('../api/inventory', () => ({ inventoryApi: { list: vi.fn() } }));
vi.mock('../api/equipment', () => ({ equipmentApi: { list: vi.fn() } }));
vi.mock('../api/recurring-expenses', () => ({ recurringExpensesApi: { getHourlyCostSummary: vi.fn() } }));
vi.mock('../api/catalogs', () => ({ catalogsApi: { list: vi.fn().mockRejectedValue(new Error('offline')) } }));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), showToast: vi.fn() }));
const dialogs = vi.hoisted(() => ({ confirm: vi.fn(), alert: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: 'u', name: 'Ana', permissions: [] as string[] } }));
vi.mock('../contexts/AppToastContext', () => ({ useAppToast: () => toast }));
vi.mock('../contexts/AppDialogContext', () => ({ useAppDialog: () => dialogs }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const toxina: Procedure = {
  id: 'p1',
  name: 'Toxina Botulínica',
  description: 'Aplicação facial',
  category: 'Injetáveis',
  durationMinutes: 45,
  price: 1200,
  active: true,
  recurrenceDays: 120,
  appointmentsCount: 14,
  baseCost: 400,
  maxFeePercent: 3.5,
  maxFeeCost: 42,
  fixedCostShare: 90,
  hourlyCost: 120,
  totalCost: 532,
  profitMargin: 55.67,
  applicationMap: true,
  materials: [{ id: 'm1', procedureId: 'p1', itemId: 'i1', quantity: 2 }],
  equipments: [{ id: 'q1', equipmentId: 'e1', costPerUse: 20 }],
};
const peeling: Procedure = {
  id: 'p2',
  name: 'Peeling',
  category: 'Facial',
  durationMinutes: 30,
  price: '300',
  active: false,
  totalCost: 280,
  profitMargin: 6.7,
};
const simples: Procedure = { id: 'p3', name: 'Consulta', durationMinutes: 20, price: 150, active: true };

const inventory: InventoryItem[] = [
  { id: 'i1', name: 'Toxina 100U', unit: 'un', quantity: 8, minQuantity: 2, costPrice: 50 },
  { id: 'i2', name: 'Gaze', unit: 'pct', quantity: 100, minQuantity: 5, costPrice: '2.5' },
  { id: 'i3', name: 'Luva', quantity: 10, minQuantity: 5 },
];
const equipment: Equipment[] = [{ id: 'e1', name: 'Laser CO2', active: true }, { id: 'e2', name: 'Ultrassom', active: true }];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Procedures />
      </BrowserRouter>
    </QueryClientProvider>,
  );
  return { invalidate };
}

const ALL = ['procedures:create', 'procedures:edit', 'procedures:delete'];

beforeEach(() => {
  window.history.replaceState({}, '', '/procedimentos');
  vi.clearAllMocks();
  auth.user.permissions = ALL;
  mocked(proceduresApi.list).mockResolvedValue([toxina, peeling, simples]);
  mocked(proceduresApi.create).mockResolvedValue(toxina);
  mocked(proceduresApi.update).mockResolvedValue(toxina);
  mocked(proceduresApi.remove).mockResolvedValue(undefined);
  mocked(inventoryApi.list).mockResolvedValue(inventory);
  mocked(equipmentApi.list).mockResolvedValue(equipment);
  mocked(recurringExpensesApi.getHourlyCostSummary).mockResolvedValue({ hourlyCost: 120 });
  dialogs.confirm.mockResolvedValue(true);
});

describe('ProcedureCostSummary', () => {
  it('mostra custos, margem positiva e esconde equipamento zerado', () => {
    const { rerender } = render(
      <ProcedureCostSummary materialCost={100} equipmentCost={0} fixedCostShare={60} durationMinutes={30} totalCost={160} marginValue={140} marginPct={46.7} />,
    );
    expect(screen.getByText('Despesa fixa (30 min)')).toBeInTheDocument();
    expect(screen.queryByText('Custo de equipamento')).not.toBeInTheDocument();
    expect(screen.getByText(/R\$\s?140,00 · 47%/)).toBeInTheDocument();
    rerender(
      <ProcedureCostSummary materialCost={100} equipmentCost={20} fixedCostShare={60} durationMinutes={30} totalCost={180} marginValue={-30} marginPct={-20} />,
    );
    expect(screen.getByText('Custo de equipamento')).toBeInTheDocument();
    expect(screen.getByText(/-R\$\s?30,00 · -20%/)).toBeInTheDocument();
  });
});

describe('Procedures page', () => {
  it('lista procedimentos com custos, margem e status', async () => {
    renderPage();
    await screen.findByText('Toxina Botulínica');
    expect(screen.getByText('TB')).toBeInTheDocument();
    expect(screen.getByText('Retorno: 120 dias')).toBeInTheDocument();
    expect(screen.getByText('14×')).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?400,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?42,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?90,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?532,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?1\.200,00/)).toBeInTheDocument();
    expect(screen.getByText('56%')).toBeInTheDocument();
    expect(screen.getByText('7%')).toBeInTheDocument();
    expect(screen.getByText(/Sem retorno · Inativo/)).toBeInTheDocument();
    expect(screen.getByText('Consulta')).toBeInTheDocument();
    expect(screen.getByText('1–3 de 3')).toBeInTheDocument();
    expect(screen.getByText('Todos os procedimentos')).toBeInTheDocument();
    // procedimento sem custos calculados
    expect(screen.getAllByText('—').length).toBeGreaterThan(5);
    expect(screen.getByText('CO')).toBeInTheDocument();
  });

  it('mostra esqueletos, vazio e "nenhum encontrado"', async () => {
    mocked(proceduresApi.list).mockReturnValueOnce(new Promise(() => {}));
    const first = render(
      <QueryClientProvider client={new QueryClient()}>
        <BrowserRouter>
          <Procedures />
        </BrowserRouter>
      </QueryClientProvider>,
    );
    expect(document.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
    first.unmount();

    mocked(proceduresApi.list).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('Nenhum procedimento cadastrado.')).toBeInTheDocument();
  });

  it('filtra por busca e categoria e mantém na URL', async () => {
    renderPage();
    await screen.findByText('Toxina Botulínica');
    await userEvent.type(screen.getByLabelText('Buscar procedimento'), 'aplicação');
    await waitFor(() => expect(screen.queryByText('Consulta')).not.toBeInTheDocument());
    expect(screen.getByText('Toxina Botulínica')).toBeInTheDocument();
    expect(screen.getByText('1–1 de 1')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Buscar procedimento'));
    await userEvent.type(screen.getByLabelText('Buscar procedimento'), 'xyz');
    expect(await screen.findByText('Nenhum procedimento encontrado.')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Buscar procedimento'));

    await userEvent.click(screen.getByRole('combobox', { name: 'Categoria' }));
    await userEvent.click(within(screen.getByRole('listbox')).getByText('Facial'));
    await waitFor(() => expect(screen.queryByText('Toxina Botulínica')).not.toBeInTheDocument());
    expect(screen.getByText('Peeling')).toBeInTheDocument();
    expect(window.location.search).toContain('categoria=Facial');
  });

  it('pagina de 8 em 8', async () => {
    const many = Array.from({ length: 10 }, (_, i): Procedure => ({
      id: `x${i}`, name: `Procedimento ${String(i + 1).padStart(2, '0')}`, durationMinutes: 30, price: 100, active: true,
    }));
    mocked(proceduresApi.list).mockResolvedValue(many);
    renderPage();
    await screen.findByText('Procedimento 01');
    expect(screen.getByText('1–8 de 10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Próxima página' }));
    expect(await screen.findByText('Procedimento 09')).toBeInTheDocument();
    expect(screen.getByText('9–10 de 10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Página anterior' }));
    expect(await screen.findByText('Procedimento 01')).toBeInTheDocument();
  });

  it('exclui após confirmação e trata falha', async () => {
    const { invalidate } = renderPage();
    await screen.findByText('Toxina Botulínica');
    await userEvent.click(screen.getByRole('button', { name: 'Excluir Consulta' }));
    expect(dialogs.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Excluir procedimento', message: 'Excluir procedimento Consulta?' }));
    await waitFor(() => expect(proceduresApi.remove).toHaveBeenCalledWith('p3'));
    expect(toast.success).toHaveBeenCalledWith('Procedimento excluído.');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['procedures'] });

    mocked(proceduresApi.remove).mockRejectedValue({ response: { data: { message: 'Há agendamentos' } } });
    await userEvent.click(screen.getByRole('button', { name: 'Excluir Peeling' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Há agendamentos'));

    dialogs.confirm.mockResolvedValue(false);
    mocked(proceduresApi.remove).mockClear();
    await userEvent.click(screen.getByRole('button', { name: 'Excluir Peeling' }));
    await waitFor(() => expect(dialogs.confirm).toHaveBeenCalledTimes(3));
    expect(proceduresApi.remove).not.toHaveBeenCalled();
  });

  it('sem permissões esconde criar, editar e excluir', async () => {
    auth.user.permissions = [];
    renderPage();
    await screen.findByText('Toxina Botulínica');
    expect(screen.queryByRole('button', { name: 'Novo procedimento' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Editar / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Excluir / })).not.toBeInTheDocument();
  });

  it('cria um procedimento calculando custo total e margem', async () => {
    const { invalidate } = renderPage();
    await screen.findByText('Toxina Botulínica');
    await userEvent.click(screen.getByRole('button', { name: 'Novo procedimento' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText('Novo procedimento', { selector: 'h2,h6,p,span,div' })).toBeInTheDocument();
    expect(within(dlg).getByText('Nenhum material vinculado.')).toBeInTheDocument();

    await userEvent.click(within(dlg).getByRole('button', { name: 'Salvar procedimento' }));
    expect(await within(dlg).findByText('Nome é obrigatório')).toBeInTheDocument();
    expect(proceduresApi.create).not.toHaveBeenCalled();

    await userEvent.type(within(dlg).getByPlaceholderText('Ex.: Toxina Botulínica'), 'Peeling Químico');
    await userEvent.type(within(dlg).getByPlaceholderText(/Facial, Injetáveis/), 'Facial');
    const duration = within(dlg).getByDisplayValue('60');
    await userEvent.clear(duration);
    await userEvent.type(duration, '30');
    await userEvent.type(within(dlg).getByPlaceholderText('Opcional'), '15');
    await userEvent.type(within(dlg).getByPlaceholderText(/Detalhes do procedimento/), 'Renovação');
    await userEvent.type(within(dlg).getAllByPlaceholderText('0,00')[0], '30000');

    // material: Toxina 100U (R$ 50) x 2
    await userEvent.click(within(dlg).getByRole('button', { name: 'Material' }));
    await userEvent.click(within(dlg).getByPlaceholderText('Selecionar'));
    await userEvent.click(within(await screen.findByRole('listbox')).getByText('Toxina 100U (un)'));
    const qty = within(dlg).getByDisplayValue('1');
    await userEvent.clear(qty);
    await userEvent.type(qty, '2');
    expect(within(dlg).getAllByText(/R\$\s?100,00/).length).toBeGreaterThan(0);

    // equipamento com custo por uso de R$ 20
    await userEvent.click(within(dlg).getByRole('button', { name: 'Equip.' }));
    await userEvent.click(within(dlg).getAllByPlaceholderText('Selecionar')[1]);
    await userEvent.click(within(await screen.findByRole('listbox')).getByText('Laser CO2'));
    const costs = within(dlg).getAllByPlaceholderText('0,00');
    await userEvent.type(costs[0], '2000'); // o campo de equipamento vem antes do valor de venda

    // 100 material + 20 equipamento + 60 (120/h x 30min) = 180; margem 120 (40%)
    expect(await within(dlg).findByText('Custo de equipamento')).toBeInTheDocument();
    expect(within(dlg).getByText('Despesa fixa (30 min)')).toBeInTheDocument();
    await waitFor(() => expect(within(dlg).getByText(/R\$\s?180,00/)).toBeInTheDocument());
    expect(within(dlg).getByText(/R\$\s?120,00 · 40%/)).toBeInTheDocument();

    // o ativo e o mapa de aplicação são alternáveis
    const [active, map] = within(dlg).getAllByRole('checkbox');
    expect(active).toBeChecked();
    await userEvent.click(map);
    await userEvent.click(active);
    expect(within(dlg).getByText('Oculto até reativar')).toBeInTheDocument();

    await userEvent.click(within(dlg).getByRole('button', { name: 'Salvar procedimento' }));
    await waitFor(() =>
      expect(proceduresApi.create).toHaveBeenCalledWith({
        name: 'Peeling Químico',
        category: 'Facial',
        description: 'Renovação',
        durationMinutes: 30,
        price: 300,
        active: false,
        applicationMap: true,
        recurrenceDays: 15,
        materials: [{ itemId: 'i1', quantity: 2 }],
        equipments: [{ equipmentId: 'e1', costPerUse: 20 }],
      }),
    );
    expect(toast.success).toHaveBeenCalledWith('Procedimento criado.');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['procedures'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['inventory'] });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('avisa quando o material excede o estoque e permite remover linhas', async () => {
    renderPage();
    await screen.findByText('Toxina Botulínica');
    await userEvent.click(screen.getByRole('button', { name: 'Novo procedimento' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Material' }));
    await userEvent.click(within(dlg).getByPlaceholderText('Selecionar'));
    await userEvent.click(within(await screen.findByRole('listbox')).getByText('Toxina 100U (un)'));
    const qty = within(dlg).getByDisplayValue('1');
    await userEvent.clear(qty);
    await userEvent.type(qty, '9');
    expect(await within(dlg).findByText('Algum material está acima do estoque atual.')).toBeInTheDocument();

    // um material já escolhido não aparece de novo em outra linha
    await userEvent.click(within(dlg).getByRole('button', { name: 'Material' }));
    await userEvent.click(within(dlg).getAllByPlaceholderText('Selecionar')[1]);
    const options = within(await screen.findByRole('listbox')).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Gaze (pct)', 'Luva']);
    await userEvent.keyboard('{Escape}');

    await userEvent.click(within(dlg).getAllByRole('button', { name: 'Remover material' })[0]);
    await waitFor(() => expect(within(dlg).queryByText('Algum material está acima do estoque atual.')).not.toBeInTheDocument());
    await userEvent.click(within(dlg).getByRole('button', { name: 'Remover material' }));
    expect(within(dlg).getByText('Nenhum material vinculado.')).toBeInTheDocument();

    await userEvent.click(within(dlg).getByRole('button', { name: 'Equip.' }));
    await userEvent.click(within(dlg).getByRole('button', { name: 'Remover equipamento' }));
    expect(within(dlg).queryByRole('button', { name: 'Remover equipamento' })).not.toBeInTheDocument();
  });

  it('edita um procedimento existente com materiais e equipamentos', async () => {
    renderPage();
    await screen.findByText('Toxina Botulínica');
    await userEvent.click(screen.getByRole('button', { name: 'Editar Toxina Botulínica' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText('Editar procedimento')).toBeInTheDocument();
    expect(within(dlg).getByDisplayValue('Toxina Botulínica')).toBeInTheDocument();
    expect(within(dlg).getByDisplayValue('Injetáveis')).toBeInTheDocument();
    expect(within(dlg).getByDisplayValue('120')).toBeInTheDocument();
    expect(within(dlg).getByDisplayValue('1.200,00')).toBeInTheDocument();
    expect(await within(dlg).findByDisplayValue('Toxina 100U (un)')).toBeInTheDocument();
    expect(within(dlg).getByDisplayValue('Laser CO2')).toBeInTheDocument();
    // 2 x 50 + 20 + 120 x 45/60 = 210; margem 990 (83%)
    await waitFor(() => expect(within(dlg).getByText(/R\$\s?210,00/)).toBeInTheDocument());
    expect(within(dlg).getByText(/R\$\s?990,00 · 83%/)).toBeInTheDocument();

    const name = within(dlg).getByDisplayValue('Toxina Botulínica');
    await userEvent.clear(name);
    await userEvent.type(name, 'Toxina Premium');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() =>
      expect(proceduresApi.update).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({
          name: 'Toxina Premium',
          price: 1200,
          durationMinutes: 45,
          recurrenceDays: 120,
          applicationMap: true,
          materials: [{ itemId: 'i1', quantity: 2 }],
          equipments: [{ equipmentId: 'e1', costPerUse: 20 }],
        }),
      ),
    );
    expect(toast.success).toHaveBeenCalledWith('Procedimento atualizado.');
  });

  it('mostra o erro da API ao salvar e envia retorno nulo quando vazio', async () => {
    mocked(proceduresApi.update).mockRejectedValue({ response: { data: { message: 'Nome duplicado' } } });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Consulta' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Salvar alterações' }));
    expect(await within(dlg).findByText('Nome duplicado')).toBeInTheDocument();
    expect(proceduresApi.update).toHaveBeenCalledWith('p3', expect.objectContaining({ recurrenceDays: null, materials: [], equipments: [] }));
    expect(toast.error).toHaveBeenCalledWith('Nome duplicado');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('valida a duração mínima', async () => {
    renderPage();
    await screen.findByText('Toxina Botulínica');
    await userEvent.click(screen.getByRole('button', { name: 'Novo procedimento' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByPlaceholderText('Ex.: Toxina Botulínica'), 'Rápido');
    const duration = within(dlg).getByDisplayValue('60');
    await userEvent.clear(duration);
    await userEvent.type(duration, '2');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Salvar procedimento' }));
    expect(await within(dlg).findByText('Mínimo de 5 minutos')).toBeInTheDocument();
    expect(proceduresApi.create).not.toHaveBeenCalled();
  });
});
