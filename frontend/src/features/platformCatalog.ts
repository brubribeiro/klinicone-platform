import type { MessageTrigger, PlatformCatalogKind, PlatformCatalogOption } from '../types';

export const PLATFORM_CATALOG_KINDS: PlatformCatalogKind[] = [
  'document_category',
  'message_category',
  'message_trigger',
  'procedure_category',
  'inventory_unit',
  'skincare_tag',
];

export const PLATFORM_CATALOG_KIND_LABELS: Record<PlatformCatalogKind, string> = {
  document_category: 'Categorias de documento',
  message_category: 'Categorias de mensagem',
  message_trigger: 'Gatilhos de mensagem',
  procedure_category: 'Categorias de procedimento',
  inventory_unit: 'Unidades de estoque',
  skincare_tag: 'Características de skincare',
};

/** Fallbacks = valores que o front usava hardcoded (enquanto a API carrega / se falhar). */
export const FALLBACK_DOCUMENT_CATEGORIES: PlatformCatalogOption[] = [
  { id: 'fb-doc-consentimento', kind: 'document_category', value: 'consentimento', label: 'Termo de consentimento', sortOrder: 0, meta: { color: '#C27C6B' } },
  { id: 'fb-doc-anamnese', kind: 'document_category', value: 'anamnese', label: 'Ficha de anamnese', sortOrder: 1, meta: { color: '#5BA8DE' } },
  { id: 'fb-doc-receita', kind: 'document_category', value: 'receita', label: 'Receita', sortOrder: 2, meta: { color: '#4FA37A' } },
  { id: 'fb-doc-contrato', kind: 'document_category', value: 'contrato', label: 'Contrato', sortOrder: 3, meta: { color: '#5C6BC0' } },
  { id: 'fb-doc-autorizacao_imagem', kind: 'document_category', value: 'autorizacao_imagem', label: 'Autorização de imagem', sortOrder: 4, meta: { color: '#9B7BD4' } },
  { id: 'fb-doc-orcamento', kind: 'document_category', value: 'orcamento', label: 'Orçamento', sortOrder: 5, meta: { color: '#E0915B' } },
  { id: 'fb-doc-evolucao', kind: 'document_category', value: 'evolucao', label: 'Evolução clínica', sortOrder: 6, meta: { color: '#D46B8A' } },
  { id: 'fb-doc-vigilancia', kind: 'document_category', value: 'vigilancia', label: 'Vigilância sanitária', sortOrder: 7, meta: { color: '#00897B' } },
  { id: 'fb-doc-certificado', kind: 'document_category', value: 'certificado', label: 'Certificado', sortOrder: 8, meta: { color: '#7B1FA2' } },
  { id: 'fb-doc-recibo', kind: 'document_category', value: 'recibo', label: 'Recibo', sortOrder: 9, meta: { color: '#F57C00' } },
  { id: 'fb-doc-livre', kind: 'document_category', value: 'livre', label: 'Outro', sortOrder: 10, meta: { color: '#78909C' } },
];

export const FALLBACK_MESSAGE_CATEGORIES: PlatformCatalogOption[] = [
  { id: 'fb-msg-confirmacao', kind: 'message_category', value: 'confirmacao', label: 'Confirmação', sortOrder: 0, meta: { defaultTrigger: 'ON_BOOKING' } },
  { id: 'fb-msg-lembrete', kind: 'message_category', value: 'lembrete', label: 'Lembrete', sortOrder: 1, meta: { defaultTrigger: 'DAY_BEFORE' } },
  { id: 'fb-msg-retorno', kind: 'message_category', value: 'retorno', label: 'Retorno', sortOrder: 2, meta: { defaultTrigger: 'AFTER_APPOINTMENT' } },
  { id: 'fb-msg-aniversario', kind: 'message_category', value: 'aniversario', label: 'Aniversário', sortOrder: 3, meta: { defaultTrigger: 'BIRTHDAY' } },
  { id: 'fb-msg-promocao', kind: 'message_category', value: 'promocao', label: 'Promoção', sortOrder: 4, meta: null },
  { id: 'fb-msg-livre', kind: 'message_category', value: 'livre', label: 'Livre', sortOrder: 5, meta: null },
];

