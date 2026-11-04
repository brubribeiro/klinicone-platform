import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { PendingWhatsAppDispatches } from './PendingWhatsAppDispatches';
import { WhatsAppPreview } from './WhatsAppPreview';
import { VariableChip } from './VariableChip';
import {
  categoryLabelMap,
  messageCategoryOptions,
  messageTriggerOptions,
  triggerForCategory,
  triggerLabelMap,
  triggerOrderMap,
  TEMPLATE_VARIABLES,
} from './messageTemplateConstants';
import { WHATSAPP_EMOJI_GROUPS } from './whatsappTemplateEmojis';
import type { MessageDispatch } from '../../types';

vi.setConfig({ testTimeout: 30_000 });

const api = vi.hoisted(() => ({ listPendingDispatches: vi.fn(), markDispatchSent: vi.fn() }));
vi.mock('../../api/messages', () => ({ messagesApi: api }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));

describe('messageTemplateConstants', () => {
  it('expõe opções, rótulos e gatilho padrão por categoria (fallbacks do catálogo)', () => {
    expect(messageCategoryOptions()[0]).toEqual({ value: '', label: '—' });
    expect(messageCategoryOptions().map((c) => c.value)).toContain('lembrete');
    expect(messageTriggerOptions().length).toBeGreaterThan(3);
    expect(categoryLabelMap().lembrete).toBe('Lembrete');
    expect(triggerForCategory('lembrete')).toBe('DAY_BEFORE');
    expect(triggerForCategory('aniversario')).toBe('BIRTHDAY');
    expect(triggerForCategory('nao-existe')).toBeUndefined();
    expect(triggerForCategory(null)).toBeUndefined();
    expect(Object.keys(triggerLabelMap())).toEqual(expect.arrayContaining(['ON_BOOKING', 'DAY_BEFORE']));
    expect(triggerOrderMap().ON_BOOKING).toBeTypeOf('number');
    expect(TEMPLATE_VARIABLES).toContain('{nome}');
    expect(WHATSAPP_EMOJI_GROUPS.map((g) => g.label)).toContain('Clínica');
  });
});

describe('VariableChip', () => {
  it('sem onClick é só texto; com onClick é botão', async () => {
    const onClick = vi.fn();
    render(
      <>
        <VariableChip label="{nome}" />
        <VariableChip label="{data}" onClick={onClick} />
      </>,
    );
    expect(screen.queryByRole('button', { name: '{nome}' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '{data}' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('WhatsAppPreview', () => {
  it('destaca variáveis e mostra faixa de promoção com valor em reais', () => {
    render(
      <WhatsAppPreview
        content={'Olá {nome}, sua sessão é {data}.'}
        category="promocao"
        procedure={{ id: 'pr', name: 'Peeling', price: 250 }}
      />,
    );
    expect(screen.getByText('{nome}')).toHaveStyle({ fontWeight: 700 });
    expect(screen.getByText('{data}')).toBeInTheDocument();
    expect(screen.getByText(/PROMOÇÃO — Peeling/)).toHaveTextContent(/R\$\s250,00/);
  });

  it('conteúdo vazio mostra dica; sem promoção não mostra faixa', () => {
    render(<WhatsAppPreview content="   " category="lembrete" procedure={{ id: 'pr', name: 'Peeling', price: 10 }} />);
    expect(screen.getByText('Escreva a mensagem para ver a prévia...')).toBeInTheDocument();
    expect(screen.queryByText(/PROMOÇÃO/)).not.toBeInTheDocument();
  });
});

describe('PendingWhatsAppDispatches', () => {
  let open: { mock: { calls: unknown[][] }; mockRestore: () => void };
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset());
    toast.error.mockReset();
    toast.success.mockReset();
    open = vi.spyOn(window, 'open').mockReturnValue(null);
  });
  afterEach(() => {
    open.mockRestore();
  });

  const dispatch = (o: Partial<MessageDispatch> = {}): MessageDispatch => ({
    id: 'm1', templateId: 't1', patientId: 'p1', trigger: 'DAY_BEFORE', renderedMessage: 'Olá Maria, amanhã às 10h.',
    waMeUrl: 'https://wa.me/5511999990000?text=Ol%C3%A1', status: 'PENDING', createdAt: '2026-03-09T09:30:00',
    template: { id: 't1', name: 'Lembrete', trigger: 'DAY_BEFORE' },
    patient: { id: 'p1', name: 'Maria Silva', phone: '11999990000' },
    appointment: { id: 'a1', startAt: '2026-03-10T10:00:00' },
    ...o,
  });

  function renderIt() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={client}>
        <PendingWhatsAppDispatches />
      </QueryClientProvider>,
    );
    return container;
  }

  it('não renderiza nada quando a fila está vazia', async () => {
    api.listPendingDispatches.mockResolvedValue([]);
    const c = renderIt();
    await waitFor(() => expect(api.listPendingDispatches).toHaveBeenCalled());
    await waitFor(() => expect(c).toBeEmptyDOMElement());
  });

  it('lista a fila, abre o link wa.me e registra o envio', async () => {
    api.listPendingDispatches.mockResolvedValue([dispatch()]);
    api.markDispatchSent.mockResolvedValue(dispatch({ status: 'SENT' }));
    renderIt();
    expect(await screen.findByText('Maria Silva · Lembrete')).toBeInTheDocument();
    expect(screen.getByText('1 na fila')).toBeInTheDocument();
    expect(screen.getByText(/Gatilho: .* · 09\/03\/2026 09:30 · Agendamento 10\/03\/2026 10:00/)).toBeInTheDocument();
    expect(screen.getByText('Olá Maria, amanhã às 10h.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Abrir WhatsApp/ }));
    expect(open).toHaveBeenCalledWith('https://wa.me/5511999990000?text=Ol%C3%A1', '_blank');
    await waitFor(() => expect(api.markDispatchSent.mock.calls[0][0]).toBe('m1'));
    expect(toast.success).toHaveBeenCalledWith('WhatsApp aberto — envio registrado.');
  });

  it('envio sem link wa.me fica desabilitado', async () => {
    api.listPendingDispatches.mockResolvedValue([dispatch({ waMeUrl: null, patient: undefined, template: undefined, appointment: undefined })]);
    renderIt();
    expect(await screen.findByText('Paciente · Modelo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Abrir WhatsApp/ })).toBeDisabled();
    expect(open).not.toHaveBeenCalled();
  });

  it('avisa quando falha ao registrar o envio', async () => {
    api.listPendingDispatches.mockResolvedValue([dispatch()]);
    api.markDispatchSent.mockRejectedValue(new Error('x'));
    renderIt();
    await userEvent.click(await screen.findByRole('button', { name: /Abrir WhatsApp/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});
