import type { AnamnesisQuestion } from '../../types';

export interface AnamnesisFieldDef {
  key: string;
  label: string;
  type: 'boolean' | 'text' | 'select' | 'multiselect' | 'number';
  options?: string[];
  placeholder?: string;
  fullWidth?: boolean;
  suffix?: string;
  step?: number;
  required?: boolean;
}

export interface AnamnesisSection {
  title: string;
  fields: AnamnesisFieldDef[];
}

export const MEASUREMENTS_SECTION = 'Medidas corporais';
const OTHER_SECTION = 'Outras perguntas';

export const ANAMNESIS_MULTILINE_KEYS = new Set(['queixaPrincipal', 'expectativas', 'observacoesAnamnese']);

/** Peso e altura têm unidade fixa (o histórico de medidas lê esses valores). */
const NUMBER_UNITS: Record<string, { suffix: string; step: number }> = {
  peso: { suffix: 'kg', step: 0.1 },
  altura: { suffix: 'cm', step: 1 },
};

const FIELD_TYPES: Record<AnamnesisQuestion['type'], AnamnesisFieldDef['type']> = {
  TEXT: 'text',
  BOOLEAN: 'boolean',
  SINGLE_CHOICE: 'select',
  MULTIPLE_CHOICE: 'multiselect',
  NUMBER: 'number',
};

export function questionToField(q: Pick<AnamnesisQuestion, 'key' | 'label' | 'type' | 'options' | 'placeholder' | 'required'>): AnamnesisFieldDef {
  return {
    key: q.key,
    label: q.label,
    type: FIELD_TYPES[q.type],
    options: q.options,
    placeholder: q.placeholder ?? undefined,
    fullWidth: ANAMNESIS_MULTILINE_KEYS.has(q.key),
    required: q.required,
    ...NUMBER_UNITS[q.key],
  };
}

/** Agrupa as perguntas ativas por seção, na ordem cadastrada (a seção aparece na posição da 1ª pergunta dela). */
export function anamnesisSections(
  questions: Pick<AnamnesisQuestion, 'key' | 'label' | 'type' | 'options' | 'placeholder' | 'required' | 'section'>[],
): AnamnesisSection[] {
  const sections: AnamnesisSection[] = [];
  for (const q of questions) {
    if ('active' in q && !q.active) continue;
    const title = q.section?.trim() || OTHER_SECTION;
    let section = sections.find((s) => s.title === title);
    if (!section) {
      section = { title, fields: [] };
      sections.push(section);
    }
    section.fields.push(questionToField(q));
  }
  return sections;
}

export function createEmptyAnamnesis(sections: AnamnesisSection[] = []): Record<string, AnamnesisFormValue> {
  const values: Record<string, AnamnesisFormValue> = {};
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.type === 'boolean') values[field.key] = false;
      else if (field.type === 'multiselect') values[field.key] = [];
      else values[field.key] = '';
    }
  }
  return values;
}

export type AnamnesisFormValue = string | boolean | number | string[];

/** Texto de uma resposta salva, para leitura. */
export function formatAnswer(field: Pick<AnamnesisFieldDef, 'type' | 'suffix'> | undefined, value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (Array.isArray(value)) return value.join(', ');
  if (field?.type === 'number' && field.suffix) return `${value} ${field.suffix}`;
  return String(value);
}

const toNumber = (value: unknown) =>
  typeof value === 'number' ? value : parseFloat(String(value ?? '').replace(',', '.'));

export function calcIMC(peso?: unknown, altura?: unknown): number | null {
  const p = toNumber(peso);
  const a = toNumber(altura);
  if (!p || !a || p <= 0 || a <= 0) return null;
  // Fichas importadas trazem altura em metros ("1,73"); o formulário usa centímetros
  const alturaM = a < 3 ? a : a / 100;
  return Math.round((p / (alturaM * alturaM)) * 10) / 10;
}

export function imcClassificacao(imc: number): string {
  if (imc < 18.5) return 'Abaixo do peso';
  if (imc < 25) return 'Peso normal';
  if (imc < 30) return 'Sobrepeso';
  if (imc < 35) return 'Obesidade grau I';
  if (imc < 40) return 'Obesidade grau II';
  return 'Obesidade grau III';
}

export function imcColor(imc: number): string {
  if (imc < 18.5) return '#1976d2';
  if (imc < 25) return '#2e7d32';
  if (imc < 30) return '#ed6c02';
  if (imc < 35) return '#d32f2f';
  if (imc < 40) return '#c62828';
  return '#b71c1c';
}

export function mergeAnamnesis(
  existing: Record<string, unknown> | null | undefined,
  sections: AnamnesisSection[] = [],
): Record<string, AnamnesisFormValue> {
  return { ...createEmptyAnamnesis(sections), ...(existing ?? {}) } as Record<string, AnamnesisFormValue>;
}

export function hasAnamnesisData(anamnesis?: Record<string, unknown> | null): boolean {
  if (!anamnesis || Object.keys(anamnesis).length === 0) return false;
  return Object.values(anamnesis).some(hasAnswer);
}

export function hasAnswer(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return value !== '' && value !== false && value != null;
}
