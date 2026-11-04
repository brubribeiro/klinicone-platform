import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';

import { PatientDocumentsTab } from './PatientDocumentsTab';

const api = vi.hoisted(() => ({ list: vi.fn(), getAccessUrl: vi.fn() }));
vi.mock('../../api/documents', () => ({ documentsApi: api }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));
vi.mock('../../contexts/usePermissions', () => ({ usePermissions: () => ({ has: () => false }) }));
vi.mock('../documents/DocumentViewerDialog', () => ({
  DocumentViewerDialog: ({ doc }: { doc: { name: string } | null }) => (doc ? <div>Viewer {doc.name}</div> : null),
}));
vi.mock('../documents/SendDocumentDialog', () => ({ SendDocumentDialog: () => null }));

function Where() {
  const l = useLocation();
  return <div data-testid="where">{l.pathname + l.search}</div>;
}

function renderTab(onLeave = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PatientDocumentsTab patientId="p1" patientName="Maria Silva" onLeave={onLeave} />
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onLeave };
}

const doc = (o: object) => ({
  id: 'd1', name: 'Termo.pdf', category: 'CONSENT', status: 'PENDING', mimeType: 'application/pdf',
  createdAt: '2026-02-03T15:00:00.000Z', ...o,
});

describe('PatientDocumentsTab', () => {
  beforeEach(() => {
    api.list.mockReset();
    api.getAccessUrl.mockReset();
    toast.error.mockReset();
  });

  it('estado vazio e navegação para Documentos', async () => {
    api.list.mockResolvedValue([]);
    const { onLeave } = renderTab();
    expect(await screen.findByText('Nenhum documento vinculado.')).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledWith({ patientId: 'p1' });
    await userEvent.click(screen.getByRole('button', { name: /Ver em Documentos/ }));
    expect(onLeave).toHaveBeenCalled();
    expect(screen.getByTestId('where')).toHaveTextContent('/documentos?busca=Maria%20Silva');
  });

  it('lista documentos e abre URL assinada', async () => {
    api.list.mockResolvedValue([doc({ storageKey: 'k' }), doc({ id: 'd2', name: 'Sem arquivo.pdf', status: 'SIGNED' })]);
    api.getAccessUrl.mockResolvedValue('https://files/x');
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderTab();
    expect(await screen.findByText('Termo.pdf')).toBeInTheDocument();
    expect(screen.getByText('Sem arquivo.pdf')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir Termo.pdf' }));
    await waitFor(() => expect(open).toHaveBeenCalledWith('https://files/x', '_blank', 'noopener,noreferrer'));
    expect(screen.queryByRole('button', { name: 'Abrir Sem arquivo.pdf' })).not.toBeInTheDocument();
    open.mockRestore();
  });

  it('avisa quando falha ao gerar link', async () => {
    api.list.mockResolvedValue([doc({ storageKey: 'k' })]);
    api.getAccessUrl.mockRejectedValue(new Error('x'));
    renderTab();
    await screen.findByText('Termo.pdf');
    await userEvent.click(screen.getByRole('button', { name: 'Abrir Termo.pdf' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it('abre o visualizador para documento com conteúdo', async () => {
    api.list.mockResolvedValue([doc({ mimeType: 'text/html', hasContent: true })]);
    renderTab();
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir Termo.pdf' }));
    expect(await screen.findByText('Viewer Termo.pdf')).toBeInTheDocument();
  });
});
