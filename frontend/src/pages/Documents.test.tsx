import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentFile } from '../types';
import { Documents } from './Documents';

vi.setConfig({ testTimeout: 30_000 });

const docsApi = vi.hoisted(() => ({ list: vi.fn(), update: vi.fn(), remove: vi.fn(), getAccessUrl: vi.fn(), attachFile: vi.fn() }));
vi.mock('../api/documents', () => ({ documentsApi: docsApi }));
const tplApi = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('../api/documentTemplates', () => ({ documentTemplatesApi: tplApi }));
vi.mock('../api/catalogs', () => ({ catalogsApi: { list: vi.fn().mockRejectedValue(new Error('offline')) } }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
const dialogs = vi.hoisted(() => ({ confirm: vi.fn(), alert: vi.fn() }));
vi.mock('../contexts/AppToastContext', () => ({ useAppToast: () => toast }));
vi.mock('../contexts/AppDialogContext', () => ({ useAppDialog: () => dialogs }));
const perms = vi.hoisted(() => ({ granted: new Set<string>() }));
vi.mock('../contexts/usePermissions', () => ({ usePermissions: () => ({ has: (p: string) => perms.granted.has(p) }) }));

// Os diálogos têm testes próprios; aqui só importa se abrem com o documento certo.
vi.mock('../components/documents/DocumentFormDialog', async (orig) => ({
  ...(await orig<object>()),
  DocumentFormDialog: ({ open, editing, onSaved }: { open: boolean; editing?: DocumentFile | null; onSaved: (d: DocumentFile, c: boolean) => void }) =>
    open ? (
      <div role="dialog" aria-label="form">
        {editing ? `Editando ${editing.name}` : 'Novo vazio'}
        <button onClick={() => onSaved({ id: 'gen', name: 'Gerado do modelo', status: 'PENDING', hasContent: true, templateId: 't1', createdAt: '2026-03-12T12:00:00.000Z' }, true)}>
          salvar-gerado
        </button>
      </div>
    ) : null,
}));
vi.mock('../components/documents/DocumentViewerDialog', () => ({
  DocumentViewerDialog: ({ doc }: { doc: DocumentFile | null }) => (doc ? <div role="dialog" aria-label="viewer">Vendo {doc.name}</div> : null),
}));
vi.mock('../components/documents/SendDocumentDialog', () => ({
  SendDocumentDialog: ({ doc }: { doc: DocumentFile | null }) => (doc ? <div role="dialog" aria-label="send">Enviando {doc.name}</div> : null),
}));
vi.mock('../components/documents/DocumentTemplatesDialog', () => ({
  DocumentTemplatesDialog: ({ open }: { open: boolean }) => (open ? <div role="dialog" aria-label="templates">Modelos</div> : null),
}));

const mk = (o: Partial<DocumentFile>): DocumentFile => ({
  id: 'x', name: 'x', status: 'PENDING', createdAt: '2026-03-10T15:00:00.000Z', ...o,
});

const docs: DocumentFile[] = [
  mk({ id: 'd1', name: 'Termo Maria', category: 'consentimento', status: 'SIGNED', storageKey: 'k1', size: 2048, mimeType: 'application/pdf', patientId: 'p1', patient: { id: 'p1', name: 'Maria Silva' } }),
  mk({ id: 'd2', name: 'Receita Ana', category: 'receita', status: 'PENDING', hasContent: true, patientId: 'p2', patient: { id: 'p2', name: 'Ana Souza' } }),
  mk({ id: 'd3', name: 'Manual laser', category: 'certificado', status: 'SENT', storageKey: 'k3', size: 1024 * 1024, equipmentId: 'e1', equipment: { id: 'e1', name: 'Laser X' } }),
  mk({ id: 'd4', name: 'Rascunho', status: 'PENDING' }),
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Documents />
      </BrowserRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.history.replaceState({}, '', '/documentos');
  vi.clearAllMocks();
  perms.granted = new Set(['documents:create', 'documents:edit', 'documents:delete']);
  docsApi.list.mockResolvedValue(docs);
  tplApi.list.mockResolvedValue([
    { id: 't1', name: 'A', active: true, content: '', createdAt: '', updatedAt: '' },
    { id: 't2', name: 'B', active: false, content: '', createdAt: '', updatedAt: '' },
  ]);
  dialogs.confirm.mockResolvedValue(true);
  dialogs.alert.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const openMenu = async (name: string) => {
  const row = screen.getAllByText(name)[0].closest('div[class*="MuiBox"]')!.parentElement!.parentElement as HTMLElement;
  await userEvent.click(within(row).getByRole('button', { name: 'Ações' }));
};

describe('Documents (página)', () => {
  it('mostra indicadores, lista e total armazenado', async () => {
    renderPage();
    expect(await screen.findByText('Termo Maria')).toBeInTheDocument();
    const stat = (l: string) => screen.getByText(l).parentElement as HTMLElement;
    await waitFor(() => expect(within(stat('Total de documentos')).getByText('4')).toBeInTheDocument());
    expect(within(stat('Assinados')).getByText('1')).toBeInTheDocument();
    expect(within(stat('Pendentes')).getByText('2')).toBeInTheDocument();
    await waitFor(() => expect(within(stat('Modelos ativos')).getByText('1')).toBeInTheDocument());
    expect(screen.getByText(/1\.0 MB em arquivos/)).toBeInTheDocument();
    expect(screen.getByText(/4 de 4/)).toBeInTheDocument();
  });

  it('busca por paciente e mostra estado de sem resultados', async () => {
    renderPage();
    await screen.findByText('Termo Maria');
    const search = screen.getByPlaceholderText('Buscar documento, paciente...');
    await userEvent.type(search, 'ana sou');
    expect(screen.queryByText('Termo Maria')).not.toBeInTheDocument();
    expect(screen.getByText('Receita Ana')).toBeInTheDocument();
    expect(window.location.search).toContain('busca=');
    await userEvent.clear(search);
    await userEvent.type(search, 'zzz');
    expect(screen.getByText('Nenhum documento encontrado')).toBeInTheDocument();
  });

  it('filtros de status, tipo e vínculo vindos da URL', async () => {
    window.history.replaceState({}, '', '/documentos?status=PENDING&vinculo=NONE');
    renderPage();
    expect(await screen.findByText('Rascunho')).toBeInTheDocument();
    expect(screen.queryByText('Receita Ana')).not.toBeInTheDocument();
    expect(screen.queryByText('Termo Maria')).not.toBeInTheDocument();
  });

  it('filtra por tipo e vínculo pelos selects', async () => {
    renderPage();
    await screen.findByText('Termo Maria');
    await userEvent.click(screen.getByLabelText('Vínculo'));
    await userEvent.click(await screen.findByRole('option', { name: /Equipamentos/ }));
    expect(screen.getByText('Manual laser')).toBeInTheDocument();
    expect(screen.queryByText('Termo Maria')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Vínculo'));
    await userEvent.click(await screen.findByRole('option', { name: /Todos os vínculos/ }));
    await userEvent.click(screen.getByLabelText('Tipo'));
    await userEvent.click(await screen.findByRole('option', { name: /^Receita/ }));
    expect(screen.getByText('Receita Ana')).toBeInTheDocument();
    expect(screen.queryByText('Manual laser')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Status'));
    await userEvent.click(await screen.findByRole('option', { name: /^Assinado/ }));
    expect(screen.getByText('Nenhum documento encontrado')).toBeInTheDocument();
  });

  it('estado vazio com atalho para novo documento', async () => {
    docsApi.list.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('Nenhum documento cadastrado')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: 'Novo documento' });
    await userEvent.click(buttons[buttons.length - 1]);
    expect(screen.getByRole('dialog', { name: 'form' })).toHaveTextContent('Novo vazio');
  });

  it('sem permissão de criar não mostra Novo documento', async () => {
    perms.granted = new Set();
    renderPage();
    await screen.findByText('Termo Maria');
    expect(screen.queryByRole('button', { name: 'Novo documento' })).not.toBeInTheDocument();
  });

  it('paginação: 8 por página', async () => {
    docsApi.list.mockResolvedValue(Array.from({ length: 11 }, (_, i) => mk({ id: `n${i}`, name: `Doc ${String(i).padStart(2, '0')}` })));
    renderPage();
    expect(await screen.findByText('Doc 00')).toBeInTheDocument();
    expect(screen.queryByText('Doc 08')).not.toBeInTheDocument();
    expect(screen.getByText(/Mostrando 1–8 de/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^2$/ }));
    expect(await screen.findByText('Doc 08')).toBeInTheDocument();
    expect(screen.getByText(/Mostrando 9–11 de/)).toBeInTheDocument();
  });

  it('clicar na linha com arquivo abre URL assinada; falha mostra alerta', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    docsApi.getAccessUrl.mockResolvedValueOnce('https://r2/x').mockRejectedValueOnce(new Error('x'));
    renderPage();
    await userEvent.click((await screen.findAllByText('Termo Maria'))[0]);
    await waitFor(() => expect(open).toHaveBeenCalledWith('https://r2/x', '_blank', 'noopener,noreferrer'));
    expect(docsApi.getAccessUrl).toHaveBeenCalledWith('d1');
    await userEvent.click(screen.getAllByText('Manual laser')[0]);
    await waitFor(() => expect(dialogs.alert).toHaveBeenCalledWith(expect.objectContaining({ title: 'Não foi possível abrir' })));
  });

  it('clicar em documento de texto abre o visualizador; sem texto nem arquivo abre edição', async () => {
    renderPage();
    await userEvent.click((await screen.findAllByText('Receita Ana'))[0]);
    expect(screen.getByRole('dialog', { name: 'viewer' })).toHaveTextContent('Vendo Receita Ana');
    await userEvent.click(screen.getAllByText('Rascunho')[0]);
    expect(screen.getByRole('dialog', { name: 'form' })).toHaveTextContent('Editando Rascunho');
  });

  it('menu: marcar status otimista, erro reverte', async () => {
    docsApi.update.mockResolvedValueOnce({ ...docs[3], status: 'SIGNED' });
    renderPage();
    await screen.findByText('Rascunho');
    await openMenu('Rascunho');
    await userEvent.click(await screen.findByText('Marcar como assinado'));
    await waitFor(() => expect(docsApi.update).toHaveBeenCalledWith('d4', { status: 'SIGNED' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Documento marcado como assinado.'));

    docsApi.update.mockRejectedValueOnce(new Error('x'));
    await openMenu('Receita Ana');
    await userEvent.click(await screen.findByText('Marcar como assinado'));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it('menu: excluir com confirmação remove da lista; cancelar mantém', async () => {
    docsApi.remove.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText('Rascunho');
    dialogs.confirm.mockResolvedValueOnce(false);
    await openMenu('Rascunho');
    await userEvent.click(await screen.findByText('Excluir'));
    await waitFor(() => expect(dialogs.confirm).toHaveBeenCalledTimes(1));
    expect(docsApi.remove).not.toHaveBeenCalled();
    await openMenu('Rascunho');
    await userEvent.click(await screen.findByText('Excluir'));
    await waitFor(() => expect(docsApi.remove.mock.calls[0]?.[0]).toBe('d4'));
    await waitFor(() => expect(screen.queryByText('Rascunho')).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith('Documento excluído.');
  });

  it('menu: abrir arquivo, visualizar, enviar e editar', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    docsApi.getAccessUrl.mockResolvedValue('https://r2/y');
    renderPage();
    await screen.findByText('Termo Maria');
    await openMenu('Termo Maria');
    await userEvent.click(await screen.findByText('Abrir arquivo'));
    await waitFor(() => expect(open).toHaveBeenCalled());
    await openMenu('Receita Ana');
    await userEvent.click(await screen.findByText('Enviar ao paciente'));
    expect(screen.getByRole('dialog', { name: 'send' })).toHaveTextContent('Enviando Receita Ana');
    await openMenu('Receita Ana');
    await userEvent.click(await screen.findByText('Visualizar e imprimir'));
    expect(screen.getByRole('dialog', { name: 'viewer' })).toBeInTheDocument();
    await openMenu('Manual laser');
    await userEvent.click(await screen.findByText('Editar'));
    expect(screen.getByRole('dialog', { name: 'form' })).toHaveTextContent('Editando Manual laser');
  });

  it('anexar versão assinada: envia o arquivo e rejeita acima de 25 MB', async () => {
    docsApi.attachFile.mockResolvedValue({ ...docs[3], status: 'SIGNED', storageKey: 'new', name: 'Rascunho' });
    renderPage();
    await screen.findByText('Rascunho');
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => undefined);
    await openMenu('Rascunho');
    await userEvent.click(await screen.findByText('Anexar versão assinada'));
    expect(clickSpy).toHaveBeenCalled();
    const file = new File(['%PDF'], 'assinado.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(docsApi.attachFile).toHaveBeenCalledWith('d4', file));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Versão assinada anexada.'));

    await openMenu('Receita Ana');
    await userEvent.click(await screen.findByText('Anexar versão assinada'));
    const big = new File(['x'], 'g.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 26 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [big] } });
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('limite é 25 MB'));
    expect(docsApi.attachFile).toHaveBeenCalledTimes(1);
  });

  it('documento gerado de modelo é inserido na lista e abre o visualizador', async () => {
    renderPage();
    await screen.findByText('Termo Maria');
    await userEvent.click(screen.getByRole('button', { name: 'Novo documento' }));
    await userEvent.click(screen.getByRole('button', { name: 'salvar-gerado' }));
    expect(await screen.findAllByText('Gerado do modelo')).not.toHaveLength(0);
    expect(screen.getByRole('dialog', { name: 'viewer' })).toHaveTextContent('Vendo Gerado do modelo');
  });

  it('abre o diálogo de modelos', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Modelos de documento' }));
    expect(screen.getByRole('dialog', { name: 'templates' })).toBeInTheDocument();
  });
});
