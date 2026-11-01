export interface AnamnesisFieldDef {
  key: string;
  label: string;
  type: 'boolean' | 'text' | 'select' | 'number';
  options?: string[];
  placeholder?: string;
  fullWidth?: boolean;
  suffix?: string;
  step?: number;
}

export interface AnamnesisSection {
  title: string;
  fields: AnamnesisFieldDef[];
}

export const ANAMNESIS_SECTIONS: AnamnesisSection[] = [
  {
    title: 'Medidas corporais',
    fields: [
      { key: 'peso', label: 'Peso', type: 'number', placeholder: 'kg', suffix: 'kg', step: 0.1 },
      { key: 'altura', label: 'Altura', type: 'number', placeholder: 'cm', suffix: 'cm', step: 1 },
    ],
  },
  {
    title: 'Saúde geral',
    fields: [
      { key: 'doencasCronicas', label: 'Doenças crônicas', type: 'text', placeholder: 'Ex.: diabetes, hipertensão, tireoide...' },
      { key: 'medicamentosEmUso', label: 'Medicamentos em uso', type: 'text', placeholder: 'Nome e dosagem dos medicamentos' },
      { key: 'alergiasMedicamentos', label: 'Alergias a medicamentos', type: 'text', placeholder: 'Quais medicamentos?' },
      { key: 'alergiasOutras', label: 'Outras alergias', type: 'text', placeholder: 'Ex.: látex, esparadrapo, metais...' },
      { key: 'cirurgiasAnteriores', label: 'Cirurgias anteriores', type: 'text', placeholder: 'Tipo e data aproximada' },
      { key: 'historicoFamiliar', label: 'Histórico familiar relevante', type: 'text', placeholder: 'Doenças relevantes na família' },
      { key: 'tabagismo', label: 'Tabagismo', type: 'select', options: ['Não', 'Sim', 'Ex-fumante'] },
      { key: 'etilismo', label: 'Consumo de álcool', type: 'select', options: ['Não', 'Social', 'Frequente'] },
      { key: 'atividadeFisica', label: 'Atividade física', type: 'select', options: ['Sedentário', 'Ocasional', 'Regular', 'Intenso'] },
      { key: 'gestante', label: 'Gestante', type: 'boolean' },
      { key: 'lactante', label: 'Lactante', type: 'boolean' },
      { key: 'marcapasso', label: 'Usa marcapasso', type: 'boolean' },
      { key: 'protesesMetalicas', label: 'Próteses metálicas', type: 'boolean' },
    ],
  },
  {
    title: 'Pele e estética',
    fields: [
      { key: 'tipoPele', label: 'Tipo de pele', type: 'select', options: ['Normal', 'Seca', 'Oleosa', 'Mista', 'Sensível'] },
      { key: 'fototipoPele', label: 'Fototipo (Fitzpatrick)', type: 'select', options: ['I - Muito clara', 'II - Clara', 'III - Morena clara', 'IV - Morena', 'V - Morena escura', 'VI - Negra'] },
      { key: 'alergiaCosmeticos', label: 'Alergia a cosméticos', type: 'text', placeholder: 'Quais produtos/substâncias?' },
      { key: 'tratamentosAnteriores', label: 'Tratamentos estéticos anteriores', type: 'text', placeholder: 'Ex.: peeling, laser, botox, preenchimento...' },
      { key: 'usoAcidos', label: 'Uso de ácidos', type: 'text', placeholder: 'Quais e frequência?' },
      { key: 'exposicaoSolar', label: 'Exposição solar', type: 'select', options: ['Baixa', 'Moderada', 'Alta'] },
      { key: 'usaProtetorSolar', label: 'Usa protetor solar diariamente', type: 'boolean' },
      { key: 'tendenciaCicatrizacao', label: 'Tendência de cicatrização', type: 'select', options: ['Normal', 'Queloide', 'Hipertrófica', 'Atrófica'] },
      { key: 'manchasPigmentares', label: 'Manchas ou alterações pigmentares', type: 'text', placeholder: 'Melasma, vitiligo, hiperpigmentação...' },
      { key: 'acneAtiva', label: 'Acne ativa', type: 'boolean' },
      { key: 'herpeRecorrente', label: 'Herpes recorrente', type: 'boolean' },
      { key: 'usaAnticoagulante', label: 'Usa anticoagulante', type: 'boolean' },
    ],
  },
  {
    title: 'Queixas e expectativas',
    fields: [
      { key: 'queixaPrincipal', label: 'Queixa principal', type: 'text', placeholder: 'O que mais incomoda o(a) paciente?', fullWidth: true },
      { key: 'expectativas', label: 'Expectativas com o tratamento', type: 'text', placeholder: 'O que espera alcançar?', fullWidth: true },
      { key: 'observacoesAnamnese', label: 'Observações adicionais', type: 'text', placeholder: 'Qualquer informação relevante...', fullWidth: true },
    ],
  },
];

export const ANAMNESIS_MULTILINE_KEYS = new Set(['queixaPrincipal', 'expectativas', 'observacoesAnamnese']);

export function createEmptyAnamnesis(): Record<string, string | boolean | number> {
  const values: Record<string, string | boolean | number> = {};
  for (const section of ANAMNESIS_SECTIONS) {
    for (const field of section.fields) {
      if (field.type === 'boolean') values[field.key] = false;
      else if (field.type === 'number') values[field.key] = '';
      else values[field.key] = '';
    }
  }
  return values;
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

export function mergeAnamnesis(existing?: Record<string, unknown> | null): Record<string, string | boolean | number> {
  return { ...createEmptyAnamnesis(), ...(existing ?? {}) } as Record<string, string | boolean | number>;
}

export function hasAnamnesisData(anamnesis?: Record<string, unknown> | null): boolean {
  if (!anamnesis || Object.keys(anamnesis).length === 0) return false;
  return Object.values(anamnesis).some((value) => value !== '' && value !== false && value != null);
}
