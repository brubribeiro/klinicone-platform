import { BadRequestException } from '@nestjs/common';
import { AnamnesisQuestion, AnamnesisQuestionType } from '@prisma/client';

import { normalizeAnswers, questionKeyFromLabel } from './anamnesis.service';

const q = (key: string, type: AnamnesisQuestionType, extra: Partial<AnamnesisQuestion> = {}) =>
  ({ key, label: key, type, options: [], required: false, ...extra }) as AnamnesisQuestion;

describe('anamnesis answers', () => {
  const questions = [
    q('fuma', AnamnesisQuestionType.SINGLE_CHOICE, { options: ['Não', 'Sim'], required: true }),
    q('alergias', AnamnesisQuestionType.MULTIPLE_CHOICE, { options: ['Látex', 'Metais'] }),
    q('gestante', AnamnesisQuestionType.BOOLEAN),
    q('peso', AnamnesisQuestionType.NUMBER),
    q('queixa', AnamnesisQuestionType.TEXT),
  ];

  it('converte tipos, ignora chaves desconhecidas e respostas em branco', () => {
    expect(
      normalizeAnswers(questions, { fuma: 'Não', alergias: ['Látex'], gestante: false, peso: '61,5', queixa: '  manchas ', hack: 'x' }),
    ).toEqual({ fuma: 'Não', alergias: ['Látex'], gestante: false, peso: 61.5, queixa: 'manchas' });
    expect(normalizeAnswers(questions, { fuma: 'Sim', queixa: '   ', alergias: [] })).toEqual({ fuma: 'Sim' });
  });

  it('recusa obrigatória em branco e opção fora da lista', () => {
    expect(() => normalizeAnswers(questions, {})).toThrow(BadRequestException);
    expect(() => normalizeAnswers(questions, { fuma: 'Talvez' })).toThrow('Opção inválida');
    expect(() => normalizeAnswers(questions, { fuma: 'Não', alergias: ['Pólen'] })).toThrow('Opção inválida');
  });

  it('gera a chave a partir do texto da pergunta', () => {
    expect(questionKeyFromLabel('Usa lentes de contato?')).toBe('usaLentesDeContato');
    expect(questionKeyFromLabel('Já fez preenchimento labial')).toBe('jaFezPreenchimentoLabial');
    expect(questionKeyFromLabel('???')).toBe('pergunta');
  });
});
