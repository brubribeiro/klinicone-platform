import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, useLocation } from 'react-router-dom';

import { Patients } from './Patients';

vi.setConfig({ testTimeout: 30_000 });

const api = vi.hoisted(() => ({ list: vi.fn(), stats: vi.fn(), remove: vi.fn() }));
vi.mock('../api/patients', () => ({ patientsApi: api }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('../contexts/AppToastContext', () => ({ useAppToast: () => toast }));
const dialog = vi.hoisted(() => ({ confirm: vi.fn() }));
vi.mock('../contexts/AppDialogContext', () => ({ useAppDialog: () => dialog }));
const perms = vi.hoisted(() => ({ set: new Set<string>() }));
vi.mock('../contexts/usePermissions', () => ({ usePermissions: () => ({ has: (p: string) => perms.set.has(p) }) }));

vi.mock('../components/patients/PatientFormDialog', () => ({
  PatientFormDialog: ({ open, patient }: { open: boolean; patient?: { name: string } | null }) =>
    open ? <div>Form aberto: {patient?.name ?? 'novo'}</div> : null,
}));
vi.mock('../components/patients/PatientDetailDrawer', () => ({
  PatientDetailDrawer: ({ patientId, onEditAnamnesis }: { patientId: string | null; onEditAnamnesis?: (id: string) => void }) =>
    patientId ? (
      <div>
        Ficha: {patientId}
        {onEditAnamnesis && <button onClick={() => onEditAnamnesis(patientId)}>drawer-anamnese</button>}
      </div>
    ) : null,
}));
vi.mock('../components/patients/AnamnesisFormDialog', () => ({
  AnamnesisFormDialog: ({ patientId }: { patientId: string | null }) => (patientId ? <div>Anamnese de {patientId}</div> : null),
}));
vi.mock('../components/messages/SendWhatsAppDialog', () => ({
  SendWhatsAppDialog: ({ title, open }: { title: string; open: boolean }) => (open ? <div>{title}</div> : null),
}));

const mk = (i: number, o: object = {}) => ({
  id: `p${i}`, name: `Paciente ${String(i).padStart(2, '0')}`, phone: '11988887777',
  totalSpent: i * 100, appointmentsCount: i, lastVisit: `2026-01-${String(i).padStart(2, '0')}T12:00:00`, ...o,
});
const patients = Array.from({ length: 10 }, (_, i) => mk(i + 1));

function Where() {
  const l = useLocation();
  return <div data-testid="where">{l.pathname + l.search}</div>;
}

function setup(url = '/pacientes') {
  // useUrlState lê window.location; por isso BrowserRouter (e não MemoryRouter)
  window.history.replaceState(null, '', url);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Patients />
        <Where />
      </BrowserRouter>
    </QueryClientProvider>,
  );
  return { invalidate };
}

const names = () => screen.getAllByRole('button', { name: /^Abrir ficha de / }).map((b) => b.getAttribute('aria-label')!.replace('Abrir ficha de ', ''));

describe('Patients page', () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset());
    api.list.mockResolvedValue(patients);
    api.stats.mockResolvedValue({ total: 10, active90: 37, newThisMonth: 2, averageTicket: 350 });
    toast.error.mockReset();
    toast.success.mockReset();
    dialog.confirm.mockReset();
    perms.set = new Set(['patients:create', 'patients:edit', 'patients:delete']);
  });
  afterEach(() => { vi.useRealTimers(); });

  it('mostra estatísticas e a primeira página da lista', async () => {
    setup();
    expect(await screen.findByText('Paciente 01')).toBeInTheDocument();
    expect(names()).toHaveLength(8);
    expect(screen.getByText('1–8 de 10')).toBeInTheDocument();
    expect(await screen.findByText('37')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*350/)).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledWith(undefined);
  });

  it('pagina a lista', async () => {
    setup();
    await screen.findByText('Paciente 01');
    await userEvent.click(screen.getByRole('button', { name: 'Próxima página' }));
    expect(await screen.findByText('Paciente 09')).toBeInTheDocument();
    expect(names()).toEqual(['Paciente 09', 'Paciente 10']);
    expect(screen.getByText('9–10 de 10')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('pagina=');
  });

  it('ordena por total gasto: desc, asc e remove a ordenação', async () => {
    setup();
    await screen.findByText('Paciente 01');
    const col = screen.getByRole('button', { name: 'Total gasto' });
    await userEvent.click(col);
    expect(names()[0]).toBe('Paciente 10');
    await userEvent.click(col);
    expect(names()[0]).toBe('Paciente 01');
    await userEvent.click(col);
    expect(names()[0]).toBe('Paciente 01');
    expect(screen.getByTestId('where')).not.toHaveTextContent('ordem=');
  });

  it('busca com debounce e mostra estado vazio da busca', async () => {
    setup();
    await screen.findByText('Paciente 01');
    api.list.mockResolvedValue([]);
    await userEvent.type(screen.getByPlaceholderText('Buscar paciente, CPF...'), 'zz');
    await waitFor(() => expect(api.list).toHaveBeenCalledWith('zz'));
    expect(await screen.findByText('Nenhum paciente encontrado')).toBeInTheDocument();
    expect(screen.queryByText(/de 0$/)).not.toBeInTheDocument();
  });

  it('abre cadastro, edição, ficha, anamnese e WhatsApp', async () => {
    setup();
    await screen.findByText('Paciente 01');
    await userEvent.click(screen.getByRole('button', { name: /Adicionar paciente/ }));
    expect(screen.getByText('Form aberto: novo')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Editar Paciente 02' }));
    expect(screen.getByText('Form aberto: Paciente 02')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Abrir ficha de Paciente 03' }));
    expect(screen.getByText(/Ficha: p3/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'drawer-anamnese' }));
    expect(screen.getByText('Anamnese de p3')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Anamnese de Paciente 04' }));
    expect(screen.getByText('Anamnese de p4')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Enviar WhatsApp para Paciente 05' }));
    expect(screen.getByText('Enviar mensagem para Paciente 05')).toBeInTheDocument();
  });

  it('reabre a ficha a partir de ?ficha= e limpa o parâmetro', async () => {
    setup('/pacientes?ficha=p7');
    expect(await screen.findByText(/Ficha: p7/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('where')).not.toHaveTextContent('ficha='));
  });

  it('exclui após confirmar e invalida as listas', async () => {
    api.remove.mockResolvedValue(undefined);
    dialog.confirm.mockResolvedValue(true);
    const { invalidate } = setup();
    await screen.findByText('Paciente 01');
    await userEvent.click(screen.getByRole('button', { name: 'Excluir Paciente 01' }));
    expect(dialog.confirm).toHaveBeenCalledWith(expect.objectContaining({ message: 'Excluir paciente Paciente 01?' }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Paciente excluído.'));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['patients-stats'] });
  });

  it('não exclui ao cancelar; mostra erro da API', async () => {
    api.remove.mockRejectedValue({ response: { data: { message: 'Possui atendimentos' } } });
    setup();
    await screen.findByText('Paciente 01');
    dialog.confirm.mockResolvedValueOnce(false);
    await userEvent.click(screen.getByRole('button', { name: 'Excluir Paciente 01' }));
    await waitFor(() => expect(dialog.confirm).toHaveBeenCalled());
    expect(api.remove).not.toHaveBeenCalled();
    dialog.confirm.mockResolvedValueOnce(true);
    await userEvent.click(screen.getByRole('button', { name: 'Excluir Paciente 01' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Possui atendimentos'));
  });

  it('sem permissões esconde criar/editar/excluir', async () => {
    perms.set = new Set();
    setup();
    await screen.findByText('Paciente 01');
    expect(screen.queryByRole('button', { name: /Adicionar paciente/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar Paciente 01' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excluir Paciente 01' })).not.toBeInTheDocument();
  });

  it('base vazia oferece cadastrar o primeiro paciente', async () => {
    api.list.mockResolvedValue([]);
    setup();
    const empty = await screen.findByText('Nenhum paciente cadastrado');
    expect(within(empty.parentElement!).getByRole('button', { name: /Adicionar paciente/ })).toBeInTheDocument();
  });
});
