import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AnamnesisFormDialog } from './AnamnesisFormDialog';

vi.setConfig({ testTimeout: 30_000 });

const api = vi.hoisted(() => ({ findOne: vi.fn(), updateAnamnesis: vi.fn() }));
vi.mock('../../api/patients', () => ({ patientsApi: api }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('../../contexts/AppToastContext', () => ({ useAppToast: () => toast }));
const hook = vi.hoisted(() => ({ state: { data: undefined as unknown, isLoading: false } }));
vi.mock('../../hooks/useAnamnesisQuestions', () => ({ useAnamnesisQuestions: () => hook.state }));

const q = (o: object) => ({ type: 'TEXT', options: [], placeholder: null, required: false, active: true, ...o });
const QUESTIONS = [
  q({ key: 'peso', label: 'Peso', type: 'NUMBER', section: 'Medidas corporais' }),
  q({ key: 'altura', label: 'Altura', type: 'NUMBER', section: 'Medidas corporais' }),
  q({ key: 'queixaPrincipal', label: 'Queixa principal', section: 'Queixas', placeholder: 'Descreva' }),
  q({ key: 'fumante', label: 'Fumante', type: 'SINGLE_CHOICE', options: ['Não', 'Sim'], section: 'Hábitos' }),
  q({ key: 'tratamentos', label: 'Tratamentos', type: 'MULTIPLE_CHOICE', options: ['Botox', 'Peeling'], section: 'Hábitos' }),
  q({ key: 'gestante', label: 'Gestante', type: 'BOOLEAN', section: 'Saúde', required: true }),
];

function setup(patientId: string | null = 'p1') {
  const onClose = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <AnamnesisFormDialog open onClose={onClose} patientId={patientId} />
    </QueryClientProvider>,
  );
  return { onClose, invalidate };
}

describe('AnamnesisFormDialog', () => {
  beforeEach(() => {
    api.findOne.mockReset();
    api.updateAnamnesis.mockReset();
    toast.error.mockReset();
    toast.success.mockReset();
    hook.state = { data: QUESTIONS, isLoading: false };
  });

  it('mostra carregando enquanto as perguntas não chegam', () => {
    hook.state = { data: undefined, isLoading: true };
    api.findOne.mockReturnValue(new Promise(() => {}));
    setup();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('Carregando paciente…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar anamnese' })).toBeDisabled();
  });

  it('carrega respostas salvas, calcula IMC e salva as alterações', async () => {
    api.findOne.mockResolvedValue({
      id: 'p1', name: 'Maria', anamnesis: { peso: '70', altura: '175', fumante: 'Sim', tratamentos: ['Botox'], gestante: false, extraAntiga: 'preservar' },
    });
    api.updateAnamnesis.mockResolvedValue({});
    const { onClose, invalidate } = setup();
    expect(await screen.findByText('Maria')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('0')).toHaveLength(2);
    const peso = screen.getAllByPlaceholderText('0')[0];
    await waitFor(() => expect(peso).toHaveValue('70'));
    expect(screen.getByText(/22,9|22\.9/)).toBeInTheDocument();
    expect(screen.getByText('Gestante *')).toBeInTheDocument();

    await userEvent.clear(peso);
    await userEvent.type(peso, '80,5abc');
    await userEvent.type(screen.getByPlaceholderText('Descreva'), 'Manchas');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar anamnese' }));

    await waitFor(() => expect(api.updateAnamnesis).toHaveBeenCalled());
    expect(api.updateAnamnesis.mock.calls[0]).toEqual([
      'p1',
      {
        peso: '80.5', altura: '175', queixaPrincipal: 'Manchas', fumante: 'Sim',
        tratamentos: ['Botox'], gestante: true, extraAntiga: 'preservar',
      },
    ]);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Anamnese salva.'));
    expect(onClose).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['patient-measurements', 'p1'] });
  });

  it('permite escolher opção e múltiplas opções', async () => {
    api.findOne.mockResolvedValue({ id: 'p1', name: 'Maria', anamnesis: {} });
    api.updateAnamnesis.mockResolvedValue({});
    setup();
    await screen.findByText('Maria');
    const selects = await screen.findAllByRole('combobox');
    await userEvent.click(selects[0]);
    await userEvent.click(within(await screen.findByRole('listbox')).getByText('Não'));
    await userEvent.click(selects[1]);
    const lb = await screen.findByRole('listbox');
    await userEvent.click(within(lb).getByText('Botox'));
    await userEvent.click(within(lb).getByText('Peeling'));
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar anamnese' }));
    await waitFor(() => expect(api.updateAnamnesis).toHaveBeenCalled());
    expect(api.updateAnamnesis.mock.calls[0][1]).toMatchObject({ fumante: 'Não', tratamentos: ['Botox', 'Peeling'] });
  });

  it('exibe erro da API e mantém aberto', async () => {
    api.findOne.mockResolvedValue({ id: 'p1', name: 'Maria', anamnesis: {} });
    api.updateAnamnesis.mockRejectedValue({ response: { data: { message: 'Falhou geral' } } });
    const { onClose } = setup();
    await screen.findByText('Maria');
    const save = screen.getByRole('button', { name: 'Salvar anamnese' });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Falhou geral'));
    expect(screen.getByText('Falhou geral')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
