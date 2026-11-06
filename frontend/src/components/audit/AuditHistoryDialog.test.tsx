import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditLogEntry, AuditLogPaginated } from '../../api/auditLogs';
import { AuditHistoryDialog } from './AuditHistoryDialog';

vi.setConfig({ testTimeout: 30_000 });

const api = vi.hoisted(() => ({ findAll: vi.fn() }));
vi.mock('../../api/auditLogs', () => ({ auditLogsApi: api }));

const entry = (o: Partial<AuditLogEntry>): AuditLogEntry => ({
  id: 'l1',
  entity: 'Patient',
  entityId: 'p1',
  action: 'UPDATE',
  changes: { name: { old: 'Maria', new: 'Maria Souza' } },
  userId: 'u1',
  userName: 'Ana Paula',
  createdAt: '2026-03-10T15:00:00.000Z',
  ...o,
});
const page = (data: AuditLogEntry[], total = data.length): { data: AuditLogPaginated } => ({
  data: { data, total, page: 1, limit: 25, totalPages: 1 },
});

function renderIt(p: Partial<React.ComponentProps<typeof AuditHistoryDialog>> = {}) {
  const onClose = p.onClose ?? vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuditHistoryDialog open entity="Patient" title="Pacientes" onClose={onClose} {...p} />
    </QueryClientProvider>,
  );
  return { onClose };
}
const lastFilters = () => api.findAll.mock.calls[api.findAll.mock.calls.length - 1][0];

beforeEach(() => {
  vi.clearAllMocks();
  api.findAll.mockResolvedValue(page([entry({})]));
});

describe('AuditHistoryDialog', () => {
  it('não busca quando fechado', () => {
    renderIt({ open: false });
    expect(api.findAll).not.toHaveBeenCalled();
  });

  it('busca a entidade com página 1 e 25 por página e lista o diff', async () => {
    renderIt();
    await waitFor(() => expect(api.findAll).toHaveBeenCalled());
    expect(lastFilters()).toMatchObject({ entity: 'Patient', limit: 25, page: 1 });
    expect((await screen.findAllByText('Maria Souza')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Maria').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Edição').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ana Paula').length).toBeGreaterThan(0);
    expect(screen.getAllByText('AP').length).toBeGreaterThan(0);
    expect(screen.getByText('Pacientes')).toBeInTheDocument();
    expect(screen.getByText('1 registro')).toBeInTheDocument();
    expect(screen.getByText('Mostrando 1–1 de 1')).toBeInTheDocument();
  });

  it('usa subtítulo padrão sem título e "Sistema" sem usuário', async () => {
    api.findAll.mockResolvedValue(page([entry({ userName: null, action: 'DELETE', changes: { name: 'X' } as never })], 3));
    renderIt({ title: undefined });
    expect(screen.getByText('Registro de criações, edições e exclusões')).toBeInTheDocument();
    expect((await screen.findAllByText('Sistema')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Exclusão').length).toBeGreaterThan(0);
    expect(await screen.findByText('3 registros')).toBeInTheDocument();
  });

  it('estado vazio', async () => {
    api.findAll.mockResolvedValue(page([]));
    renderIt();
    expect(await screen.findByText('Nenhuma alteração registrada')).toBeInTheDocument();
    expect(screen.getByText('Nenhum registro')).toBeInTheDocument();
  });

  it('erro de carregamento', async () => {
    api.findAll.mockRejectedValue(new Error('500'));
    renderIt();
    expect(await screen.findByText('Erro ao carregar histórico')).toBeInTheDocument();
  });

  it('filtra por ação, voltando à primeira página', async () => {
    renderIt();
    await screen.findByText('Mostrando 1–1 de 1');
    await userEvent.click(screen.getByRole('combobox', { name: 'Ação' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Exclusão' }));
    await waitFor(() => expect(lastFilters()).toMatchObject({ entity: 'Patient', action: 'DELETE', page: 1 }));
    await userEvent.click(screen.getByRole('combobox', { name: 'Ação' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Todas as ações' }));
    // a consulta sem filtro já está em cache: basta o seletor voltar ao padrão
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Ação' })).toHaveTextContent('Todas as ações'));
  });

  it('filtra por período', async () => {
    renderIt();
    await screen.findByText('Mostrando 1–1 de 1');
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-03-01' } });
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-03-31' } });
    await waitFor(() => expect(lastFilters()).toMatchObject({ startDate: '2026-03-01', endDate: '2026-03-31' }));
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '' } });
    await waitFor(() => expect(screen.getByLabelText('De')).toHaveValue(''));
  });

  it('pagina para frente e para trás e respeita os limites', async () => {
    api.findAll.mockResolvedValue(page([entry({})], 60));
    renderIt();
    await screen.findByText('Mostrando 1–25 de 60');
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Próxima página' }));
    await screen.findByText('Mostrando 26–50 de 60');
    expect(lastFilters().page).toBe(2);
    await userEvent.click(screen.getByRole('button', { name: 'Próxima página' }));
    await screen.findByText('Mostrando 51–60 de 60');
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Página anterior' }));
    await screen.findByText('Mostrando 26–50 de 60');
  });

  it('trocar o tamanho da página volta à primeira e envia o novo limite', async () => {
    api.findAll.mockResolvedValue(page([entry({})], 60));
    renderIt();
    await screen.findByText('Mostrando 1–25 de 60');
    await userEvent.click(screen.getByRole('button', { name: 'Próxima página' }));
    await screen.findByText('Mostrando 26–50 de 60');
    await userEvent.click(screen.getByRole('combobox', { name: 'Registros por página' }));
    await userEvent.click(await screen.findByRole('option', { name: '10' }));
    await screen.findByText('Mostrando 1–10 de 60');
    expect(lastFilters()).toMatchObject({ limit: 10, page: 1 });
  });

  it('fechar chama onClose e zera os filtros', async () => {
    const { onClose } = renderIt();
    await screen.findByText('Mostrando 1–1 de 1');
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-03-01' } });
    await waitFor(() => expect(lastFilters().startDate).toBe('2026-03-01'));
    await userEvent.click(screen.getByRole('button', { name: /Fechar/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('De')).toHaveValue('');
  });
});
