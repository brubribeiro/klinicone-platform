import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { DocumentActionsMenu } from './DocumentActionsMenu';
import { DocumentListRow, StatusPill } from './DocumentListRow';
import { DocumentViewerDialog } from './DocumentViewerDialog';
import { SendDocumentDialog } from './SendDocumentDialog';
import { documentFileIcon, fmtFileSize, fmtStorageTotal, sumDocumentBytes, categoryMeta, statusMeta } from './documentUtils';
import type { DocumentFile } from '../../types';

vi.setConfig({ testTimeout: 30_000 });

const api = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }));
vi.mock('../../api/documents', () => ({ documentsApi: api }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));

const baseDoc = (o: Partial<DocumentFile> = {}): DocumentFile => ({
  id: 'd1',
  name: 'Termo de consentimento',
  category: 'consentimento',
  status: 'PENDING',
  createdAt: '2026-03-10T15:00:00.000Z',
  ...o,
});

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('documentUtils', () => {
  it('formata tamanhos', () => {
    expect(fmtFileSize(null)).toBe('—');
    expect(fmtFileSize(500)).toBe('500 B');
    expect(fmtFileSize(2048)).toBe('2.0 KB');
    expect(fmtFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(fmtFileSize(2 * 1024 ** 3)).toBe('2.00 GB');
    expect(fmtStorageTotal(0)).toBe('0 B');
    expect(sumDocumentBytes([{ size: 10 }, { size: null }, {}])).toBe(10);
  });

  it('escolhe ícone por mime e categorias com fallback', () => {
    expect(documentFileIcon('application/pdf').color).toBe('#D32F2F');
    expect(documentFileIcon('image/png').color).toBe('#7B1FA2');
    expect(documentFileIcon('text/csv').color).toBe('#2E7D32');
    expect(documentFileIcon('application/msword').color).toBe('#1565C0');
    expect(documentFileIcon(null).color).toBe('#546E7A');
    expect(categoryMeta('contrato').label).toBe('Contrato');
    expect(categoryMeta('nada').label).toBe('Sem categoria');
    expect(statusMeta('SIGNED').label).toBe('Assinado');
  });
});

describe('DocumentListRow', () => {
  it('mostra dados do documento com arquivo e abre menu sem acionar a linha', async () => {
    const onClick = vi.fn();
    const onOpenMenu = vi.fn();
    render(
      <DocumentListRow
        doc={baseDoc({ storageKey: 'k', size: 2048, mimeType: 'application/pdf', patient: { id: 'p', name: 'Maria Silva' }, status: 'SIGNED', notes: 'Via 1' })}
        canEdit={false}
        onClick={onClick}
        onOpenMenu={onOpenMenu}
      />,
    );
    expect(screen.getAllByText('Termo de consentimento')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Maria Silva').length).toBeGreaterThan(0);
    expect(screen.getByText(/2\.0 KB · Via 1/)).toBeInTheDocument();
    expect(screen.getAllByText('Assinado').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Ações' }));
    expect(onOpenMenu).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
    await userEvent.click(screen.getAllByText('Termo de consentimento')[0]);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('documento de modelo sem vínculo; não clicável sem permissão nem arquivo', async () => {
    const onClick = vi.fn();
    render(
      <DocumentListRow doc={baseDoc({ equipment: undefined })} canEdit={false} onClick={onClick} onOpenMenu={vi.fn()} />,
    );
    expect(screen.getByText('Sem vínculo')).toBeInTheDocument();
    expect(screen.getByText(/Texto gerado de modelo/)).toBeInTheDocument();
    await userEvent.click(screen.getAllByText('Termo de consentimento')[0]);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('vínculo com equipamento e StatusPill', () => {
    render(
      <>
        <DocumentListRow doc={baseDoc({ equipment: { id: 'e', name: 'Laser X' } })} canEdit onClick={vi.fn()} onOpenMenu={vi.fn()} />
        <StatusPill status="SENT" />
      </>,
    );
    expect(screen.getAllByText('Laser X').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Enviado').length).toBeGreaterThan(0);
  });
});

describe('DocumentActionsMenu', () => {
  const handlers = () => ({
    onClose: vi.fn(), onOpenFile: vi.fn(), onView: vi.fn(), onAttach: vi.fn(), onSend: vi.fn(),
    onSetStatus: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(),
  });

  it('com todas as permissões mostra ações e dispara callbacks fechando o menu', async () => {
    const h = handlers();
    const doc = baseDoc({ storageKey: 'k', hasContent: true, patientId: 'p1' });
    render(<DocumentActionsMenu anchor={document.body} doc={doc} canEdit canDelete attachPending={false} {...h} />);
    expect(screen.getByText('Substituir arquivo')).toBeInTheDocument();
    expect(screen.queryByText('Marcar como pendente')).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('Marcar como assinado'));
    expect(h.onSetStatus).toHaveBeenCalledWith(doc, 'SIGNED');
    expect(h.onClose).toHaveBeenCalled();
    await userEvent.click(screen.getByText('Abrir arquivo'));
    expect(h.onOpenFile).toHaveBeenCalledWith(doc);
    await userEvent.click(screen.getByText('Visualizar e imprimir'));
    expect(h.onView).toHaveBeenCalledWith(doc);
    await userEvent.click(screen.getByText('Enviar ao paciente'));
    expect(h.onSend).toHaveBeenCalledWith(doc);
    await userEvent.click(screen.getByText('Substituir arquivo'));
    expect(h.onAttach).toHaveBeenCalledWith(doc);
    await userEvent.click(screen.getByText('Editar'));
    expect(h.onEdit).toHaveBeenCalledWith(doc);
    await userEvent.click(screen.getByText('Excluir'));
    expect(h.onDelete).toHaveBeenCalledWith(doc);
  });

  it('somente leitura esconde edição, exclusão e envio', () => {
    render(<DocumentActionsMenu anchor={document.body} doc={baseDoc({ patientId: 'p1' })} canEdit={false} canDelete={false} attachPending={false} {...handlers()} />);
    expect(screen.queryByText('Editar')).not.toBeInTheDocument();
    expect(screen.queryByText('Excluir')).not.toBeInTheDocument();
    expect(screen.queryByText('Enviar ao paciente')).not.toBeInTheDocument();
    expect(screen.queryByText('Abrir arquivo')).not.toBeInTheDocument();
  });

  it('sem arquivo oferece anexar versão assinada', () => {
    render(<DocumentActionsMenu anchor={document.body} doc={baseDoc()} canEdit canDelete={false} attachPending {...handlers()} />);
    expect(screen.getByText('Anexar versão assinada').closest('li')).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('DocumentViewerDialog', () => {
  let printSpy: ReturnType<typeof vi.fn>;
  let open: { mock: { calls: unknown[][] }; mockRestore: () => void };
  let written: string;
  beforeEach(() => {
    api.get.mockReset();
    written = '';
    printSpy = vi.fn();
    open = vi.spyOn(window, 'open').mockReturnValue({
      document: { write: (s: string) => { written += s; }, close: vi.fn() },
      focus: vi.fn(),
      print: printSpy,
    } as unknown as Window);
  });
  afterEach(() => {
    open.mockRestore();
  });

  it('carrega o texto, escapa HTML ao imprimir e aciona anexar/enviar', async () => {
    api.get.mockResolvedValue(baseDoc({ content: 'Eu, <Maria>, autorizo & aceito.' }));
    const onAttach = vi.fn();
    const onSend = vi.fn();
    const doc = baseDoc({ patientId: 'p1', template: { id: 't', name: 'Modelo A' } });
    wrap(<DocumentViewerDialog doc={doc} onClose={vi.fn()} onAttach={onAttach} onSend={onSend} />);
    expect(await screen.findByText('Eu, <Maria>, autorizo & aceito.')).toBeInTheDocument();
    expect(screen.getByText(/Modelo A/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Imprimir/ }));
    expect(open).toHaveBeenCalledWith('', '_blank', 'width=820,height=900');
    expect(written).toContain('&#60;Maria&#62;');
    expect(written).not.toContain('<Maria>');
    expect(printSpy).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /Anexar versão assinada/ }));
    expect(onAttach).toHaveBeenCalledWith(doc);
    await userEvent.click(screen.getByRole('button', { name: /Enviar ao paciente/ }));
    expect(onSend).toHaveBeenCalledWith(doc);
  });

  it('documento sem texto desabilita impressão', async () => {
    api.get.mockResolvedValue(baseDoc({ content: null }));
    wrap(<DocumentViewerDialog doc={baseDoc({ storageKey: 'k' })} onClose={vi.fn()} onAttach={vi.fn()} />);
    expect(await screen.findByText('Este documento não tem texto gerado.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Imprimir/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Substituir versão assinada/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enviar ao paciente/ })).not.toBeInTheDocument();
  });
});

describe('SendDocumentDialog', () => {
  let open: { mock: { calls: unknown[][] }; mockRestore: () => void };
  beforeEach(() => {
    api.get.mockReset();
    api.update.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
    open = vi.spyOn(window, 'open').mockReturnValue(null);
  });
  afterEach(() => {
    open.mockRestore();
  });

  const full = (o: Partial<DocumentFile> = {}) =>
    baseDoc({
      content: 'Texto do termo',
      patient: { id: 'p1', name: 'Maria Silva', phone: '(11) 98888-7777', email: 'maria@ex.com' },
      ...o,
    });

  it('abre WhatsApp com texto, marca como enviado e fecha', async () => {
    api.get.mockResolvedValue(full());
    api.update.mockResolvedValue({ ...full(), status: 'SENT' });
    const onClose = vi.fn();
    const onSent = vi.fn();
    wrap(<SendDocumentDialog doc={baseDoc({ patientId: 'p1' })} onClose={onClose} onSent={onSent} />);
    await waitFor(() => expect(screen.getByLabelText('WhatsApp do paciente')).toHaveValue('(11) 98888-7777'));
    expect((screen.getByLabelText('Mensagem') as HTMLTextAreaElement).value).toContain('Olá, Maria!');
    expect(screen.getByText(/passa de Pendente para Enviado/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Abrir WhatsApp/ }));
    const url = open.mock.calls[0][0] as string;
    expect(url.startsWith('https://wa.me/5511988887777?text=')).toBe(true);
    expect(decodeURIComponent(url)).toContain('Texto do termo');
    expect(open.mock.calls[0][1]).toBe('_blank');
    await waitFor(() => expect(api.update).toHaveBeenCalledWith('d1', { status: 'SENT' }));
    await waitFor(() => expect(onSent).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith('Documento marcado como enviado.');
    expect(onClose).toHaveBeenCalled();
  });

  it('sem incluir texto, e-mail monta mailto e não altera status se já assinado', async () => {
    api.get.mockResolvedValue(full({ status: 'SIGNED' }));
    wrap(<SendDocumentDialog doc={baseDoc({ patientId: 'p1' })} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('WhatsApp do paciente')).toHaveValue('(11) 98888-7777'));
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'E-mail' }));
    expect(screen.getByLabelText('E-mail do paciente')).toHaveValue('maria@ex.com');
    await userEvent.click(screen.getByRole('button', { name: /Abrir e-mail/ }));
    const url = open.mock.calls[0][0] as string;
    expect(url).toContain('mailto:maria%40ex.com?subject=Termo%20de%20consentimento&body=');
    expect(decodeURIComponent(url)).not.toContain('Texto do termo');
    expect(api.update).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Documento aberto no seu e-mail.');
  });

  it('valida telefone e e-mail inválidos sem abrir nada', async () => {
    api.get.mockResolvedValue(full({ patient: { id: 'p1', name: 'Maria Silva', phone: null, email: null } }));
    wrap(<SendDocumentDialog doc={baseDoc({ patientId: 'p1' })} onClose={vi.fn()} />);
    expect(await screen.findByText(/Paciente sem telefone na ficha/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('WhatsApp do paciente'), '123');
    await userEvent.click(screen.getByRole('button', { name: /Abrir WhatsApp/ }));
    expect(screen.getByText(/Informe um WhatsApp com DDD/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'E-mail' }));
    expect(screen.getByText(/Paciente sem e-mail na ficha/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('E-mail do paciente'), 'invalido');
    await userEvent.click(screen.getByRole('button', { name: /Abrir e-mail/ }));
    expect(screen.getByText('Informe um e-mail válido')).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
  });

  it('começa por e-mail quando só há e-mail; avisa falha ao marcar como enviado', async () => {
    api.get.mockResolvedValue(full({ content: null, storageKey: 'k', patient: { id: 'p1', name: 'Ana Paula', phone: null, email: 'ana@ex.com' } }));
    api.update.mockRejectedValue(new Error('boom'));
    wrap(<SendDocumentDialog doc={baseDoc({ patientId: 'p1' })} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('E-mail do paciente')).toHaveValue('ana@ex.com'));
    expect(screen.getByText(/anexe o arquivo do documento/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Abrir e-mail/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});
