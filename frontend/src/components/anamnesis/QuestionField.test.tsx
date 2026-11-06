import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { AnamnesisAnswerValue } from '../../types';
import { answerText, isBlankAnswer, missingRequired, QuestionField, type QuestionLike } from './QuestionField';

const q = (o: Partial<QuestionLike>): QuestionLike => ({
  key: 'k',
  label: 'Pergunta?',
  type: 'TEXT',
  options: [],
  placeholder: null,
  required: false,
  ...o,
});

describe('isBlankAnswer / missingRequired / answerText', () => {
  it('detecta respostas em branco, mas "Não" (false) e 0 contam como resposta', () => {
    expect(isBlankAnswer(undefined)).toBe(true);
    expect(isBlankAnswer(null)).toBe(true);
    expect(isBlankAnswer('  ')).toBe(true);
    expect(isBlankAnswer([])).toBe(true);
    expect(isBlankAnswer(false)).toBe(false);
    expect(isBlankAnswer(0)).toBe(false);
    expect(isBlankAnswer('x')).toBe(false);
    expect(isBlankAnswer(['a'])).toBe(false);
  });

  it('missingRequired só devolve obrigatórias sem resposta', () => {
    const qs = [q({ key: 'a', required: true }), q({ key: 'b', required: true }), q({ key: 'c' }), q({ key: 'd', required: true, type: 'BOOLEAN' })];
    expect(missingRequired(qs, { a: 'ok', d: false }).map((x) => x.key)).toEqual(['b']);
  });

  it('answerText formata para revisão', () => {
    expect(answerText(undefined)).toBe('—');
    expect(answerText(true)).toBe('Sim');
    expect(answerText(false)).toBe('Não');
    expect(answerText(['a', 'b'])).toBe('a, b');
    expect(answerText(42)).toBe('42');
  });
});

function Harness({ question, initial, error, spy }: { question: QuestionLike; initial?: AnamnesisAnswerValue; error?: boolean; spy?: (v: AnamnesisAnswerValue) => void }) {
  const [v, setV] = useState<AnamnesisAnswerValue | undefined>(initial);
  return <QuestionField question={question} value={v} error={error} onChange={(x) => { spy?.(x); setV(x); }} />;
}

describe('QuestionField', () => {
  it('BOOLEAN: escolhe Sim ou Não', async () => {
    const spy = vi.fn();
    render(<Harness question={q({ type: 'BOOLEAN', required: true })} spy={spy} />);
    expect(screen.getByText('Pergunta?')).toHaveTextContent('Pergunta? *');
    await userEvent.click(screen.getByRole('radio', { name: 'Não' }));
    expect(spy).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole('radio', { name: 'Não' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'Sim' }));
    expect(spy).toHaveBeenLastCalledWith(true);
  });

  it('SINGLE_CHOICE: seleciona e desmarca ao clicar de novo', async () => {
    const spy = vi.fn();
    render(<Harness question={q({ type: 'SINGLE_CHOICE', options: ['A', 'B'] })} spy={spy} />);
    await userEvent.click(screen.getByRole('radio', { name: 'A' }));
    expect(spy).toHaveBeenLastCalledWith('A');
    await userEvent.click(screen.getByRole('radio', { name: 'A' }));
    expect(spy).toHaveBeenLastCalledWith('');
    await userEvent.click(screen.getByRole('radio', { name: 'B' }));
    expect(spy).toHaveBeenLastCalledWith('B');
  });

  it('MULTIPLE_CHOICE: acumula e remove opções (teclado inclusive)', async () => {
    const spy = vi.fn();
    render(<Harness question={q({ type: 'MULTIPLE_CHOICE', options: ['A', 'B', 'C'] })} spy={spy} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'A' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'C' }));
    expect(spy).toHaveBeenLastCalledWith(['A', 'C']);
    screen.getByRole('checkbox', { name: 'A' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(spy).toHaveBeenLastCalledWith(['C']);
    await userEvent.keyboard(' ');
    expect(spy).toHaveBeenLastCalledWith(['C', 'A']);
  });

  it('NUMBER: só aceita dígitos, vírgula e ponto', async () => {
    const spy = vi.fn();
    render(<Harness question={q({ type: 'NUMBER', placeholder: 'kg' })} spy={spy} />);
    await userEvent.type(screen.getByPlaceholderText('kg'), '7a2,5');
    expect(spy).toHaveBeenLastCalledWith('72,5');
  });

  it('TEXT: texto livre multilinha', async () => {
    const spy = vi.fn();
    render(<Harness question={q({ placeholder: 'Conte' })} spy={spy} />);
    await userEvent.type(screen.getByPlaceholderText('Conte'), 'oi');
    expect(spy).toHaveBeenLastCalledWith('oi');
  });

  it('mostra erro de obrigatoriedade só quando solicitado', () => {
    const { rerender } = render(<QuestionField question={q({ required: true })} value="" onChange={() => {}} />);
    expect(screen.queryByText('Resposta obrigatória')).not.toBeInTheDocument();
    rerender(<QuestionField question={q({ required: true })} value="" onChange={() => {}} error />);
    expect(screen.getByText('Resposta obrigatória')).toBeInTheDocument();
  });
});