export const FALLBACK_MESSAGE_TRIGGERS: PlatformCatalogOption[] = [
  { id: 'fb-trg-ON_BOOKING', kind: 'message_trigger', value: 'ON_BOOKING', label: 'Ao agendar', sortOrder: 0, meta: null },
  { id: 'fb-trg-DAY_BEFORE', kind: 'message_trigger', value: 'DAY_BEFORE', label: '1 dia antes', sortOrder: 1, meta: null },
  { id: 'fb-trg-BIRTHDAY', kind: 'message_trigger', value: 'BIRTHDAY', label: 'No dia do aniversário', sortOrder: 2, meta: null },
  { id: 'fb-trg-AFTER_APPOINTMENT', kind: 'message_trigger', value: 'AFTER_APPOINTMENT', label: 'Após o atendimento', sortOrder: 3, meta: null },
  { id: 'fb-trg-INACTIVE_90_DAYS', kind: 'message_trigger', value: 'INACTIVE_90_DAYS', label: '90 dias sem visita', sortOrder: 4, meta: null },
  { id: 'fb-trg-MANUAL', kind: 'message_trigger', value: 'MANUAL', label: 'Envio manual', sortOrder: 5, meta: null },
];

export const FALLBACK_PROCEDURE_CATEGORIES: PlatformCatalogOption[] = [
  { id: 'fb-proc-Facial', kind: 'procedure_category', value: 'Facial', label: 'Facial', sortOrder: 0, meta: null },
  { id: 'fb-proc-Injetáveis', kind: 'procedure_category', value: 'Injetáveis', label: 'Injetáveis', sortOrder: 1, meta: null },
  { id: 'fb-proc-Laser', kind: 'procedure_category', value: 'Laser', label: 'Laser', sortOrder: 2, meta: null },
  { id: 'fb-proc-Corporal', kind: 'procedure_category', value: 'Corporal', label: 'Corporal', sortOrder: 3, meta: null },
  { id: 'fb-proc-Peeling', kind: 'procedure_category', value: 'Peeling', label: 'Peeling', sortOrder: 4, meta: null },
  { id: 'fb-proc-Depilação', kind: 'procedure_category', value: 'Depilação', label: 'Depilação', sortOrder: 5, meta: null },
  { id: 'fb-proc-Capilar', kind: 'procedure_category', value: 'Capilar', label: 'Capilar', sortOrder: 6, meta: null },
];

export const FALLBACK_SKINCARE_TAGS: PlatformCatalogOption[] = [
  { id: 'fb-skin-acido', kind: 'skincare_tag', value: 'acido', label: 'Ácidos (baixa concentração)', sortOrder: 0, meta: null },
  { id: 'fb-skin-acido-alto', kind: 'skincare_tag', value: 'acido-alto', label: 'Ácidos em alta concentração', sortOrder: 1, meta: null },
  { id: 'fb-skin-retinoide', kind: 'skincare_tag', value: 'retinoide', label: 'Retinoides', sortOrder: 2, meta: null },
  { id: 'fb-skin-fragrancia', kind: 'skincare_tag', value: 'fragrancia', label: 'Fragrância', sortOrder: 3, meta: null },
  { id: 'fb-skin-oleo', kind: 'skincare_tag', value: 'oleo', label: 'Óleos comedogênicos', sortOrder: 4, meta: null },
];

