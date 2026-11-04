import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { DocumentFormDialog, MAX_FILE_BYTES } from './DocumentFormDialog';
import type { DocumentFile } from '../../types';

vi.setConfig({ testTimeout: 30_000 });

const docsApi = vi.hoisted(() => ({ upload: vi.fn(), update: vi.fn(), createFromTemplate: vi.fn() }));
vi.mock('../../api/documents', () => ({ documentsApi: docsApi }));
const tplApi = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('../../api/documentTemplates', () => ({ documentTemplatesApi: tplApi }));
const patientsApi = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('../../api/patients', () => ({ patientsApi }));
const equipmentApi = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('../../api/equipment', () => ({ equipmentApi }));
vi.mock('../../api/catalogs', () => ({ catalogsApi: { list: vi.fn().mockRejectedValue(new Error('offline')) } }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));

const saved: DocumentFile = { id: 'new', name: 'x', status: 'SIGNED', createdAt: '2026-03-10T12:00:00.000Z' };
const templates = [
  { id: 't1', name: 'Termo de peeling', category: 'consentimento', content: 'Eu, {paciente}, autorizo.', active: true, createdAt: '', updatedAt: '' },
  { id: 't2', name: 'Modelo antigo', content: 'x', active: false, createdAt: '', updatedAt: '' },
];

function setup(props: Partial<React.ComponentProps<typeof DocumentFormDialog>> = {}) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DocumentFormDialog open onClose={onClose} onSaved={onSaved} {...props} />
    </QueryClientProvider>,
  );
  return { onClose, onSaved };
}

const pickOption = async (label: string, placeholder: string, text: string) => {
  const input = screen.getByPlaceholderText(placeholder);
  await userEvent.click(input);
  await userEvent.click(await screen.findByRole('option', { name: text }));
  void label;
};

