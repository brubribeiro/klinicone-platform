import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { SendAnamnesisLinkDialog, publicAnamnesisUrl } from './SendAnamnesisLinkDialog';

vi.setConfig({ testTimeout: 30_000 });

const api = vi.hoisted(() => ({ createLink: vi.fn() }));
vi.mock('../../api/anamnesis', () => ({ anamnesisApi: api }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));

function setup(phone: string | null = '11999998888') {
  const onClose = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SendAnamnesisLinkDialog open onClose={onClose} patient={{ id: 'p1', name: 'Maria da Silva', phone }} />
    </QueryClientProvider>,
  );
  return { onClose };
}

describe('SendAnamnesisLinkDialog', () => {
  beforeEach(() => {
    api.createLink.mockReset();
    toast.error.mockReset();
    toast.success.mockReset();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('preenche telefone e mensagem com o primeiro nome', () => {
    setup();
    expect(screen.getByDisplayValue('11999998888')).toBeInTheDocument();
    expect(screen.getByDisplayValue(/^Olá, Maria! /)).toBeInTheDocument();
  });

  it('gera link, copia e abre o WhatsApp com a mensagem e o link', async () => {
    api.createLink.mockResolvedValue({ token: 'tok123', expiresAt: '2026-11-11T15:30:00.000Z' });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { onClose } = setup();

    await userEvent.click(screen.getByRole('button', { name: 'Gerar link' }));
    expect(await screen.findByText(publicAnamnesisUrl('tok123'))).toBeInTheDocument();
    expect(api.createLink).toHaveBeenCalledWith('p1');
    expect(screen.getByText(/Válido até \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Copiar link' }));
    expect(writeText).toHaveBeenCalledWith(publicAnamnesisUrl('tok123'));
    expect(toast.success).toHaveBeenCalledWith('Link copiado');

    await userEvent.click(screen.getByRole('button', { name: 'Abrir WhatsApp' }));
    const url = open.mock.calls[0][0] as string;
    expect(url).toContain('wa.me/');
    expect(decodeURIComponent(url)).toContain('tok123');
    expect(onClose).toHaveBeenCalled();
  });

  it('avisa quando não consegue copiar e quando falta o WhatsApp', async () => {
    api.createLink.mockResolvedValue({ token: 't', expiresAt: '2026-11-11T15:30:00.000Z' });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('x')) }, configurable: true });
    setup(null);
    await userEvent.click(screen.getByRole('button', { name: 'Gerar link' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Copiar link' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Não foi possível copiar')));
    await userEvent.click(screen.getByRole('button', { name: 'Abrir WhatsApp' }));
    expect(toast.error).toHaveBeenCalledWith('Informe o WhatsApp da paciente');
    expect(open).not.toHaveBeenCalled();
  });

  it('mostra erro da API ao gerar o link', async () => {
    api.createLink.mockRejectedValue({ response: { data: { message: 'Sem permissão' } } });
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Gerar link' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Sem permissão'));
    expect(screen.getByRole('button', { name: 'Gerar link' })).toBeEnabled();
  });
});
