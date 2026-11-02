import { AnamnesisKind, AnamnesisQuestionType } from '@prisma/client';

export interface DefaultAnamnesisQuestion {
  key: string;
  label: string;
  type: AnamnesisQuestionType;
  options?: string[];
  section?: string;
  placeholder?: string;
  active?: boolean;
  system?: boolean;
}

const { TEXT, BOOLEAN, SINGLE_CHOICE, MULTIPLE_CHOICE, NUMBER } = AnamnesisQuestionType;

/**
 * Perguntas iniciais de cada clínica (criadas na primeira leitura), na ordem do formulário.
 * Deduplicação entre as duas anamneses:
 * - tipoPele e acneAtiva repetiam o assistente de pele (tipo de pele / afecção "Acne ativa"): ficam inativas
 *   na geral, para as respostas antigas continuarem com rótulo;
 * - as demais de "Pele e estética" passam para a anamnese de pele, com a mesma chave;
 * - tendenciaCicatrizacao, herpeRecorrente e usaAnticoagulante são contraindicação de procedimento e ficam na geral.
 */
export const DEFAULT_GENERAL_QUESTIONS: DefaultAnamnesisQuestion[] = [
  { key: 'peso', label: 'Peso', type: NUMBER, section: 'Medidas corporais', placeholder: 'kg', system: true },
  { key: 'altura', label: 'Altura', type: NUMBER, section: 'Medidas corporais', placeholder: 'cm', system: true },
  { key: 'doencasCronicas', label: 'Doenças crônicas', type: TEXT, section: 'Saúde geral', placeholder: 'Ex.: diabetes, hipertensão, tireoide...' },
  { key: 'medicamentosEmUso', label: 'Medicamentos em uso', type: TEXT, section: 'Saúde geral', placeholder: 'Nome e dosagem dos medicamentos' },
  { key: 'alergiasMedicamentos', label: 'Alergias a medicamentos', type: TEXT, section: 'Saúde geral', placeholder: 'Quais medicamentos?' },
  { key: 'alergiasOutras', label: 'Outras alergias', type: TEXT, section: 'Saúde geral', placeholder: 'Ex.: látex, esparadrapo, metais...' },
  { key: 'cirurgiasAnteriores', label: 'Cirurgias anteriores', type: TEXT, section: 'Saúde geral', placeholder: 'Tipo e data aproximada' },
  { key: 'historicoFamiliar', label: 'Histórico familiar relevante', type: TEXT, section: 'Saúde geral', placeholder: 'Doenças relevantes na família' },
  { key: 'tabagismo', label: 'Tabagismo', type: SINGLE_CHOICE, section: 'Saúde geral', options: ['Não', 'Sim', 'Ex-fumante'] },
  { key: 'etilismo', label: 'Consumo de álcool', type: SINGLE_CHOICE, section: 'Saúde geral', options: ['Não', 'Social', 'Frequente'] },
  { key: 'atividadeFisica', label: 'Atividade física', type: SINGLE_CHOICE, section: 'Saúde geral', options: ['Sedentário', 'Ocasional', 'Regular', 'Intenso'] },
  { key: 'tendenciaCicatrizacao', label: 'Tendência de cicatrização', type: SINGLE_CHOICE, section: 'Saúde geral', options: ['Normal', 'Queloide', 'Hipertrófica', 'Atrófica'] },
  { key: 'gestante', label: 'Gestante', type: BOOLEAN, section: 'Saúde geral' },
  { key: 'lactante', label: 'Lactante', type: BOOLEAN, section: 'Saúde geral' },
  { key: 'marcapasso', label: 'Usa marcapasso', type: BOOLEAN, section: 'Saúde geral' },
  { key: 'protesesMetalicas', label: 'Próteses metálicas', type: BOOLEAN, section: 'Saúde geral' },
  { key: 'herpeRecorrente', label: 'Herpes recorrente', type: BOOLEAN, section: 'Saúde geral' },
  { key: 'usaAnticoagulante', label: 'Usa anticoagulante', type: BOOLEAN, section: 'Saúde geral' },
  { key: 'queixaPrincipal', label: 'Queixa principal', type: TEXT, section: 'Queixas e expectativas', placeholder: 'O que mais incomoda o(a) paciente?' },
  { key: 'expectativas', label: 'Expectativas com o tratamento', type: TEXT, section: 'Queixas e expectativas', placeholder: 'O que espera alcançar?' },
  { key: 'observacoesAnamnese', label: 'Observações adicionais', type: TEXT, section: 'Queixas e expectativas', placeholder: 'Qualquer informação relevante...' },
  { key: 'tipoPele', label: 'Tipo de pele', type: SINGLE_CHOICE, section: 'Pele e estética', options: ['Normal', 'Seca', 'Oleosa', 'Mista', 'Sensível'], active: false },
  { key: 'acneAtiva', label: 'Acne ativa', type: BOOLEAN, section: 'Pele e estética', active: false },
];

/** As quatro primeiras alimentam as regras da rotina (skincare.constants.ts): opções fixas no código. */
export const DEFAULT_SKIN_QUESTIONS: DefaultAnamnesisQuestion[] = [
  { key: 'pele', label: 'Qual é o tipo de pele?', type: SINGLE_CHOICE, system: true },
  { key: 'afec', label: 'Está em tratamento de alguma afecção de pele?', type: MULTIPLE_CHOICE, system: true },
  { key: 'olheira', label: 'Tem olheiras?', type: SINGLE_CHOICE, system: true },
  { key: 'idade', label: 'Qual é a faixa etária?', type: SINGLE_CHOICE, system: true },
  { key: 'fototipoPele', label: 'Fototipo (Fitzpatrick)', type: SINGLE_CHOICE, options: ['I - Muito clara', 'II - Clara', 'III - Morena clara', 'IV - Morena', 'V - Morena escura', 'VI - Negra'] },
  { key: 'exposicaoSolar', label: 'Exposição solar', type: SINGLE_CHOICE, options: ['Baixa', 'Moderada', 'Alta'] },
  { key: 'usaProtetorSolar', label: 'Usa protetor solar diariamente', type: BOOLEAN },
  { key: 'usoAcidos', label: 'Uso de ácidos', type: TEXT, placeholder: 'Quais e frequência?' },
  { key: 'alergiaCosmeticos', label: 'Alergia a cosméticos', type: TEXT, placeholder: 'Quais produtos/substâncias?' },
  { key: 'manchasPigmentares', label: 'Manchas ou alterações pigmentares', type: TEXT, placeholder: 'Melasma, vitiligo, hiperpigmentação...' },
  { key: 'tratamentosAnteriores', label: 'Tratamentos estéticos anteriores', type: TEXT, placeholder: 'Ex.: peeling, laser, botox, preenchimento...' },
];

export const DEFAULT_QUESTIONS: Record<AnamnesisKind, DefaultAnamnesisQuestion[]> = {
  GENERAL: DEFAULT_GENERAL_QUESTIONS,
  SKIN: DEFAULT_SKIN_QUESTIONS,
};

/** Validade do link enviado à paciente. */
export const ANAMNESIS_LINK_TTL_DAYS = 7;
