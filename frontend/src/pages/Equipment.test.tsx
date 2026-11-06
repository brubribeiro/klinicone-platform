import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { equipmentApi } from '../api/equipment';
import {
  dateTone,
  daysUntil,
  dueLabel,
  maintenanceCyclePct,
  nextMaintenanceOf,
  toneColor,
} from '../components/equipment/equipmentMaintenance';
import type { Equipment } from '../types';
import { EquipmentPage } from './Equipment';

vi.mock('../api/equipment', () => ({
  equipmentApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), registerMaintenance: vi.fn() },
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), showToast: vi.fn() }));
const dialogs = vi.hoisted(() => ({ confirm: vi.fn(), alert: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: 'u', name: 'Ana', permissions: [] as string[] } }));
vi.mock('../contexts/AppToastContext', () => ({ useAppToast: () => toast }));
vi.mock('../contexts/AppDialogContext', () => ({ useAppDialog: () => dialogs }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));

vi.setConfig({ testTimeout: 30_000 });

const mocked = <T,>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

// Hoje é 15/03/2026 10:00.
const laser: Equipment = {
  id: 'e1',
  name: 'Laser CO2',
  brand: 'Lumenis',
  model: 'UltraPulse',
  serialNumber: 'EQ-0042',
  purchaseDate: '2025-03-15T12:00:00.000Z',
  purchaseValue: 85000,
  maintenanceValue: 1200.5,
  maintenanceIntervalMonths: 6,
  maintenanceNotifyDaysBefore: 7,
  lastMaintenanceAt: '2025-09-10T12:00:00.000Z',
  nextMaintenanceAt: '2026-03-10T12:00:00.000Z',
  scheduledMaintenanceAt: '2026-03-10T12:00:00.000Z',
  notes: 'Contrato com a assistência',
  active: true,
};
const cryo: Equipment = {
  id: 'e2',
  name: 'Criolipólise',
  brand: 'Beauty',
  lastMaintenanceAt: '2026-01-01T12:00:00.000Z',
  nextMaintenanceAt: '2026-04-01T12:00:00.000Z',
  active: true,
};
const ultra: Equipment = {
  id: 'e3',
  name: 'Ultrassom',
  nextMaintenanceAt: '2027-03-15T12:00:00.000Z',
  lastMaintenanceAt: '2026-03-01T12:00:00.000Z',
  active: false,
};
const plain: Equipment = { id: 'e4', name: 'Maca', active: true };
const base = [laser, cryo, ultra, plain];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <EquipmentPage />
      </BrowserRouter>
    </QueryClientProvider>,
  );
  return { invalidate };
}

