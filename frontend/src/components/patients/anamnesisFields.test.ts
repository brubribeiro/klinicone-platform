import { describe, it, expect } from 'vitest';

import type { AnamnesisQuestion } from '../../types';
import {
  ANAMNESIS_MULTILINE_KEYS,
  anamnesisSections,
  calcIMC,
  createEmptyAnamnesis,
  formatAnswer,
  hasAnamnesisData,
  imcClassificacao,
  mergeAnamnesis,
} from './anamnesisFields';

const q = (key: string, type: AnamnesisQuestion['type'], section: string | null, extra: Partial<AnamnesisQuestion> = {}): AnamnesisQuestion => ({
  id: key,
  kind: 'GENERAL',
  key,
  label: key,
  type,
  options: [],
  section,
  placeholder: null,
  required: false,
  sortOrder: 0,
  active: true,
  system: false,
  ...extra,
});

const QUESTIONS: AnamnesisQuestion[] = [
  q('peso', 'NUMBER', 'Medidas corporais'),
  q('gestante', 'BOOLEAN', 'Saúde geral'),
  q('tabagismo', 'SINGLE_CHOICE', 'Saúde geral', { options: ['Não', 'Sim'] }),
  q('queixaPrincipal', 'TEXT', 'Queixas e expectativas'),
  q('acneAtiva', 'BOOLEAN', 'Pele e estética', { active: false }),
  q('alergias', 'MULTIPLE_CHOICE', null, { options: ['Látex', 'Metais'] }),
];

describe('anamnesisFields', () => {
  describe('anamnesisSections', () => {
    const sections = anamnesisSections(QUESTIONS);

    it('groups active questions by section in the registered order', () => {
      expect(sections.map((s) => s.title)).toEqual(['Medidas corporais', 'Saúde geral', 'Queixas e expectativas', 'Outras perguntas']);
      expect(sections[1].fields.map((f) => f.key)).toEqual(['gestante', 'tabagismo']);
    });

    it('skips inactive questions and maps types', () => {
      const fields = sections.flatMap((s) => s.fields);
      expect(fields.some((f) => f.key === 'acneAtiva')).toBe(false);
      expect(fields.find((f) => f.key === 'alergias')?.type).toBe('multiselect');
      expect(fields.find((f) => f.key === 'peso')?.suffix).toBe('kg');
    });
  });

  describe('ANAMNESIS_MULTILINE_KEYS', () => {
    it('should include complaint and expectation fields', () => {
      expect(ANAMNESIS_MULTILINE_KEYS.has('queixaPrincipal')).toBe(true);
      expect(ANAMNESIS_MULTILINE_KEYS.has('expectativas')).toBe(true);
      expect(ANAMNESIS_MULTILINE_KEYS.has('observacoesAnamnese')).toBe(true);
    });
  });

  describe('createEmptyAnamnesis', () => {
    it('initializes booleans as false, multiple choice as [] and the rest as empty string', () => {
      const empty = createEmptyAnamnesis(anamnesisSections(QUESTIONS));
      expect(empty).toEqual({ peso: '', gestante: false, tabagismo: '', queixaPrincipal: '', alergias: [] });
    });
  });

  describe('mergeAnamnesis', () => {
    it('keeps saved answers of questions that are no longer active', () => {
      const merged = mergeAnamnesis({ gestante: true, acneAtiva: true, tipoPele: 'Oleosa' }, anamnesisSections(QUESTIONS));
      expect(merged.gestante).toBe(true);
      expect(merged.acneAtiva).toBe(true);
      expect(merged.tipoPele).toBe('Oleosa');
      expect(merged.tabagismo).toBe('');
    });

    it('should return empty defaults when existing is null or undefined', () => {
      expect(mergeAnamnesis(null)).toEqual(createEmptyAnamnesis());
      expect(mergeAnamnesis(undefined)).toEqual(createEmptyAnamnesis());
    });
  });

  describe('formatAnswer', () => {
    it('formats booleans, lists and units', () => {
      expect(formatAnswer(undefined, true)).toBe('Sim');
      expect(formatAnswer(undefined, ['Látex', 'Metais'])).toBe('Látex, Metais');
      expect(formatAnswer({ type: 'number', suffix: 'kg' }, 61.5)).toBe('61.5 kg');
    });
  });

  describe('hasAnamnesisData', () => {
    it('should return false for empty, null or all-default values', () => {
      expect(hasAnamnesisData(null)).toBe(false);
      expect(hasAnamnesisData(undefined)).toBe(false);
      expect(hasAnamnesisData({})).toBe(false);
      expect(hasAnamnesisData(createEmptyAnamnesis(anamnesisSections(QUESTIONS)))).toBe(false);
      expect(hasAnamnesisData({ gestante: false, doencasCronicas: '' })).toBe(false);
    });

    it('should return true when any text/select field is filled', () => {
      expect(hasAnamnesisData({ tabagismo: 'Não' })).toBe(true);
      expect(hasAnamnesisData({ queixaPrincipal: 'Acne ativa' })).toBe(true);
    });

    it('should return true when any boolean field is true', () => {
      expect(hasAnamnesisData({ gestante: true })).toBe(true);
      expect(hasAnamnesisData({ usaAnticoagulante: true })).toBe(true);
    });
  });

  describe('calcIMC', () => {
    it('should calculate BMI correctly (peso in kg, altura in cm)', () => {
      // 70kg, 175cm → 70 / (1.75²) = 22.9
      expect(calcIMC(70, 175)).toBe(22.9);
    });

    it('should accept decimal comma and height in meters (imported records)', () => {
      expect(calcIMC('71', '1,73')).toBe(23.7);
      expect(calcIMC('70,5', 175)).toBe(23);
    });

    it('should return null for missing or invalid values', () => {
      expect(calcIMC(undefined, 175)).toBeNull();
      expect(calcIMC(70, undefined)).toBeNull();
      expect(calcIMC('', '')).toBeNull();
      expect(calcIMC(0, 175)).toBeNull();
    });

    it('should parse string values', () => {
      expect(calcIMC('70', '175')).toBe(22.9);
    });
  });

  describe('imcClassificacao', () => {
    it('should classify BMI ranges correctly', () => {
      expect(imcClassificacao(17)).toBe('Abaixo do peso');
      expect(imcClassificacao(22)).toBe('Peso normal');
      expect(imcClassificacao(27)).toBe('Sobrepeso');
      expect(imcClassificacao(32)).toBe('Obesidade grau I');
      expect(imcClassificacao(37)).toBe('Obesidade grau II');
      expect(imcClassificacao(42)).toBe('Obesidade grau III');
    });
  });
});
