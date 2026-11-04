import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { PatientFinanceTab } from './PatientFinanceTab';

const api = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('../../api/finance', () => ({ financeApi: api }));

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PatientFinanceTab patientId="p1" />
    </QueryClientProvider>,
  );
}

describe('PatientFinanceTab', () => {
  beforeEach(() => api.list.mockReset());

  it('mostra spinner enquanto carrega', async () => {
    let resolve!: (v: unknown[]) => void;
    api.list.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderTab();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    resolve([]);
    expect(await screen.findByText('Nenhum lançamento financeiro vinculado.')).toBeInTheDocument();
  });

  it('mostra estado vazio e zeros', async () => {
    api.list.mockResolvedValue([]);
    renderTab();
    expect(await screen.findByText('Nenhum lançamento financeiro vinculado.')).toBeInTheDocument();
    expect(screen.getByText('0 a receber')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledWith(undefined, undefined, false, undefined, 'p1');
  });

  it('resume recebido/pendente e lista lançamentos', async () => {
    api.list.mockResolvedValue([
      { id: '1', type: 'INCOME', description: 'Limpeza de pele', amount: '200', paidAt: '2026-03-10T12:00:00.000Z', paymentMethod: { name: 'Pix' } },
      { id: '2', type: 'INCOME', description: 'Peeling', amount: 150, dueDate: '2026-04-01T12:00:00.000Z' },
      { id: '3', type: 'EXPENSE', description: 'Estorno', amount: 30, paidAt: '2026-03-12T12:00:00.000Z' },
    ]);
    renderTab();
    expect(await screen.findByText('Limpeza de pele')).toBeInTheDocument();
    expect(screen.getByText('1 a receber')).toBeInTheDocument();
    expect(screen.getAllByText('Pago')).toHaveLength(2);
    expect(screen.getByText('Pendente')).toBeInTheDocument();
    expect(screen.getByText(/10\/03\/2026 · Pix/)).toBeInTheDocument();
    expect(screen.getByText(/vence 01\/04\/2026/)).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s*200,00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/R\$\s*150,00/).length).toBeGreaterThan(0);
    expect(screen.getByText(/−\s*R\$\s*30,00/)).toBeInTheDocument();
  });

  it('limita a 8 lançamentos recentes', async () => {
    api.list.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({ id: `e${i}`, type: 'INCOME', description: `Item ${i}`, amount: 10, paidAt: '2026-01-02T12:00:00.000Z' })),
    );
    renderTab();
    expect(await screen.findByText('Item 0')).toBeInTheDocument();
    expect(screen.queryByText('Item 9')).not.toBeInTheDocument();
    expect(screen.getByText(/Mostrando 8 de 10 lançamentos/)).toBeInTheDocument();
  });
});