export const FALLBACK_INVENTORY_UNITS: PlatformCatalogOption[] = [
  { id: 'fb-unit-un', kind: 'inventory_unit', value: 'un', label: 'Unidade (un)', sortOrder: 0, meta: null },
  { id: 'fb-unit-ml', kind: 'inventory_unit', value: 'ml', label: 'Mililitro (ml)', sortOrder: 1, meta: null },
  { id: 'fb-unit-L', kind: 'inventory_unit', value: 'L', label: 'Litro (L)', sortOrder: 2, meta: null },
  { id: 'fb-unit-g', kind: 'inventory_unit', value: 'g', label: 'Grama (g)', sortOrder: 3, meta: null },
  { id: 'fb-unit-kg', kind: 'inventory_unit', value: 'kg', label: 'Quilograma (kg)', sortOrder: 4, meta: null },
  { id: 'fb-unit-par', kind: 'inventory_unit', value: 'par', label: 'Par', sortOrder: 5, meta: null },
  { id: 'fb-unit-cx', kind: 'inventory_unit', value: 'cx', label: 'Caixa (cx)', sortOrder: 6, meta: null },
  { id: 'fb-unit-pct', kind: 'inventory_unit', value: 'pct', label: 'Pacote (pct)', sortOrder: 7, meta: null },
  { id: 'fb-unit-fr', kind: 'inventory_unit', value: 'fr', label: 'Frasco (fr)', sortOrder: 8, meta: null },
  { id: 'fb-unit-tb', kind: 'inventory_unit', value: 'tb', label: 'Tubo (tb)', sortOrder: 9, meta: null },
  { id: 'fb-unit-amp', kind: 'inventory_unit', value: 'amp', label: 'Ampola (amp)', sortOrder: 10, meta: null },
];

export const CATALOG_FALLBACKS: Record<PlatformCatalogKind, PlatformCatalogOption[]> = {
  document_category: FALLBACK_DOCUMENT_CATEGORIES,
  message_category: FALLBACK_MESSAGE_CATEGORIES,
  message_trigger: FALLBACK_MESSAGE_TRIGGERS,
  procedure_category: FALLBACK_PROCEDURE_CATEGORIES,
  inventory_unit: FALLBACK_INVENTORY_UNITS,
  skincare_tag: FALLBACK_SKINCARE_TAGS,
};

/** Cache em memória preenchido pelo prefetch / hooks (labels fora de React). */
const liveCache: Partial<Record<PlatformCatalogKind, PlatformCatalogOption[]>> = {};

export function setCatalogCache(kind: PlatformCatalogKind, items: PlatformCatalogOption[]) {
  liveCache[kind] = items;
}

export function setCatalogCacheFromList(items: PlatformCatalogOption[]) {
  const byKind: Partial<Record<PlatformCatalogKind, PlatformCatalogOption[]>> = {};
  for (const item of items) {
    (byKind[item.kind] ??= []).push(item);
  }
  for (const kind of PLATFORM_CATALOG_KINDS) {
    if (byKind[kind]) liveCache[kind] = byKind[kind];
  }
}

export function getCatalogItems(kind: PlatformCatalogKind): PlatformCatalogOption[] {
  return liveCache[kind] ?? CATALOG_FALLBACKS[kind];
}

/** Paleta sugerida para categorias de documento (chips + personalizado). */
export const CATALOG_DOCUMENT_COLORS = [
  '#15998B',
  '#5BA8DE',
  '#9B7BD4',
  '#E0915B',
  '#5C6BC0',
  '#C27C6B',
  '#4FA37A',
  '#78909C',
] as const;

export function normalizeCatalogHexColor(value: string): string {
  const t = value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(t)) return t.toUpperCase();
  return t;
}

export function catalogMetaColor(meta?: Record<string, unknown> | null): string | undefined {
  const color = meta && typeof meta === 'object' ? meta.color : undefined;
  return typeof color === 'string' ? color : undefined;
}

export function catalogDefaultTrigger(meta?: Record<string, unknown> | null): MessageTrigger | undefined {
  const trigger = meta && typeof meta === 'object' ? meta.defaultTrigger : undefined;
  return typeof trigger === 'string' ? (trigger as MessageTrigger) : undefined;
}

export function catalogLabelMap(items: PlatformCatalogOption[]): Record<string, string> {
  return Object.fromEntries(items.map((i) => [i.value, i.label]));
}

export function catalogOrderMap(items: PlatformCatalogOption[]): Record<string, number> {
  return Object.fromEntries(items.map((i, idx) => [i.value, i.sortOrder ?? idx]));
}

export function triggerForCategoryFromCatalog(
  categories: PlatformCatalogOption[],
  category?: string | null,
): MessageTrigger | undefined {
  if (!category) return undefined;
  const found = categories.find((c) => c.value === category);
  return catalogDefaultTrigger(found?.meta);
}