const card = (name: string) => screen.getByText(name, { selector: 'p' }).closest('.MuiCard-root') as HTMLElement;
const stat = (label: string) => screen.getAllByText(label).map((e) => e.parentElement as HTMLElement).find((p) => p.children.length === 2)!;
// Os botões de ícone dos cartões ficam sem nome acessível (ver RowActionButton); achamos pelo ícone.
const iconBtn = (c: HTMLElement, icon: 'Build' | 'Edit' | 'Delete') => within(c).getByTestId(`${icon}Icon`).closest('button') as HTMLElement;
const hasIcon = (c: HTMLElement, icon: string) => within(c).queryByTestId(`${icon}Icon`) !== null;
const ALL = ['equipment:create', 'equipment:edit', 'equipment:delete'];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 2, 15, 10, 0, 0));
  window.history.replaceState({}, '', '/equipamentos');
  vi.clearAllMocks();
  auth.user.permissions = ALL;
  mocked(equipmentApi.list).mockResolvedValue(base);
  mocked(equipmentApi.create).mockResolvedValue(laser);
  mocked(equipmentApi.update).mockResolvedValue(laser);
  mocked(equipmentApi.remove).mockResolvedValue(undefined);
  mocked(equipmentApi.registerMaintenance).mockResolvedValue(laser);
  dialogs.confirm.mockResolvedValue(true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('equipmentMaintenance', () => {
  it('calcula dias, rótulos e tons', () => {
    expect(daysUntil(null)).toBeNull();
    expect(daysUntil('2026-03-20')).toBe(4);
    expect(nextMaintenanceOf(laser)).toBe(laser.scheduledMaintenanceAt);
    expect(nextMaintenanceOf(cryo)).toBe(cryo.nextMaintenanceAt);
    expect(dueLabel(null)).toBe('Sem previsão');
    expect(dueLabel(-1)).toBe('Atrasada há 1 dia');
    expect(dueLabel(-3)).toBe('Atrasada há 3 dias');
    expect(dueLabel(0)).toBe('Hoje');
    expect(dueLabel(1)).toBe('Em 1 dia');
    expect(dueLabel(9)).toBe('Em 9 dias');
    expect(dateTone(null, 'success')).toBe('default');
    expect(dateTone(-1, 'success')).toBe('error');
    expect(dateTone(30, 'success')).toBe('warning');
    expect(dateTone(31, 'success')).toBe('success');
    expect(toneColor('default')).toBe('text.primary');
    expect(toneColor('error')).toBe('error.main');
  });

  it('calcula o percentual do ciclo de manutenção', () => {
    expect(maintenanceCyclePct(plain)).toBeNull();
    expect(maintenanceCyclePct(laser)).toBe(100); // atrasada
    // 01/01 -> 01/04 = 90 dias; 73 dias passados (10:00 de 15/03)
    expect(maintenanceCyclePct(cryo)).toBe(Math.round((73 / 90) * 100));
    // sem última manutenção: usa a periodicidade
    expect(maintenanceCyclePct({ ...cryo, lastMaintenanceAt: undefined, maintenanceIntervalMonths: 3 })).toBeGreaterThan(0);
    // sem última e sem periodicidade: usa a compra
    expect(maintenanceCyclePct({ ...cryo, lastMaintenanceAt: undefined, purchaseDate: '2026-01-01T12:00:00.000Z' })).toBe(81);
    expect(maintenanceCyclePct({ ...cryo, lastMaintenanceAt: undefined })).toBeNull();
    // início depois do vencimento
    expect(maintenanceCyclePct({ ...cryo, lastMaintenanceAt: '2026-05-01T12:00:00.000Z' })).toBe(100);
  });
});

describe('EquipmentPage', () => {
  it('mostra os totais e os cartões com ciclo de manutenção e valores em reais', async () => {
    renderPage();
    await screen.findByText('Laser CO2');
    expect(within(stat('Equipamentos')).getByText('4')).toBeInTheDocument();
    expect(within(stat('Operacionais')).getByText('3')).toBeInTheDocument();
    expect(within(stat('Manut. atrasada')).getByText('1')).toBeInTheDocument();
    expect(within(stat('Manut. próx. 30d')).getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Mostrando 1–4 de 4')).toBeInTheDocument();

    const l = within(card('Laser CO2'));
    expect(l.getByText('Lumenis · UltraPulse')).toBeInTheDocument();
    expect(l.getByText('Manut. atrasada')).toBeInTheDocument();
    expect(l.getByText('Atrasada há 5 dias')).toBeInTheDocument();
    expect(l.getAllByText('10/03/2026')).toHaveLength(2);
    expect(l.getByText(/R\$\s?85\.000,00/)).toBeInTheDocument();
    expect(l.getByText(/R\$\s?1\.200,50/)).toBeInTheDocument();
    expect(l.getByText('Aviso 7d antes')).toBeInTheDocument();

    const c = within(card('Criolipólise'));
    expect(c.getByText('Operacional')).toBeInTheDocument();
    expect(c.getByText('Em 16 dias')).toBeInTheDocument();
    expect(c.getByText('Sem aviso')).toBeInTheDocument();
    expect(c.getAllByText('—').length).toBeGreaterThanOrEqual(3);

    expect(within(card('Ultrassom')).getByText('Inativo')).toBeInTheDocument();
    expect(within(card('Maca')).getByText('Sem previsão')).toBeInTheDocument();
  });

  it('mostra esqueletos enquanto carrega', () => {
    mocked(equipmentApi.list).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(document.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
  });

  it('mostra o vazio quando nada foi cadastrado', async () => {
    mocked(equipmentApi.list).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('Nenhum equipamento cadastrado')).toBeInTheDocument();
  });

  it('filtra por busca, status e manutenção', async () => {
    renderPage();
    await screen.findByText('Laser CO2');
    await userEvent.type(screen.getByPlaceholderText('Buscar equipamento...'), 'lumenis');
    await waitFor(() => expect(screen.queryByText('Maca')).not.toBeInTheDocument());
    expect(screen.getByText('Laser CO2')).toBeInTheDocument();
    expect(screen.getByText('Mostrando 1–1 de 1 (4 no total)')).toBeInTheDocument();
    await userEvent.clear(screen.getByPlaceholderText('Buscar equipamento...'));
    await userEvent.type(screen.getByPlaceholderText('Buscar equipamento...'), 'zzz');
    expect(await screen.findByText('Nenhum equipamento encontrado')).toBeInTheDocument();
    await userEvent.clear(screen.getByPlaceholderText('Buscar equipamento...'));

    await userEvent.click(screen.getByRole('combobox', { name: 'Status' }));
    await userEvent.click(within(screen.getByRole('listbox')).getByText('Inativos'));
    await waitFor(() => expect(screen.queryByText('Laser CO2')).not.toBeInTheDocument());
    expect(screen.getByText('Ultrassom')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('combobox', { name: 'Status' }));
    await userEvent.click(within(screen.getByRole('listbox')).getByText('Todos os status'));
    await userEvent.click(screen.getByRole('combobox', { name: 'Manutenção' }));
    await userEvent.click(within(screen.getByRole('listbox')).getByText('Próxima ou atrasada'));
    await waitFor(() => expect(screen.queryByText('Maca')).not.toBeInTheDocument());
    expect(screen.getByText('Laser CO2')).toBeInTheDocument();
    expect(screen.getByText('Criolipólise')).toBeInTheDocument();
    expect(screen.queryByText('Ultrassom')).not.toBeInTheDocument();
    expect(window.location.search).toContain('manutencao=DUE');
  });

  it('pagina de 12 em 12', async () => {
    const many = Array.from({ length: 14 }, (_, i): Equipment => ({ id: `m${i}`, name: `Máquina ${String(i + 1).padStart(2, '0')}`, active: true }));
    mocked(equipmentApi.list).mockResolvedValue(many);
    renderPage();
    await screen.findByText('Máquina 01');
    expect(screen.getByText('Mostrando 1–12 de 14')).toBeInTheDocument();
    expect(screen.queryByText('Máquina 13')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    expect(await screen.findByText('Máquina 13')).toBeInTheDocument();
    expect(screen.getByText('Mostrando 13–14 de 14')).toBeInTheDocument();
  });

  it('registra manutenção após confirmar', async () => {
    const { invalidate } = renderPage();
    await screen.findByText('Laser CO2');
    await userEvent.click(iconBtn(card('Laser CO2'), 'Build'));
    expect(dialogs.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Registrar manutenção', message: 'Registrar manutenção de Laser CO2 agora?' }),
    );
    await waitFor(() => expect(equipmentApi.registerMaintenance).toHaveBeenCalledWith('e1'));
    expect(toast.success).toHaveBeenCalledWith('Manutenção registrada.');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['equipment'] });
    // o clique não abre a edição do cartão
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('não registra se a confirmação for recusada e mostra erro da API', async () => {
    dialogs.confirm.mockResolvedValueOnce(false);
    renderPage();
    await screen.findByText('Laser CO2');
    await userEvent.click(iconBtn(card('Laser CO2'), 'Build'));
    await waitFor(() => expect(dialogs.confirm).toHaveBeenCalled());
    expect(equipmentApi.registerMaintenance).not.toHaveBeenCalled();

    mocked(equipmentApi.registerMaintenance).mockRejectedValue({ response: { data: { message: 'Sem periodicidade' } } });
    await userEvent.click(iconBtn(card('Laser CO2'), 'Build'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Sem periodicidade'));
  });

  it('exclui após confirmar, e reporta falha', async () => {
    const { invalidate } = renderPage();
    await screen.findByText('Laser CO2');
    await userEvent.click(iconBtn(card('Laser CO2'), 'Delete'));
    expect(dialogs.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Excluir equipamento', message: 'Excluir Laser CO2?' }));
    await waitFor(() => expect(equipmentApi.remove).toHaveBeenCalledWith('e1'));
    expect(toast.success).toHaveBeenCalledWith('Equipamento excluído.');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['equipment'] });

    mocked(equipmentApi.remove).mockRejectedValue({ response: { data: {} } });
    await userEvent.click(iconBtn(card('Maca'), 'Delete'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não foi possível excluir o equipamento.'));
  });

  it('não exclui se a confirmação for recusada', async () => {
    dialogs.confirm.mockResolvedValue(false);
    renderPage();
    await screen.findByText('Laser CO2');
    await userEvent.click(iconBtn(card('Laser CO2'), 'Delete'));
    await waitFor(() => expect(dialogs.confirm).toHaveBeenCalled());
    expect(equipmentApi.remove).not.toHaveBeenCalled();
  });

  it('esconde ações sem permissão', async () => {
    auth.user.permissions = [];
    renderPage();
    await screen.findByText('Laser CO2');
    expect(screen.queryByRole('button', { name: 'Adicionar equipamento' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('DeleteIcon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('EditIcon')).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('Laser CO2'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('só editar: mostra editar e manutenção, sem excluir', async () => {
    auth.user.permissions = ['equipment:edit'];
    renderPage();
    await screen.findByText('Laser CO2');
    expect(iconBtn(card('Laser CO2'), 'Edit')).toBeInTheDocument();
    expect(within(card('Laser CO2')).queryByLabelText('Excluir')).not.toBeInTheDocument();
  });

  it('cria um equipamento enviando só os campos preenchidos', async () => {
    const { invalidate } = renderPage();
    await screen.findByText('Laser CO2');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar equipamento' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText('Novo equipamento')).toBeInTheDocument();

    await userEvent.click(within(dlg).getByRole('button', { name: 'Criar equipamento' }));
    expect(await within(dlg).findByText('Nome é obrigatório')).toBeInTheDocument();
    expect(equipmentApi.create).not.toHaveBeenCalled();

    await userEvent.type(within(dlg).getByPlaceholderText('Ex.: Laser CO2 Fracionado'), '  Radiofrequência ');
    await userEvent.type(within(dlg).getByPlaceholderText('Ex.: Lumenis'), 'Tonederm');
    const [machineValue, maintValue] = within(dlg).getAllByPlaceholderText('0,00');
    await userEvent.type(machineValue, '1500000');
    await userEvent.type(maintValue, '25000');
    const [purchase, last, scheduled] = Array.from(dlg.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
    await userEvent.type(purchase, '2026-01-10');
    await userEvent.type(last, '2026-02-01');
    await userEvent.type(scheduled, '2026-08-01');
    const [interval, notify] = Array.from(dlg.querySelectorAll('input[type="number"]')) as HTMLInputElement[];
    await userEvent.type(interval, '6');
    await userEvent.type(notify, '0');
    await userEvent.type(within(dlg).getByPlaceholderText(/Fornecedor de assistência/), 'Contrato anual');
    await userEvent.click(within(dlg).getAllByRole('combobox')[0]);
    await userEvent.click(within(screen.getByRole('listbox')).getByText('Inativo'));
    expect(within(dlg).getByText('Oculto nas listagens do dia a dia.')).toBeInTheDocument();

    await userEvent.click(within(dlg).getByRole('button', { name: 'Criar equipamento' }));
    await waitFor(() =>
      expect(equipmentApi.create).toHaveBeenCalledWith({
        name: 'Radiofrequência',
        brand: 'Tonederm',
        purchaseDate: '2026-01-10T12:00:00.000Z',
        purchaseValue: 15000,
        maintenanceValue: 250,
        maintenanceIntervalMonths: 6,
        maintenanceNotifyDaysBefore: 0,
        lastMaintenanceAt: '2026-02-01T12:00:00.000Z',
        scheduledMaintenanceAt: '2026-08-01T12:00:00.000Z',
        notes: 'Contrato anual',
        active: false,
      }),
    );
    expect(toast.success).toHaveBeenCalledWith('Equipamento criado.');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['equipment'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['finance'] });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('edita um equipamento carregando os dados atuais', async () => {
    renderPage();
    await screen.findByText('Laser CO2');
    await userEvent.click(iconBtn(card('Laser CO2'), 'Edit'));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText('Editar equipamento')).toBeInTheDocument();
    expect(within(dlg).getByText('Laser CO2 · EQ-0042')).toBeInTheDocument();
    expect(within(dlg).getByDisplayValue('Lumenis')).toBeInTheDocument();
    expect(within(dlg).getByDisplayValue('850,00'.replace('850', '85.000'))).toBeInTheDocument();
    expect(within(dlg).getByDisplayValue('2025-03-15')).toBeInTheDocument();
    expect(within(dlg).getByDisplayValue('Contrato com a assistência')).toBeInTheDocument();

    const name = within(dlg).getByDisplayValue('Laser CO2');
    await userEvent.clear(name);
    await userEvent.type(name, 'Laser CO2 Pro');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(equipmentApi.update).toHaveBeenCalledWith(
        'e1',
        expect.objectContaining({
          name: 'Laser CO2 Pro',
          brand: 'Lumenis',
          purchaseValue: 85000,
          maintenanceValue: 1200.5,
          maintenanceIntervalMonths: 6,
          scheduledMaintenanceAt: '2026-03-10T12:00:00.000Z',
          active: true,
        }),
      ),
    );
    expect(toast.success).toHaveBeenCalledWith('Equipamento atualizado.');
  });

  it('abre a edição ao clicar no cartão e mostra o erro da API no diálogo', async () => {
    mocked(equipmentApi.update).mockRejectedValue({ response: { data: { message: 'Série já cadastrada' } } });
    renderPage();
    await userEvent.click(await screen.findByText('Criolipólise'));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Salvar' }));
    expect(await within(dlg).findByText('Série já cadastrada')).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith('Série já cadastrada');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
