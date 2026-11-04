import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { AnamnesisView } from './AnamnesisView';

const questions = vi.hoisted(() => ({ GENERAL: [] as unknown[], SKIN: [] as unknown[] }));
vi.mock('../../hooks/useAnamnesisQuestions', () => ({
  useAnamnesisQuestions: (kind: 'GENERAL' | 'SKIN') => ({ data: questions[kind] }),
}));

const q = (o: object) => ({ type: 'TEXT', options: [], placeholder: null, required: false, active: true, ...o });

describe('AnamnesisView', () => {
  it('mostra vazio quando não há respostas', () => {
    questions.GENERAL = [];
    render(<AnamnesisView anamnesis={null} />);
    expect(screen.getByText('Nenhuma anamnese registrada.')).toBeInTheDocument();
    render(<AnamnesisView anamnesis={{ peso: '', alergia: false }} />);
    expect(screen.getAllByText('Nenhuma anamnese registrada.')).toHaveLength(2);
  });

  it('agrupa por seção, formata respostas, IMC e campos booleanos', () => {
    questions.GENERAL = [
      q({ key: 'peso', label: 'Peso', type: 'NUMBER', section: 'Medidas corporais' }),
      q({ key: 'altura', label: 'Altura', type: 'NUMBER', section: 'Medidas corporais' }),
      q({ key: 'queixaPrincipal', label: 'Queixa principal', section: 'Queixas' }),
      q({ key: 'tratamentos', label: 'Tratamentos', type: 'MULTIPLE_CHOICE', section: 'Queixas', options: ['A', 'B'] }),
      q({ key: 'gestante', label: 'Gestante', type: 'BOOLEAN', section: 'Saúde' }),
      q({ key: 'herpes', label: 'Herpes', type: 'BOOLEAN', section: 'Saúde' }),
    ];
    render(
      <AnamnesisView
        anamnesis={{ peso: '70', altura: '175', queixaPrincipal: 'Manchas', tratamentos: ['A', 'B'], gestante: true, herpes: false }}
      />,
    );
    expect(screen.getByText('70 kg')).toBeInTheDocument();
    expect(screen.getByText('175 cm')).toBeInTheDocument();
    expect(screen.getByText(/22,9|22\.9/)).toBeInTheDocument();
    expect(screen.getByText('Manchas')).toBeInTheDocument();
    expect(screen.getByText('A, B')).toBeInTheDocument();
    expect(screen.getByText('Sim')).toBeInTheDocument();
    expect(screen.getByText('Não')).toBeInTheDocument();
  });

  it('mostra traço para pergunta sem resposta e respostas anteriores de perguntas fora da geral', () => {
    questions.GENERAL = [
      q({ key: 'queixaPrincipal', label: 'Queixa principal', section: 'Queixas' }),
      q({ key: 'antiga', label: 'Pergunta antiga', active: false, section: 'Queixas' }),
    ];
    questions.SKIN = [q({ key: 'fototipo', label: 'Fototipo', section: 'Pele' })];
    render(<AnamnesisView anamnesis={{ fototipo: 'III', antiga: 'resposta velha', solta: 'x', ola: '' }} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Respostas anteriores')).toBeInTheDocument();
    expect(screen.getByText('Fototipo')).toBeInTheDocument();
    expect(screen.getByText('III')).toBeInTheDocument();
    expect(screen.getByText('Pergunta antiga')).toBeInTheDocument();
    expect(screen.getByText('resposta velha')).toBeInTheDocument();
    expect(screen.queryByText('x')).not.toBeInTheDocument();
  });
});
