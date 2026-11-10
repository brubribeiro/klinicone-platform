import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditHistoryPanel } from './AuditHistoryPanel';

vi.setConfig({ testTimeout: 30_000 });

const api = vi.hoisted(() => ({ byEntity: vi.fn() }));
vi.mock('../../api/auditLogs', () => ({ auditLogsApi: api }));
// O DataGrid não monta células no jsdom (sem layout): o grid falso executa as colunas reais.
vi.mock('../AppDataGrid', () => ({
  AppDataGrid: ({ rows, columns, localeText }: { rows: Record<string, unknown>[]; columns: { field: string; valueGetter?: (p: unknown) => unknown; renderCell?: (p: unknown) => React.ReactNode }[]; localeText: { noRowsLabel: string } }) =>
    rows.length === 0 ? (
      <p>{localeText.noRowsLabel}</p>
    ) : (
      <table>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row.id)}>
              {columns.map((c) => {
                const params = { row, value: c.valueGetter ? c.valueGetter({ row }) : row[c.field] };
                return <td key={c.field}>{c.renderCell ? c.renderCell(params) : (params.value as string)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    ),
}));

const renderIt = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuditHistoryPanel entity="Patient" entityId="p1" />
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AuditHistoryPanel', () => {
  it('não busca nada enquanto fechado', () => {
    renderIt();
    expect(api.byEntity).not.toHaveBeenCalled();
    expect(screen.getByText('Histórico de alterações').closest('[aria-expanded]')).toHaveAttribute('aria-expanded', 'false');
  });

  it('ao abrir busca pela entidade e lista as alterações', async () => {
    api.byEntity.mockResolvedValue({
      data: [
        { id: 'l1', entity: 'Patient', entityId: 'p1', action: 'UPDATE', userId: 'u', userName: 'Ana', createdAt: '2026-03-10T15:00:00.000Z', changes: { name: { old: 'Maria', new: 'Maria Souza' } } },
        { id: 'l2', entity: 'Patient', entityId: 'p1', action: 'CREATE', userId: 'u', userName: null, createdAt: '2026-03-09T15:00:00.000Z', changes: { phone: '1199' } },
      ],
    });
    renderIt();
    await userEvent.click(screen.getByText('Histórico de alterações'));
    expect(api.byEntity).toHaveBeenCalledWith('Patient', 'p1');
    expect(await screen.findByText('Maria Souza')).toBeInTheDocument();
    expect(screen.getByText('Maria')).toBeInTheDocument();
    expect(screen.getByText(/^10\/03\/2026/)).toBeInTheDocument();
    expect(screen.getByText('Edição')).toBeInTheDocument();
    expect(screen.getByText('Criação')).toBeInTheDocument();
    expect(screen.getByText('Sistema')).toBeInTheDocument();
    expect(screen.getByText('1199')).toBeInTheDocument();
  });

  it('mostra estado vazio', async () => {
    api.byEntity.mockResolvedValue({ data: [] });
    renderIt();
    await userEvent.click(screen.getByText('Histórico de alterações'));
    expect(await screen.findByText('Nenhuma alteração registrada')).toBeInTheDocument();
  });

  it('mostra erro quando a API falha', async () => {
    api.byEntity.mockRejectedValue(new Error('500'));
    renderIt();
    await userEvent.click(screen.getByText('Histórico de alterações'));
    expect(await screen.findByText('Erro ao carregar histórico')).toBeInTheDocument();
  });

  it('abre e fecha ao clicar de novo', async () => {
    api.byEntity.mockResolvedValue({ data: [] });
    renderIt();
    const header = screen.getByText('Histórico de alterações').closest('[aria-expanded]')!;
    await userEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
  });
});
