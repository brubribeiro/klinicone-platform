import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { MessageTemplateFormDialog } from './MessageTemplateFormDialog';
import type { MessageTemplate, Procedure } from '../../types';

vi.setConfig({ testTimeout: 30_000 });

const api = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
vi.mock('../../api/messages', () => ({ messagesApi: api }));
vi.mock('../../api/catalogs', () => ({ catalogsApi: { list: vi.fn().mockRejectedValue(new Error('offline')) } }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));

const procedures = [
  { id: 'pr1', name: 'Peeling', price: 250 },
  { id: 'pr2', name: 'Botox', price: '1200' },
] as unknown as Procedure[];

function setup(template?: MessageTemplate | null) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <MessageTemplateFormDialog open onClose={onClose} template={template} procedures={procedures} onSaved={onSaved} />
    </QueryClientProvider>,
  );
  return { onClose, onSaved, invalidate };
}

const titleInput = () => screen.getByPlaceholderText('Ex.: Lembrete 24h');
const contentInput = () => screen.getByPlaceholderText(/Escreva a mensagem usando/) as HTMLTextAreaElement;

describe('MessageTemplateFormDialog', () => {
  beforeEach(() => {
    api.create.mockReset();
    api.update.mockReset();
    toast.error.mockReset();
    toast.success.mockReset();
  });

  it('valida campos obrigatórios', async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar modelo' }));
    expect(await screen.findByText('Título é obrigatório')).toBeInTheDocument();
    expect(screen.getByText('Mensagem é obrigatória')).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('cria modelo inserindo variável e emoji, ', async () => {
    api.create.mockResolvedValue({ id: 'new' });
    const { onClose, onSaved, invalidate } = setup();
    expect(screen.getByText('Novo modelo de mensagem')).toBeInTheDocument();
    await userEvent.type(titleInput(), '  Lembrete 24h ');
    await userEvent.type(contentInput(), 'Olá ');
    await userEvent.click(screen.getByRole('button', { name: '{nome}' }));
    expect(contentInput().value).toBe('Olá {nome}');
    await userEvent.click(screen.getByRole('button', { name: 'Inserir emoji' }));
    await userEvent.click(screen.getByRole('button', { name: 'Gestos' }));
    await userEvent.click(await screen.findByText('👍'));
    expect(contentInput().value).toBe('Olá {nome}👍');
    expect(screen.queryByText('Gestos')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar modelo' }));
    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith({
        name: 'Lembrete 24h',
        trigger: 'ON_BOOKING',
        content: 'Olá {nome}👍',
        category: null,
        procedureId: null,
        active: true,
      }),
    );
    expect(toast.success).toHaveBeenCalledWith('Modelo criado.');
    expect(onSaved).toHaveBeenCalledWith({ id: 'new' });
    expect(onClose).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['message-templates'] });
  });

  it('categoria Promoção permite procedimento vinculado', async () => {
    api.create.mockResolvedValue({ id: 'new' });
    setup();
    expect(screen.queryByText('Procedimento vinculado')).not.toBeInTheDocument();
    await userEvent.type(titleInput(), 'Promo');
    await userEvent.type(contentInput(), 'Desconto!');
    await userEvent.click(screen.getAllByRole('combobox')[1]);
    await userEvent.click(await screen.findByRole('option', { name: 'Promoção' }));
    await userEvent.click(screen.getAllByRole('combobox')[3]);
    await userEvent.click(await screen.findByRole('option', { name: /Peeling — R\$\s250,00/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar modelo' }));
    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ category: 'promocao', procedureId: 'pr1' })),
    );
  });

  it('edita modelo existente, troca gatilho e status e envia update', async () => {
    api.update.mockResolvedValue({ id: 't1' });
    const template: MessageTemplate = {
      id: 't1', name: 'Aniversário', trigger: 'BIRTHDAY', category: 'aniversario', active: true, content: 'Parabéns {nome}!',
    };
    const { onClose } = setup(template);
    expect(screen.getByText('Editar modelo de mensagem')).toBeInTheDocument();
    await waitFor(() => expect(titleInput()).toHaveValue('Aniversário'));
    expect(contentInput()).toHaveValue('Parabéns {nome}!');
    await userEvent.click(screen.getByText('No dia do aniversário'));
    await userEvent.click(await screen.findByRole('option', { name: 'Envio manual' }));
    await userEvent.click(screen.getByText('Ativa'));
    await userEvent.click(await screen.findByRole('option', { name: 'Inativa' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar modelo' }));
    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith('t1', {
        name: 'Aniversário', trigger: 'MANUAL', content: 'Parabéns {nome}!', category: 'aniversario', procedureId: null, active: false,
      }),
    );
    expect(toast.success).toHaveBeenCalledWith('Modelo atualizado.');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('mostra erro e mantém o diálogo aberto quando salvar falha', async () => {
    api.create.mockRejectedValue(new Error('x'));
    const { onClose } = setup();
    await userEvent.type(titleInput(), 'A');
    await userEvent.type(contentInput(), 'B');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar modelo' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('cancelar fecha sem salvar', async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();
  });
});