describe('DocumentFormDialog', () => {
  beforeEach(() => {
    Object.values(docsApi).forEach((f) => f.mockReset());
    toast.error.mockReset();
    toast.success.mockReset();
    tplApi.list.mockResolvedValue(templates);
    patientsApi.list.mockResolvedValue([
      { id: 'p1', name: 'Maria Silva' },
      { id: 'p2', name: 'Ana Souza' },
    ]);
    equipmentApi.list.mockResolvedValue([{ id: 'e1', name: 'Laser X' }]);
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
  vi.restoreAllMocks();
});

  it('envia arquivo com metadados e usa o nome do arquivo quando o nome está vazio', async () => {
    docsApi.upload.mockResolvedValue(saved);
    const { onSaved, onClose } = setup();
    const submit = screen.getByRole('button', { name: 'Enviar documento' });
    expect(submit).toBeDisabled();
    const file = new File(['%PDF'], 'termo.pdf', { type: 'application/pdf' });
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });
    expect(await screen.findByText('termo.pdf')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Visualizar arquivo' })).toHaveAttribute('href', 'blob:preview');
    expect(screen.getByPlaceholderText('Preenchido com o nome do arquivo')).toHaveValue('termo.pdf');
    await pickOption('Paciente', 'Buscar paciente...', 'Maria Silva');
    await pickOption('Equipamento', 'Opcional', 'Laser X');
    await userEvent.type(screen.getByPlaceholderText('Notas internas (opcional)'), '  Via do cliente ');
    await userEvent.click(submit);
    await waitFor(() => expect(docsApi.upload).toHaveBeenCalled());
    expect(docsApi.upload).toHaveBeenCalledWith(file, {
      name: 'termo.pdf',
      category: undefined,
      notes: 'Via do cliente',
      patientId: 'p1',
      equipmentId: 'e1',
      status: 'SIGNED',
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved, true));
    expect(toast.success).toHaveBeenCalledWith('Documento criado.');
    expect(onClose).toHaveBeenCalled();
  });

  it('rejeita arquivo acima de 25 MB e permite remover o arquivo escolhido', async () => {
    setup();
    const input = document.querySelector('input[type="file"]')!;
    const big = new File(['x'], 'grande.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: MAX_FILE_BYTES + 1 });
    fireEvent.change(input, { target: { files: [big] } });
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('limite é 25 MB'));
    expect(screen.queryByText('grande.pdf')).not.toBeInTheDocument();

    const img = new File(['x'], 'foto.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [img] } });
    expect(await screen.findByAltText('foto.png')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remover arquivo' }));
    expect(screen.getByText('Anexar arquivo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar documento' })).toBeDisabled();
  });

  it('aceita arquivo arrastado e destaca a área', async () => {
    setup();
    const zone = screen.getByRole('button', { name: /Anexar arquivo/ });
    fireEvent.dragOver(zone);
    const file = new File(['x'], 'arrastado.pdf', { type: 'application/pdf' });
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(await screen.findByText('arrastado.pdf')).toBeInTheDocument();
    // Trocar mantém o nome digitado manualmente
    await userEvent.clear(screen.getByPlaceholderText('Preenchido com o nome do arquivo'));
    await userEvent.type(screen.getByPlaceholderText('Preenchido com o nome do arquivo'), 'Meu termo');
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [new File(['y'], 'outro.pdf', { type: 'application/pdf' })] },
    });
    expect(await screen.findByText('outro.pdf')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Preenchido com o nome do arquivo')).toHaveValue('Meu termo');
  });

  it('gera documento de modelo ativo: status Pendente, categoria do modelo e payload', async () => {
    docsApi.createFromTemplate.mockResolvedValue(saved);
    const { onSaved } = setup();
    await userEvent.click(screen.getByText('Documento em branco — anexar arquivo'));
    expect(screen.queryByRole('option', { name: 'Modelo antigo' })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('option', { name: 'Termo de peeling' }));
    expect(screen.getByText('Eu, {paciente}, autorizo.')).toBeInTheDocument();
    expect(screen.getByText(/O texto é gerado com os dados do paciente/)).toBeInTheDocument();
    expect(screen.queryByText('Anexar arquivo')).not.toBeInTheDocument();
    await pickOption('Paciente', 'Buscar paciente...', 'Ana Souza');
    expect(screen.getByPlaceholderText('Termo de peeling — Ana Souza')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Gerar documento' }));
    await waitFor(() =>
      expect(docsApi.createFromTemplate).toHaveBeenCalledWith('t1', {
        name: undefined,
        category: 'consentimento',
        notes: undefined,
        patientId: 'p2',
        equipmentId: undefined,
        status: 'PENDING',
      }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('mostra erro da API ao salvar', async () => {
    docsApi.upload.mockRejectedValue({ response: { data: { message: 'Storage indisponível' } }, isAxiosError: true });
    const { onClose } = setup();
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Enviar documento' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('edita documento existente enviando só campos de metadados', async () => {
    docsApi.update.mockResolvedValue({ ...saved, id: 'd9' });
    const editing: DocumentFile = {
      id: 'd9', name: 'Contrato', category: 'contrato', status: 'SENT', notes: 'obs', patientId: 'p1',
      equipmentId: null, createdAt: '2026-03-10T12:00:00.000Z',
    };
    const { onSaved } = setup({ editing });
    expect(screen.getByText('Editar documento')).toBeInTheDocument();
    expect(screen.queryByText('Modelo')).not.toBeInTheDocument();
    expect(screen.queryByText('Anexar arquivo')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByPlaceholderText('Buscar paciente...')).toHaveValue('Maria Silva'));
    const notes = screen.getByPlaceholderText('Notas internas (opcional)');
    expect(notes).toHaveValue('obs');
    await userEvent.clear(notes);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(docsApi.update).toHaveBeenCalledWith('d9', {
        name: 'Contrato', category: 'contrato', notes: null, patientId: 'p1', equipmentId: null, status: 'SENT',
      }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ ...saved, id: 'd9' }, false));
    expect(toast.success).toHaveBeenCalledWith('Documento atualizado.');
  });

  it('avisa quando não há modelos ativos', async () => {
    tplApi.list.mockResolvedValue([templates[1]]);
    setup();
    expect(await screen.findByText(/Nenhum modelo ativo/)).toBeInTheDocument();
  });
});
