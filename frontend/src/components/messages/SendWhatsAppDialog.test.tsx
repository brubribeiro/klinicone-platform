import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { SendWhatsAppDialog } from './SendWhatsAppDialog';

vi.setConfig({ testTimeout: 30_000 });

const msgApi = vi.hoisted(() => ({ list: vi.fn(), recordManualDispatch: vi.fn() }));
vi.mock('../../api/messages', () => ({ messagesApi: msgApi }));
const patApi = vi.hoisted(() => ({ findOne: vi.fn() }));
vi.mock('../../api/patients', () => ({ patientsApi: patApi }));
vi.mock('../../api/catalogs', () => ({ catalogsApi: { list: vi.fn().mockRejectedValue(new Error('offline')) } }));

const tpl = (o: object) => ({
  id: 't1', name: 'Boas-vindas', trigger: 'ON_BOOKING', category: 'confirmacao', active: true,
  content: 'Oi {nome}! {procedimento} em {data} às {hora} com {profissional}.', ...o,
});

const templates = [
  tpl({}),
  tpl({ id: 't2', name: 'Feliz aniversário', trigger: 'BIRTHDAY', category: 'aniversario', content: 'Parabéns, {nome}!' }),
  tpl({ id: 't3', name: 'Inativo', active: false }),
];

function setup(props: Partial<React.ComponentProps<typeof SendWhatsAppDialog>> = {}) {
  const onClose = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SendWhatsAppDialog
        open
        onClose={onClose}
        phone="(11) 98888-7777"
        vars={{ paciente_nome: 'Maria' }}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onClose };
}

describe('SendWhatsAppDialog', () => {
  let open: { mock: { calls: unknown[][] }; mockRestore: () => void };
  beforeEach(() => {
    msgApi.list.mockReset().mockResolvedValue(templates);
    msgApi.recordManualDispatch.mockReset().mockResolvedValue({});
    patApi.findOne.mockReset();
    open = vi.spyOn(window, 'open').mockReturnValue(null);
  });
  afterEach(() => {
    open.mockRestore();
  });

  const messageBox = () => screen.getByLabelText('Mensagem') as HTMLTextAreaElement;

  it('usa o primeiro modelo ativo, renderiza variáveis e abre wa.me sem registrar sem paciente', async () => {
    const { onClose } = setup();
    await waitFor(() => expect(messageBox().value).toContain('Oi Maria!'));
    expect(screen.getByText(/Será enviada para: \(11\) 98888-7777/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Abrir WhatsApp/ }));
    const [url, target] = open.mock.calls[0];
    expect(String(url).startsWith('https://wa.me/5511988887777?text=')).toBe(true);
    expect(decodeURIComponent(String(url))).toContain('Oi Maria!');
    expect(target).toBe('_blank');
    expect(msgApi.recordManualDispatch).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('seleciona o modelo da categoria preferida e troca de modelo atualizando o texto', async () => {
    setup({ preferredCategory: 'aniversario' });
    await waitFor(() => expect(messageBox().value).toBe('Parabéns, Maria!'));
    await userEvent.click(screen.getByRole('combobox', { name: /Template/ }));
    expect(screen.queryByRole('option', { name: /Inativo/ })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('option', { name: /Boas-vindas/ }));
    await waitFor(() => expect(messageBox().value).toContain('Oi Maria!'));
  });

  it('permite editar a mensagem antes de enviar', async () => {
    setup({ preferredCategory: 'aniversario' });
    await waitFor(() => expect(messageBox().value).toBe('Parabéns, Maria!'));
    await userEvent.clear(messageBox());
    await userEvent.type(messageBox(), 'Olá livre');
    await userEvent.click(screen.getByRole('button', { name: /Abrir WhatsApp/ }));
    expect(decodeURIComponent(String(open.mock.calls[0][0]))).toContain('Olá livre');
  });

  it('com agendamento escolhido preenche variáveis e registra o envio manual', async () => {
    patApi.findOne.mockResolvedValue({
      id: 'p1', name: 'Maria Silva',
      appointments: [
        { id: 'a1', startAt: '2026-03-10T10:00:00', status: 'SCHEDULED', procedure: { name: 'Peeling' }, professional: { name: 'Mila Barreto' } },
        { id: 'a0', startAt: '2026-01-05T09:00:00', status: 'COMPLETED', procedure: { name: 'Limpeza' } },
      ],
    });
    setup({ patientId: 'p1' });
    const input = await screen.findByLabelText('Agendamento');
    await waitFor(() => expect(input).not.toBeDisabled());
    await userEvent.click(input);
    const options = await screen.findAllByRole('option');
    expect(options[0]).toHaveTextContent('10/03/2026 às 10:00 · Peeling · Agendado');
    expect(options[1]).toHaveTextContent('05/01/2026 às 09:00 · Limpeza · Concluído');
    await userEvent.click(options[0]);
    await waitFor(() =>
      expect(messageBox().value).toBe('Oi Maria! Peeling em 10/03/2026 às 10:00 com Mila.'),
    );
    await userEvent.click(screen.getByRole('button', { name: /Abrir WhatsApp/ }));
    expect(msgApi.recordManualDispatch).toHaveBeenCalledWith({
      templateId: 't1',
      patientId: 'p1',
      appointmentId: 'a1',
      phone: '(11) 98888-7777',
      renderedMessage: 'Oi Maria! Peeling em 10/03/2026 às 10:00 com Mila.',
    });
  });

  it('não esconde o envio se o registro manual falhar', async () => {
    msgApi.recordManualDispatch.mockRejectedValue(new Error('x'));
    patApi.findOne.mockResolvedValue({ id: 'p1', name: 'Maria', appointments: [] });
    const { onClose } = setup({ patientId: 'p1', preferredCategory: 'aniversario' });
    await waitFor(() => expect(messageBox().value).toBe('Parabéns, Maria!'));
    expect(screen.queryByLabelText('Agendamento')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Abrir WhatsApp/ }));
    expect(open).toHaveBeenCalled();
    expect(msgApi.recordManualDispatch).toHaveBeenCalledWith(expect.objectContaining({ appointmentId: null }));
    expect(onClose).toHaveBeenCalled();
  });

  it('paciente sem agendamentos: seletor desabilitado com explicação', async () => {
    patApi.findOne.mockResolvedValue({ id: 'p1', name: 'Maria', appointments: [] });
    setup({ patientId: 'p1' });
    expect(await screen.findByText('Nenhum agendamento no histórico deste paciente')).toBeInTheDocument();
    expect(screen.getByLabelText('Agendamento')).toBeDisabled();
  });

  it('sem telefone avisa e desabilita o envio', async () => {
    setup({ phone: undefined });
    expect(screen.getByText(/não tem telefone cadastrado/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Abrir WhatsApp/ })).toBeDisabled();
  });

  it('sem modelos ativos orienta a criar', async () => {
    msgApi.list.mockResolvedValue([templates[2]]);
    setup();
    expect(await screen.findByText('Crie modelos ativos na página de Mensagens')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Abrir WhatsApp/ })).toBeDisabled();
  });
});
