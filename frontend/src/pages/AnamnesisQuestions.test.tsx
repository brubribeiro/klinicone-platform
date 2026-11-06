import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AnamnesisQuestion, User } from '../types';
import { AnamnesisQuestions } from './AnamnesisQuestions';

vi.setConfig({ testTimeout: 30_000 });

const api = vi.hoisted(() => ({ listQuestions: vi.fn(), reorderQuestions: vi.fn(), updateQuestion: vi.fn(), createQuestion: vi.fn() }));
vi.mock('../api/anamnesis', () => ({ anamnesisApi: api }));
const auth = vi.hoisted(() => ({ user: { features: ['routines'] } as Partial<User> }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
vi.mock('../contexts/AppToastContext', () => ({ useAppToast: () => toast }));

const mkQ = (o: Partial<AnamnesisQuestion>): AnamnesisQuestion => ({
  id: 'q1', kind: 'GENERAL', key: 'k1', label: 'Pergunta 1', type: 'TEXT', options: [], section: null, placeholder: null,
  required: false, sortOrder: 1, active: true, system: false, ...o,
});
const GENERAL = [
  mkQ({ id: 'q1', label: 'Pergunta 1', required: true, section: 'Saúde' }),
  mkQ({ id: 'q2', label: 'Pergunta 2', type: 'SINGLE_CHOICE', options: ['A', 'B'], active: false }),
  mkQ({ id: 'q3', label: 'Peso', system: true, type: 'NUMBER' }),
];
const SKIN = [mkQ({ id: 's1', kind: 'SKIN', label: 'Fototipo', system: true, type: 'SINGLE_CHOICE', options: ['I', 'II'] })];

function renderIt() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AnamnesisQuestions />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { features: ['routines'] };
  api.listQuestions.mockImplementation(async (kind: string) => (kind === 'SKIN' ? SKIN : GENERAL));
  api.reorderQuestions.mockImplementation(async (_k: string, ids: string[]) => ids.map((id) => GENERAL.find((q) => q.id === id)!));
  api.updateQuestion.mockResolvedValue({});
});


describe('AnamnesisQuestions', () => {
  it('lista as perguntas com tipo, seção, opções e contagem de ativas', async () => {
    renderIt();
    expect(await screen.findByText('Pergunta 2')).toBeInTheDocument();
    expect(screen.getByText(/2 de 3 ativas/)).toBeInTheDocument();
    expect(screen.getByText('Saúde')).toBeInTheDocument();
    expect(screen.getByText('A · B')).toBeInTheDocument();
    expect(screen.getByText('Escolha única')).toBeInTheDocument();
    expect(screen.getByText('Histórico de medidas')).toBeInTheDocument();
    expect(api.listQuestions).toHaveBeenCalledWith('GENERAL');
  });

  it('mostra as abas só com o módulo de rotinas e troca para a de pele', async () => {
    renderIt();
    await screen.findByText('Pergunta 1');
    await userEvent.click(screen.getByRole('tab', { name: 'Anamnese de pele' }));
    expect(await screen.findByText('Fototipo')).toBeInTheDocument();
    expect(screen.getByText('Gera a rotina')).toBeInTheDocument();
    expect(api.listQuestions).toHaveBeenCalledWith('SKIN');
  });

  it('sem o módulo de rotinas não há abas', async () => {
    auth.user = { features: [] };
    renderIt();
    await screen.findByText('Pergunta 1');
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('ativa uma pergunta inativa com PATCH active: true; pergunta do sistema não alterna', async () => {
    renderIt();
    await screen.findByText('Pergunta 2');
    expect(screen.getByRole('checkbox', { name: 'Ativa: Peso' })).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Ativa: Pergunta 2' }));
    await waitFor(() => expect(api.updateQuestion).toHaveBeenCalledWith('q2', { active: true }));
  });

  it('erro ao ativar avisa', async () => {
    api.updateQuestion.mockRejectedValue(new Error('x'));
    renderIt();
    await screen.findByText('Pergunta 2');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Ativa: Pergunta 1' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('x'));
  });

  it('desabilita subir no primeiro e descer no último; reordena enviando os ids', async () => {
    renderIt();
    await screen.findByText('Pergunta 2');
    const up = screen.getAllByRole('button', { name: 'Subir' });
    const down = screen.getAllByRole('button', { name: 'Descer' });
    expect(up[0]).toBeDisabled();
    expect(down[2]).toBeDisabled();
    await userEvent.click(up[1]);
    await waitFor(() => expect(api.reorderQuestions).toHaveBeenCalledWith('GENERAL', ['q2', 'q1', 'q3']));
    // ordem otimista na tela
    await waitFor(() => {
      const labels = screen.getAllByText(/^(Pergunta 1|Pergunta 2|Peso)/).map((e) => e.textContent?.replace(' *', ''));
      expect(labels.slice(0, 3)).toEqual(['Pergunta 2', 'Pergunta 1', 'Peso']);
    });
  });

  it('descer move para baixo', async () => {
    renderIt();
    await screen.findByText('Pergunta 2');
    await userEvent.click(screen.getAllByRole('button', { name: 'Descer' })[0]);
    await waitFor(() => expect(api.reorderQuestions).toHaveBeenCalledWith('GENERAL', ['q2', 'q1', 'q3']));
  });

  it('erro ao reordenar avisa e recarrega a lista', async () => {
    api.reorderQuestions.mockRejectedValue({ response: { data: { message: 'Falhou ao ordenar' } } });
    renderIt();
    await screen.findByText('Pergunta 2');
    await userEvent.click(screen.getAllByRole('button', { name: 'Descer' })[0]);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Falhou ao ordenar'));
    await waitFor(() => expect(api.listQuestions.mock.calls.length).toBeGreaterThan(1));
  });

  it('"Nova pergunta" abre o formulário vazio com as seções existentes', async () => {
    renderIt();
    await screen.findByText('Pergunta 2');
    await userEvent.click(screen.getByRole('button', { name: 'Nova pergunta' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Nova pergunta')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Salvar' })).toBeDisabled();
  });

  it('editar abre o formulário com a pergunta escolhida', async () => {
    renderIt();
    await screen.findByText('Pergunta 2');
    await userEvent.click(screen.getByRole('button', { name: 'Editar Pergunta 1' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Editar pergunta')).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue('Pergunta 1')).toBeInTheDocument();
  });

  it('mostra esqueleto enquanto carrega', () => {
    api.listQuestions.mockReturnValue(new Promise(() => {}));
    renderIt();
    expect(screen.queryByText(/ativas/)).not.toBeInTheDocument();
    expect(document.querySelectorAll('.MuiSkeleton-root').length).toBe(6);
  });
});
