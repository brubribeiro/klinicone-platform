import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AnamnesisQuestion } from '../../types';
import { AnamnesisQuestionFormDialog } from './AnamnesisQuestionFormDialog';

vi.setConfig({ testTimeout: 30_000 });

const api = vi.hoisted(() => ({ createQuestion: vi.fn(), updateQuestion: vi.fn() }));
vi.mock('../../api/anamnesis', () => ({ anamnesisApi: api }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));

const existing: AnamnesisQuestion = {
  id: 'q1', kind: 'GENERAL', key: 'lentes', label: 'Usa lentes?', type: 'BOOLEAN', options: [], section: 'Saúde',
  placeholder: null, required: true, sortOrder: 1, active: true, system: false,
};

function renderIt(p: Partial<React.ComponentProps<typeof AnamnesisQuestionFormDialog>> = {}) {
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AnamnesisQuestionFormDialog open onClose={onClose} kind="GENERAL" question={null} sections={['Saúde', 'Hábitos']} {...p} />
    </QueryClientProvider>,
  );
  return { onClose };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.createQuestion.mockResolvedValue({});
  api.updateQuestion.mockResolvedValue({});
});

describe('AnamnesisQuestionFormDialog', () => {
  it('nova pergunta: Salvar fica desabilitado sem texto', () => {
    renderIt();
    expect(screen.getByText('Nova pergunta')).toBeInTheDocument();
    expect(screen.getByText('Anamnese geral')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  });

  it('cria pergunta de texto com os padrões e dica', async () => {
    const { onClose } = renderIt();
    await userEvent.type(screen.getByPlaceholderText(/Ex\.: Usa lentes/), '  Toma remédio?  ');
    await userEvent.type(screen.getByPlaceholderText(/Ex\.: Quais/), 'Quais?');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(api.createQuestion).toHaveBeenCalledTimes(1));
    expect(api.createQuestion).toHaveBeenCalledWith({
      kind: 'GENERAL', label: 'Toma remédio?', type: 'TEXT', options: [], section: null, placeholder: 'Quais?', required: false, active: true,
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Pergunta criada.'));
    expect(onClose).toHaveBeenCalled();
  });

  it('escolha única exige ao menos 2 opções, sem duplicadas; Enter adiciona; chip remove', async () => {
    renderIt();
    await userEvent.type(screen.getByPlaceholderText(/Ex\.: Usa lentes/), 'Fuma?');
    await userEvent.click(screen.getAllByRole('combobox')[0]);
    await userEvent.click(await screen.findByRole('option', { name: 'Escolha única' }));
    const save = screen.getByRole('button', { name: 'Salvar' });
    expect(save).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeDisabled();
    const draft = screen.getByPlaceholderText('Digite uma opção e tecle Enter');
    await userEvent.type(draft, 'Nunca{Enter}');
    await userEvent.type(draft, 'Nunca{Enter}');
    expect(screen.getAllByText('Nunca')).toHaveLength(1);
    expect(save).toBeDisabled();
    await userEvent.type(draft, 'Às vezes');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(save).toBeEnabled();
    // remove e readiciona
    await userEvent.click(screen.getAllByTestId('CancelIcon')[0]);
    expect(save).toBeDisabled();
    await userEvent.type(draft, 'Sempre{Enter}');
    await userEvent.click(save);
    await waitFor(() => expect(api.createQuestion).toHaveBeenCalled());
    expect(api.createQuestion.mock.calls[0][0]).toMatchObject({ type: 'SINGLE_CHOICE', options: ['Às vezes', 'Sempre'] });
  });

  it('edita pergunta existente com os valores atuais e envia o PATCH', async () => {
    const { onClose } = renderIt({ question: existing });
    expect(screen.getByText('Editar pergunta')).toBeInTheDocument();
    const input = screen.getByDisplayValue('Usa lentes?');
    await userEvent.clear(input);
    await userEvent.type(input, 'Usa lente de contato?');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Ativa' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(api.updateQuestion).toHaveBeenCalledTimes(1));
    expect(api.updateQuestion).toHaveBeenCalledWith('q1', {
      label: 'Usa lente de contato?', type: 'BOOLEAN', options: [], section: 'Saúde', placeholder: null, required: true, active: false,
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Pergunta atualizada.'));
    expect(onClose).toHaveBeenCalled();
  });

  it('pergunta do sistema (geral): só texto e seção; sem switches nem tipo', async () => {
    renderIt({ question: { ...existing, system: true, key: 'weight' } });
    expect(screen.getByText(/Peso e altura alimentam/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Obrigatória' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('combobox')[0]).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(api.updateQuestion).toHaveBeenCalled());
    expect(api.updateQuestion).toHaveBeenCalledWith('q1', { label: 'Usa lentes?', section: 'Saúde', placeholder: null });
  });

  it('pergunta do sistema da pele mostra aviso próprio e esconde a seção', () => {
    renderIt({ kind: 'SKIN', question: { ...existing, kind: 'SKIN', system: true, type: 'SINGLE_CHOICE', options: ['a', 'b'] } });
    expect(screen.getByText(/gera a rotina de skincare/)).toBeInTheDocument();
    expect(screen.getByText('Anamnese de pele')).toBeInTheDocument();
    expect(screen.queryByText('Seção')).not.toBeInTheDocument();
  });

  it('mostra o erro do servidor e mantém aberto', async () => {
    api.createQuestion.mockRejectedValue({ response: { data: { message: 'Limite atingido' } } });
    const { onClose } = renderIt();
    await userEvent.type(screen.getByPlaceholderText(/Ex\.: Usa lentes/), 'X');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Limite atingido'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Cancelar fecha sem salvar', async () => {
    const { onClose } = renderIt();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
    expect(api.createQuestion).not.toHaveBeenCalled();
  });
});
