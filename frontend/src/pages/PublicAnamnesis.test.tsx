import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PublicAnamnesisForm } from '../types';
import { PublicAnamnesis } from './PublicAnamnesis';

vi.setConfig({ testTimeout: 30_000 });

const api = vi.hoisted(() => ({ getPublicForm: vi.fn(), submitPublic: vi.fn() }));
vi.mock('../api/anamnesis', () => ({ anamnesisApi: api }));

const form: PublicAnamnesisForm = {
  firstName: 'Maria',
  clinicName: 'Clínica Aurora',
  expiresAt: '2026-03-17T12:00:00.000Z',
  questions: [
    { key: 'lentes', label: 'Usa lentes?', type: 'BOOLEAN', options: [], section: 'Saúde', placeholder: null, required: true },
    { key: 'alergia', label: 'Alergias', type: 'TEXT', options: [], section: 'Saúde', placeholder: 'Quais?', required: false },
    { key: 'sol', label: 'Exposição ao sol', type: 'SINGLE_CHOICE', options: ['Pouca', 'Muita'], section: null, placeholder: null, required: true },
  ],
};

function renderIt(token = 'tok/1') {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[`/anamnese/${encodeURIComponent(token)}`]}>
        <Routes>
          <Route path="/anamnese/:token" element={<PublicAnamnesis />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  Element.prototype.scrollIntoView = vi.fn();
  api.getPublicForm.mockResolvedValue(form);
  api.submitPublic.mockResolvedValue(undefined);
});

describe('PublicAnamnesis', () => {
  it('mostra carregando e depois a saudação, a clínica e as perguntas por seção', async () => {
    renderIt();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Olá, Maria!' })).toBeInTheDocument();
    expect(api.getPublicForm).toHaveBeenCalledWith('tok/1');
    expect(screen.getByText('Clínica Aurora')).toBeInTheDocument();
    expect(screen.getByText('Saúde')).toBeInTheDocument();
    expect(screen.getByText('Outras perguntas')).toBeInTheDocument();
    expect(screen.getByText('Usa lentes?')).toBeInTheDocument();
    expect(screen.getByText('Exposição ao sol')).toBeInTheDocument();
  });

  it('link vencido ou usado mostra a mensagem do servidor', async () => {
    api.getPublicForm.mockRejectedValue({ response: { data: { message: 'Este link expirou. Peça um novo à clínica.' } } });
    renderIt();
    expect(await screen.findByText('Link indisponível')).toBeInTheDocument();
    expect(screen.getByText('Este link expirou. Peça um novo à clínica.')).toBeInTheDocument();
    expect(screen.getAllByText('Ficha de anamnese').length).toBeGreaterThan(0);
  });

  it('erro sem mensagem usa o texto padrão', async () => {
    api.getPublicForm.mockRejectedValue({ response: { status: 404, data: {} } });
    renderIt();
    expect(await screen.findByText('Link indisponível')).toBeInTheDocument();
    expect(screen.getByText(/Peça um novo link à clínica/)).toBeInTheDocument();
  });

  it('não envia com obrigatórias em branco: avisa, destaca e rola até a primeira', async () => {
    renderIt();
    await screen.findByText('Usa lentes?');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar respostas' }));
    expect(api.submitPublic).not.toHaveBeenCalled();
    expect(screen.getByText('Faltam 2 respostas obrigatórias.')).toBeInTheDocument();
    expect(screen.getAllByText('Resposta obrigatória')).toHaveLength(2);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('radio', { name: 'Não' }));
    expect(screen.getByText('Faltam 1 resposta obrigatória.')).toBeInTheDocument();
  });

  it('envia só as respostas preenchidas (Não conta como resposta) e agradece', async () => {
    renderIt();
    await screen.findByText('Usa lentes?');
    await userEvent.click(screen.getByRole('radio', { name: 'Não' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Muita' }));
    await userEvent.type(screen.getByPlaceholderText('Quais?'), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar respostas' }));
    await waitFor(() => expect(api.submitPublic).toHaveBeenCalledTimes(1));
    expect(api.submitPublic).toHaveBeenCalledWith('tok/1', { lentes: false, sol: 'Muita' });
    expect(await screen.findByText('Obrigada, Maria!')).toBeInTheDocument();
    expect(screen.getByText(/Já pode fechar esta página/)).toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenCalled();
  });

  it('inclui texto livre preenchido', async () => {
    renderIt();
    await screen.findByText('Usa lentes?');
    await userEvent.click(screen.getByRole('radio', { name: 'Sim' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Pouca' }));
    await userEvent.type(screen.getByPlaceholderText('Quais?'), 'Dipirona');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar respostas' }));
    await waitFor(() => expect(api.submitPublic).toHaveBeenCalled());
    expect(api.submitPublic).toHaveBeenCalledWith('tok/1', { lentes: true, sol: 'Pouca', alergia: 'Dipirona' });
  });

  it('erro no envio mostra o alerta e permite tentar de novo', async () => {
    api.submitPublic.mockRejectedValueOnce({ response: { data: { message: 'Link já utilizado' } } });
    renderIt();
    await screen.findByText('Usa lentes?');
    await userEvent.click(screen.getByRole('radio', { name: 'Sim' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Pouca' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enviar respostas' }));
    expect(await screen.findByText('Link já utilizado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar respostas' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Enviar respostas' }));
    expect(await screen.findByText('Obrigada, Maria!')).toBeInTheDocument();
  });

  it('desabilita o botão enquanto envia', async () => {
    let resolve!: () => void;
    api.submitPublic.mockReturnValue(new Promise<void>((r) => { resolve = r; }));
    renderIt();
    await screen.findByText('Usa lentes?');
    await userEvent.click(screen.getByRole('radio', { name: 'Sim' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Pouca' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enviar respostas' }));
    expect(await screen.findByRole('button', { name: 'Enviando…' })).toBeDisabled();
    resolve();
    expect(await screen.findByText('Obrigada, Maria!')).toBeInTheDocument();
  });

  it('sem nome da clínica usa o título padrão', async () => {
    api.getPublicForm.mockResolvedValue({ ...form, clinicName: null });
    renderIt();
    await screen.findByText('Usa lentes?');
    expect(screen.getAllByText('Ficha de anamnese').length).toBeGreaterThan(0);
  });
});
