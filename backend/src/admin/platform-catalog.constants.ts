/** Kinds do catálogo global da plataforma (sem override por clínica). */
export const PLATFORM_CATALOG_KINDS = [
  'document_category',
  'message_category',
  'message_trigger',
  'procedure_category',
  'inventory_unit',
  'skincare_tag',
] as const;

export type PlatformCatalogKind = (typeof PLATFORM_CATALOG_KINDS)[number];

export const PLATFORM_CATALOG_KIND_LABELS: Record<PlatformCatalogKind, string> = {
  document_category: 'Categorias de documento',
  message_category: 'Categorias de mensagem',
  message_trigger: 'Gatilhos de mensagem',
  procedure_category: 'Categorias de procedimento',
  inventory_unit: 'Unidades de estoque',
  skincare_tag: 'Características de skincare',
};

/** Valores iniciais = hardcodes que o front usava (seed idempotente; não sobrescreve edição). */
export const DEFAULT_PLATFORM_CATALOG: {
  kind: PlatformCatalogKind;
  value: string;
  label: string;
  sortOrder: number;
  meta?: Record<string, unknown>;
}[] = [
  // document_category
  { kind: 'document_category', value: 'consentimento', label: 'Termo de consentimento', sortOrder: 0, meta: { color: '#C27C6B' } },
  { kind: 'document_category', value: 'anamnese', label: 'Ficha de anamnese', sortOrder: 1, meta: { color: '#5BA8DE' } },
  { kind: 'document_category', value: 'receita', label: 'Receita', sortOrder: 2, meta: { color: '#4FA37A' } },
  { kind: 'document_category', value: 'contrato', label: 'Contrato', sortOrder: 3, meta: { color: '#5C6BC0' } },
  { kind: 'document_category', value: 'autorizacao_imagem', label: 'Autorização de imagem', sortOrder: 4, meta: { color: '#9B7BD4' } },
  { kind: 'document_category', value: 'orcamento', label: 'Orçamento', sortOrder: 5, meta: { color: '#E0915B' } },
  { kind: 'document_category', value: 'evolucao', label: 'Evolução clínica', sortOrder: 6, meta: { color: '#D46B8A' } },
  { kind: 'document_category', value: 'vigilancia', label: 'Vigilância sanitária', sortOrder: 7, meta: { color: '#00897B' } },
  { kind: 'document_category', value: 'certificado', label: 'Certificado', sortOrder: 8, meta: { color: '#7B1FA2' } },
  { kind: 'document_category', value: 'recibo', label: 'Recibo', sortOrder: 9, meta: { color: '#F57C00' } },
  { kind: 'document_category', value: 'livre', label: 'Outro', sortOrder: 10, meta: { color: '#78909C' } },

  // message_category (+ defaultTrigger espelha triggerForCategory do front)
  { kind: 'message_category', value: 'confirmacao', label: 'Confirmação', sortOrder: 0, meta: { defaultTrigger: 'ON_BOOKING' } },
  { kind: 'message_category', value: 'lembrete', label: 'Lembrete', sortOrder: 1, meta: { defaultTrigger: 'DAY_BEFORE' } },
  { kind: 'message_category', value: 'retorno', label: 'Retorno', sortOrder: 2, meta: { defaultTrigger: 'AFTER_APPOINTMENT' } },
  { kind: 'message_category', value: 'aniversario', label: 'Aniversário', sortOrder: 3, meta: { defaultTrigger: 'BIRTHDAY' } },
  { kind: 'message_category', value: 'promocao', label: 'Promoção', sortOrder: 4 },
  { kind: 'message_category', value: 'livre', label: 'Livre', sortOrder: 5 },

  // message_trigger (valores = enum MessageTrigger)
  { kind: 'message_trigger', value: 'ON_BOOKING', label: 'Ao agendar', sortOrder: 0 },
  { kind: 'message_trigger', value: 'DAY_BEFORE', label: '1 dia antes', sortOrder: 1 },
  { kind: 'message_trigger', value: 'BIRTHDAY', label: 'No dia do aniversário', sortOrder: 2 },
  { kind: 'message_trigger', value: 'AFTER_APPOINTMENT', label: 'Após o atendimento', sortOrder: 3 },
  { kind: 'message_trigger', value: 'INACTIVE_90_DAYS', label: '90 dias sem visita', sortOrder: 4 },
  { kind: 'message_trigger', value: 'MANUAL', label: 'Envio manual', sortOrder: 5 },

  // procedure_category (value = texto livre em Procedure.category)
  { kind: 'procedure_category', value: 'Facial', label: 'Facial', sortOrder: 0 },
  { kind: 'procedure_category', value: 'Injetáveis', label: 'Injetáveis', sortOrder: 1 },
  { kind: 'procedure_category', value: 'Laser', label: 'Laser', sortOrder: 2 },
  { kind: 'procedure_category', value: 'Corporal', label: 'Corporal', sortOrder: 3 },
  { kind: 'procedure_category', value: 'Peeling', label: 'Peeling', sortOrder: 4 },
  { kind: 'procedure_category', value: 'Depilação', label: 'Depilação', sortOrder: 5 },
  { kind: 'procedure_category', value: 'Capilar', label: 'Capilar', sortOrder: 6 },

  // inventory_unit
  { kind: 'inventory_unit', value: 'un', label: 'Unidade (un)', sortOrder: 0 },
  { kind: 'inventory_unit', value: 'ml', label: 'Mililitro (ml)', sortOrder: 1 },
  { kind: 'inventory_unit', value: 'L', label: 'Litro (L)', sortOrder: 2 },
  { kind: 'inventory_unit', value: 'g', label: 'Grama (g)', sortOrder: 3 },
  { kind: 'inventory_unit', value: 'kg', label: 'Quilograma (kg)', sortOrder: 4 },
  { kind: 'inventory_unit', value: 'par', label: 'Par', sortOrder: 5 },
  { kind: 'inventory_unit', value: 'cx', label: 'Caixa (cx)', sortOrder: 6 },
  { kind: 'inventory_unit', value: 'pct', label: 'Pacote (pct)', sortOrder: 7 },
  { kind: 'inventory_unit', value: 'fr', label: 'Frasco (fr)', sortOrder: 8 },
  { kind: 'inventory_unit', value: 'tb', label: 'Tubo (tb)', sortOrder: 9 },
  { kind: 'inventory_unit', value: 'amp', label: 'Ampola (amp)', sortOrder: 10 },

  // skincare_tag (rotinas / produtos — value persistido em SkincareProduct.tags e SkincareRule.avoidTags)
  { kind: 'skincare_tag', value: 'acido', label: 'Ácidos (baixa concentração)', sortOrder: 0 },
  { kind: 'skincare_tag', value: 'acido-alto', label: 'Ácidos em alta concentração', sortOrder: 1 },
  { kind: 'skincare_tag', value: 'retinoide', label: 'Retinoides', sortOrder: 2 },
  { kind: 'skincare_tag', value: 'fragrancia', label: 'Fragrância', sortOrder: 3 },
  { kind: 'skincare_tag', value: 'oleo', label: 'Óleos comedogênicos', sortOrder: 4 },
];
