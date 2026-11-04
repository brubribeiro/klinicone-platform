import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { DocumentTemplatesDialog } from './DocumentTemplatesDialog';

vi.setConfig({ testTimeout: 30_000 });

const api = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }));
vi.mock('../../api/documentTemplates', () => ({ documentTemplatesApi: api }));
vi.mock('../../api/catalogs', () => ({ catalogsApi: { list: vi.fn().mockRejectedValue(new Error('offline')) } }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));
const confirm = vi.hoisted(() => vi.fn());
vi.mock('../../contexts/AppDialogContext', () => ({ useAppDialog: () => ({ confirm }) }));

const tpl = (o: object) => ({
  id: 't1', name: 'Termo de peeling', category: 'consentimento', content: 'Eu, {{paciente}}.', active: true,
  createdAt: '', updatedAt: '', _count: { documents: 2 }, ...o,
});

function setup(canEdit = true, canDelete = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <DocumentTemplatesDialog open onClose={onClose} canEdit={canEdit} canDelete={canDelete} />
    </QueryClientProvider>,
  );
  return { onClose };
}

describe('DocumentTemplatesDialog', () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset());
    toast.error.mockReset();
    toast.success.mockReset();
    confirm.mockReset();
  });

  it('lista modelos com contagem de uso e estado vazio', async () => {
    api.list.mockResolvedValue([tpl({}), tpl({ id: 't2', name: 'Recibo', category: 'recibo', active: false, _count: { documents: 1 } })]);
    setup();
    expect(await screen.findByText('Termo de peeling')).toBeInTheDocument();
    expect(screen.getByText('2 documentos gerados')).toBeInTheDocument();
    expect(screen.getByText('1 documento gerado')).toBeInTheDocument();
    expect(screen.getByText('1 ativos de 2')).toBeInTheDocument();
  });

  it('mensagem de lista vazia', async () => {
    api.list.mockResolvedValue([]);
    setup();
    expect(await screen.findByText('Nenhum modelo cadastrado.')).toBeInTheDocument();
  });

  it('sem permissão não mostra ações', async () => {
    api.list.mockResolvedValue([tpl({})]);
    setup(false, false);
    await screen.findByText('Termo de peeling');
    expect(screen.queryByRole('button', { name: 'Novo modelo' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Editar modelo Termo de peeling')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Excluir modelo Termo de peeling')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('cria modelo inserindo campos automáticos e envia payload', async () => {
    api.list.mockResolvedValue([tpl({})]);
    api.create.mockResolvedValue(tpl({ id: 't9', name: 'Autorização', content: 'Eu, {{paciente}}', _count: undefined }));
    setup();
    await screen.findByText('Termo de peeling');
    await userEvent.click(screen.getByRole('button', { name: 'Novo modelo' }));
    const save = screen.getByRole('button', { name: 'Salvar modelo' });
    expect(save).toBeDisabled();
    await userEvent.type(screen.getByPlaceholderText(/Consentimento — Preenchimento/), 'Autorização');
    const content = screen.getByPlaceholderText(/declaro que/);
    await userEvent.type(content, 'Eu, ');
    await userEvent.click(screen.getByText('Nome do paciente'));
    expect(content).toHaveValue('Eu, {{paciente}}');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(save);
    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith({
        name: 'Autorização', category: 'consentimento', content: 'Eu, {{paciente}}', active: false,
      }),
    );
    expect(toast.success).toHaveBeenCalledWith('Modelo criado.');
    expect(await screen.findByText('Autorização')).toBeInTheDocument();
  });

  it('edita modelo existente e volta para a lista', async () => {
    api.list.mockResolvedValue([tpl({})]);
    api.update.mockResolvedValue(tpl({ name: 'Termo renomeado' }));
    setup();
    await userEvent.click(await screen.findByLabelText('Editar modelo Termo de peeling'));
    expect(screen.getByText('Editar modelo')).toBeInTheDocument();
    const name = screen.getByDisplayValue('Termo de peeling');
    await userEvent.clear(name);
    await userEvent.type(name, 'Termo renomeado');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar modelo' }));
    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith('t1', {
        name: 'Termo renomeado', category: 'consentimento', content: 'Eu, {{paciente}}.', active: true,
      }),
    );
    expect(toast.success).toHaveBeenCalledWith('Modelo atualizado.');
    expect(await screen.findByText('Modelos de documento')).toBeInTheDocument();
  });

  it('mantém o formulário e avisa quando salvar falha; Voltar descarta', async () => {
    api.list.mockResolvedValue([]);
    api.create.mockRejectedValue(new Error('x'));
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Novo modelo' }));
    await userEvent.type(screen.getByPlaceholderText(/Consentimento — Preenchimento/), 'A');
    await userEvent.type(screen.getByPlaceholderText(/declaro que/), 'B');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar modelo' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByText('Novo modelo', { selector: 'h2, h2 *' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(await screen.findByText('Modelos de documento')).toBeInTheDocument();
  });

  it('ativa/desativa com atualização otimista e desfaz em caso de erro', async () => {
    api.list.mockResolvedValue([tpl({})]);
    api.update.mockRejectedValue(new Error('x'));
    setup();
    await screen.findByText('Termo de peeling');
    const sw = screen.getByRole('checkbox');
    expect(sw).toBeChecked();
    await userEvent.click(sw);
    expect(api.update).toHaveBeenCalledWith('t1', { active: false });
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeChecked());
  });

  it('exclui após confirmação e não exclui se cancelar', async () => {
    api.list.mockResolvedValue([tpl({})]);
    api.remove.mockResolvedValue(undefined);
    setup();
    confirm.mockResolvedValueOnce(false);
    await userEvent.click(await screen.findByLabelText('Excluir modelo Termo de peeling'));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(api.remove).not.toHaveBeenCalled();
    confirm.mockResolvedValueOnce(true);
    await userEvent.click(screen.getByLabelText('Excluir modelo Termo de peeling'));
    await waitFor(() => expect(api.remove).toHaveBeenCalled());
    expect(api.remove.mock.calls[0][0]).toBe('t1');
    expect(confirm.mock.calls[1][0].subtitle).toContain('2 documento(s)');
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Modelo excluído.'));
    expect(await screen.findByText('Nenhum modelo cadastrado.')).toBeInTheDocument();
  });
});
