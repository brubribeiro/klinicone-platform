import { describe, it, expect } from 'vitest';

import {
  ANAMNESIS_MULTILINE_KEYS,
  ANAMNESIS_SECTIONS,
  calcIMC,
  createEmptyAnamnesis,
  hasAnamnesisData,
  imcClassificacao,
  mergeAnamnesis,
} from './anamnesisFields';

describe('anamnesisFields', () => {
  describe('ANAMNESIS_SECTIONS', () => {
    it('should define all expected sections', () => {
      expect(ANAMNESIS_SECTIONS.map((section) => section.title)).toEqual([
        'Medidas corporais',
        'Saúde geral',
        'Pele e estética',
        'Queixas e expectativas',
      ]);
    });

    it('should use unique field keys across sections', () => {
      const keys = ANAMNESIS_SECTIONS.flatMap((section) => section.fields.map((field) => field.key));
      expect(new Set(keys).size).toBe(keys.length);
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
    it('should initialize booleans as false and text/select as empty string', () => {
      const empty = createEmptyAnamnesis();

      expect(empty.gestante).toBe(false);
      expect(empty.acneAtiva).toBe(false);
      expect(empty.doencasCronicas).toBe('');
      expect(empty.tabagismo).toBe('');
      expect(empty.queixaPrincipal).toBe('');
    });

    it('should include every field defined in sections', () => {
      const empty = createEmptyAnamnesis();
      const expectedKeys = ANAMNESIS_SECTIONS.flatMap((section) =>
        section.fields.map((field) => field.key),
      );

      expect(Object.keys(empty).sort()).toEqual(expectedKeys.sort());
    });
  });

  describe('mergeAnamnesis', () => {
    it('should merge existing values over defaults', () => {
      const merged = mergeAnamnesis({
        gestante: true,
        queixaPrincipal: 'Manchas na face',
        tabagismo: 'Não',
      });

      expect(merged.gestante).toBe(true);
      expect(merged.queixaPrincipal).toBe('Manchas na face');
      expect(merged.tabagismo).toBe('Não');
      expect(merged.lactante).toBe(false);
      expect(merged.medicamentosEmUso).toBe('');
    });

    it('should return empty defaults when existing is null or undefined', () => {
      expect(mergeAnamnesis(null)).toEqual(createEmptyAnamnesis());
      expect(mergeAnamnesis(undefined)).toEqual(createEmptyAnamnesis());
    });
  });

  describe('hasAnamnesisData', () => {
    it('should return false for empty, null or all-default values', () => {
      expect(hasAnamnesisData(null)).toBe(false);
      expect(hasAnamnesisData(undefined)).toBe(false);
      expect(hasAnamnesisData({})).toBe(false);
      expect(hasAnamnesisData(createEmptyAnamnesis())).toBe(false);
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
