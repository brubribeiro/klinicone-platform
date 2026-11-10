import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MessageTemplate } from '../types';
import { Messages } from './Messages';

vi.setConfig({ testTimeout: 30_000 });

const msgApi = vi.hoisted(() => ({ list: vi.fn(), remove: vi.fn(), update: vi.fn() }));
vi.mock('../api/messages', () => ({ messagesApi: msgApi }));
const procApi = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('../api/procedures', () => ({ proceduresApi: procApi }));
vi.mock('../api/catalogs', () => ({ catalogsApi: { list: vi.fn().mockRejectedValue(new Error('offline')) } }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
const dialogs = vi.hoisted(() => ({ confirm: vi.fn(), alert: vi.fn() }));
vi.mock('../contexts/AppToastContext', () => ({ useAppToast: () => toast }));
vi.mock('../contexts/AppDialogContext', () => ({ useAppDialog: () => dialogs }));
const perms = vi.hoisted(() => ({ granted: new Set<string>() }));
vi.mock('../contexts/usePermissions', () => ({ usePermissions: () => ({ has: (p: string) => perms.granted.has(p) }) }));
vi.mock('../components/messages/PendingWhatsAppDispatches', () => ({ PendingWhatsAppDispatches: () => <div>fila-pendentes</div> }));
vi.mock('../components/messages/MessageTemplateFormDialog', () => ({
  MessageTemplateFormDialog: ({ open, template }: { open: boolean; template?: MessageTemplate | null }) =>
    open ? <div role="dialog">{template ? `Editando ${template.name}` : 'Novo modelo vazio'}</div> : null,
}));

const mk = (o: Partial<MessageTemplate>): MessageTemplate => ({
  id: 'x', name: 'x', trigger: 'MANUAL', active: true, content: 'x', ...o,
});

const templates: MessageTemplate[] = [
  mk({ id: 'm1', name: 'Lembrete 24h', trigger: 'DAY_BEFORE', category: 'lembrete', content: 'Oi {nome}, amanhã às {hora}.' }),
  mk({ id: 'm2', name: 'Confirmação', trigger: 'ON_BOOKING', category: 'confirmacao', content: 'Agendado para {data}.' }),
  mk({ id: 'm3', name: 'Parabéns', trigger: 'BIRTHDAY', category: 'aniversario', active: false, content: 'Feliz aniversário {nome}!' }),
  mk({ id: 'm4', name: 'Promo Peeling', trigger: 'MANUAL', category: 'promocao', content: 'Peeling com desconto', procedure: { id: 'pr1', name: 'Peeling', price: 250 } }),
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Messages />
      </BrowserRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.history.replaceState({}, '', '/mensagens');
  vi.clearAllMocks();
  perms.granted = new Set(['messages:create', 'messages:edit', 'messages:delete']);
  msgApi.list.mockResolvedValue(templates);
  procApi.list.mockResolvedValue([]);
  dialogs.confirm.mockResolvedValue(true);
});

const rowNames = () => screen.getAllByRole('button', { pressed: undefined }).filter((b) => b.hasAttribute('aria-pressed'));

describe('Messages (página)', () => {
  it('ordena pela jornada do paciente e deixa inativos por último; seleciona o primeiro', async () => {
    renderPage();
    await screen.findAllByText('Confirmação');
    const names = rowNames().map((b) => b.textContent ?? '');
    const idx = (n: string) => names.findIndex((t) => t.includes(n));
    expect(idx('Confirmação')).toBeLessThan(idx('Lembrete 24h'));
    expect(idx('Lembrete 24h')).toBeLessThan(idx('Promo Peeling'));
    expect(idx('Promo Peeling')).toBeLessThan(idx('Parabéns'));
    expect(rowNames()[0]).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('fila-pendentes')).toBeInTheDocument();
    // Prévia do primeiro (Confirmação)
    expect(screen.getAllByText('{data}')).toHaveLength(1);
  });

  it('seleciona outro modelo e mostra prévia com variáveis e faixa de promoção', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /^Promo Peeling/ }));
    expect(screen.getByText(/PROMOÇÃO — Peeling/)).toBeInTheDocument();
    expect(screen.getByText('Variáveis disponíveis')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Promo Peeling/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('busca filtra por nome/conteúdo e mostra estado vazio', async () => {
    renderPage();
    await screen.findAllByText('Confirmação');
    const search = screen.getByLabelText('Buscar modelo');
    await userEvent.type(search, 'aniversário');
    expect(screen.queryByRole('button', { name: /^Lembrete 24h/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Parabéns/ })).toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.type(search, 'zzzz');
    expect(screen.getByText('Nenhum modelo encontrado')).toBeInTheDocument();
    expect(screen.getByText('Nenhum modelo selecionado')).toBeInTheDocument();
  });

  it('lista vazia', async () => {
    msgApi.list.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('Nenhum modelo cadastrado')).toBeInTheDocument();
  });

  it('Novo abre o formulário vazio e Editar mensagem abre com o modelo', async () => {
    renderPage();
    await screen.findAllByText('Confirmação');
    await userEvent.click(screen.getByRole('button', { name: /Novo/ }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Novo modelo vazio');
  });

  it('Editar mensagem abre o formulário com o modelo selecionado', async () => {
    renderPage();
    await screen.findAllByText('Confirmação');
    await userEvent.click(screen.getByRole('button', { name: /Editar modelo Confirmação/ }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Editando Confirmação');
  });

  it('ativar/desativar pelo selo: otimista, toast e payload', async () => {
    msgApi.update.mockResolvedValue({ ...templates[1], active: false });
    renderPage();
    await screen.findAllByText('Confirmação');
    await userEvent.click(screen.getByRole('button', { name: 'Clique para desativar' }));
    await waitFor(() => expect(msgApi.update).toHaveBeenCalledWith('m2', { active: false }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Modelo desativado.'));
  });

  it('erro ao alterar status reverte e avisa', async () => {
    msgApi.update.mockRejectedValue(new Error('x'));
    renderPage();
    await screen.findAllByText('Confirmação');
    await userEvent.click(screen.getByRole('button', { name: 'Clique para desativar' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Clique para desativar' })).toBeInTheDocument());
  });

  it('excluir pede confirmação, chama API e avisa; cancelar não exclui', async () => {
    msgApi.remove.mockResolvedValue(undefined);
    renderPage();
    await screen.findAllByText('Confirmação');
    dialogs.confirm.mockResolvedValueOnce(false);
    await userEvent.click(screen.getByLabelText('Excluir modelo Confirmação'));
    await waitFor(() => expect(dialogs.confirm).toHaveBeenCalledTimes(1));
    expect(msgApi.remove).not.toHaveBeenCalled();
    await userEvent.click(screen.getByLabelText('Excluir modelo Confirmação'));
    await waitFor(() => expect(msgApi.remove.mock.calls[0]?.[0]).toBe('m2'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Modelo excluído.'));
  });

  it('falha ao excluir mostra erro', async () => {
    msgApi.remove.mockRejectedValue(new Error('x'));
    renderPage();
    await screen.findAllByText('Confirmação');
    await userEvent.click(screen.getByLabelText('Excluir modelo Confirmação'));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it('somente leitura: sem Novo, Editar, Excluir e selo clicável', async () => {
    perms.granted = new Set();
    renderPage();
    await screen.findAllByText('Confirmação');
    expect(screen.queryByRole('button', { name: /Novo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar modelo Confirmação/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Excluir modelo Confirmação')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Clique para/ })).not.toBeInTheDocument();
    expect(within(document.body).getAllByText('Ativa').length).toBeGreaterThan(0);
  });
});
