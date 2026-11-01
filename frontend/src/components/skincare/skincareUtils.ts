import { getCatalogItems } from '../../features/platformCatalog';
import type {
  PlatformCatalogOption,
  SkinAnswers,
  SkincareAvoided,
  SkincareGuideline,
  SkincareMoment,
  SkincareProduct,
  SkincareRoutineItem,
  SkincareRule,
  SkincareRuleField,
  SkincareStep,
} from '../../types';

/** [chave, rótulo, descrição opcional] */
type Option<K extends string = string> = readonly [K, string, string?];

export const SKIN_TYPES: Option[] = [
  ['normal', 'Normal', 'Equilibrada, sem brilho excessivo nem repuxamento'],
  ['seca', 'Seca', 'Repuxa, descama, pouca oleosidade'],
  ['mista', 'Mista', 'Oleosa na zona T, normal ou seca nas laterais'],
  ['oleosa', 'Oleosa', 'Brilho difuso e poros dilatados'],
  ['sensivel', 'Sensível', 'Arde, coça ou avermelha com facilidade'],
  ['acneica', 'Acneica', 'Tendência a cravos e espinhas'],
];

export const SKIN_CONDITIONS: Option[] = [
  ['nao', 'Não'],
  ['melasma', 'Melasma'],
  ['manchas', 'Manchas de acne'],
  ['acne', 'Acne ativa'],
  ['rosacea', 'Rosácea'],
  ['outra', 'Outra'],
];

export const DARK_CIRCLE_TYPES: Option[] = [
  ['pigmentares', 'Pigmentares', 'Tom amarronzado, piora com sol'],
  ['vasculares', 'Vasculares', 'Tom arroxeado ou azulado'],
  ['mistas', 'Mistas', 'Combinação dos dois tipos'],
];

export const AGE_RANGES: Option[] = [
  ['25', '25+'],
  ['35', '35+'],
  ['55', '55+'],
];

export const FALLBACK_SKINCARE_TAG_OPTIONS: Option[] = [
  ['acido', 'Ácidos (baixa concentração)'],
  ['acido-alto', 'Ácidos em alta concentração'],
  ['retinoide', 'Retinoides'],
  ['fragrancia', 'Fragrância'],
  ['oleo', 'Óleos comedogênicos'],
];

/** Lista estática de fallback (testes e cache vazio). */
export const SKINCARE_TAGS = FALLBACK_SKINCARE_TAG_OPTIONS;

export function skincareTagsFromCatalog(items: PlatformCatalogOption[]): Option[] {
  return items.map((i) => [i.value, i.label]);
}

/** Tags ativas do catálogo global (fallback = valores hardcoded originais). */
export function skincareTagOptions(): readonly Option[] {
  const items = getCatalogItems('skincare_tag');
  if (!items.length) return FALLBACK_SKINCARE_TAG_OPTIONS;
  return skincareTagsFromCatalog(items);
}

export const SKINCARE_MOMENTS: Option<SkincareMoment>[] = [
  ['manha', 'Manhã'],
  ['noite', 'Noite'],
  ['semanal', 'Semanal'],
];

export const SKINCARE_STEPS: Option<SkincareStep>[] = [
  ['limpeza', 'Limpeza'],
  ['tratamento', 'Tratamento / sérum'],
  ['hidratacao', 'Hidratação'],
  ['protetor', 'Protetor solar'],
  ['olhos', 'Área dos olhos'],
  ['esfoliacao', 'Esfoliação'],
  ['mascara', 'Máscara'],
];

/** Etapas de cada momento, na ordem em que aparecem na rotina. */
export const MOMENT_SLOTS: Record<SkincareMoment, SkincareStep[]> = {
  manha: ['limpeza', 'tratamento', 'hidratacao', 'protetor'],
  noite: ['limpeza', 'tratamento', 'olhos', 'hidratacao'],
  semanal: ['esfoliacao', 'mascara'],
};

export const RULE_FIELDS: Option<SkincareRuleField>[] = [
  ['pele', 'Tipo de pele'],
  ['afeccao', 'Afecção em tratamento'],
  ['olheira', 'Olheiras'],
  ['idade', 'Faixa etária'],
];

export const MOMENT_ICON_PATHS: Record<SkincareMoment, string> = {
  manha:
    'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  noite: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  semanal:
    'M3.5 9.5h17M8 3v4M16 3v4M5 5h14a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5v-12A1.5 1.5 0 0 1 5 5z',
};

export function optionLabel(list: readonly Option[], key: string | null | undefined): string {
  return list.find((o) => o[0] === key)?.[1] ?? '';
}

export function emptySkinAnswers(): SkinAnswers {
  return { pele: '', afec: [], afecOutra: '', olheira: '', olheiraTipo: '', idade: '' };
}

/** "Não" é exclusivo; qualquer outra afecção desmarca o "Não". */
export function toggleCondition(current: string[], key: string): string[] {
  if (key === 'nao') return current.includes('nao') ? [] : ['nao'];
  const rest = current.filter((k) => k !== 'nao');
  return rest.includes(key) ? rest.filter((k) => k !== key) : [...rest, key];
}

/** Etapa 0 a 4 do assistente pode avançar? (a 5 é a revisão) */
export function canAdvance(step: number, a: SkinAnswers, hasPatient: boolean, consultDate: string): boolean {
  if (step === 0) return hasPatient && !!consultDate;
  if (step === 1) return !!a.pele;
  if (step === 2) return a.afec.length > 0 && (!a.afec.includes('outra') || !!a.afecOutra.trim());
  if (step === 3) return a.olheira === 'nao' || (a.olheira === 'sim' && !!a.olheiraTipo);
  if (step === 4) return !!a.idade;
  return true;
}

export function conditionsText(a: SkinAnswers): string {
  return a.afec
    .map((k) => (k === 'outra' ? `Outra${a.afecOutra ? `: ${a.afecOutra}` : ''}` : optionLabel(SKIN_CONDITIONS, k)))
    .join(', ');
}

export function darkCirclesText(a: SkinAnswers): string {
  if (a.olheira === 'nao') return 'Não';
  if (a.olheira === 'sim') return `Sim · ${optionLabel(DARK_CIRCLE_TYPES, a.olheiraTipo) || 'tipo não informado'}`;
  return '';
}

export function ruleValueOptions(field: SkincareRuleField): readonly Option[] {
  if (field === 'pele') return SKIN_TYPES;
  if (field === 'afeccao') return SKIN_CONDITIONS.filter((o) => o[0] !== 'nao' && o[0] !== 'outra');
  if (field === 'olheira') return DARK_CIRCLE_TYPES;
  return AGE_RANGES;
}

export function ruleConditionLabel(rule: Pick<SkincareRule, 'field' | 'value'>): string {
  if (rule.field === 'pele') return `Pele ${optionLabel(SKIN_TYPES, rule.value).toLowerCase()}`;
  if (rule.field === 'afeccao') return optionLabel(SKIN_CONDITIONS, rule.value);
  if (rule.field === 'olheira') return `Olheiras ${optionLabel(DARK_CIRCLE_TYPES, rule.value).toLowerCase()}`;
  if (rule.field === 'idade') return `Faixa ${optionLabel(AGE_RANGES, rule.value)}`;
  return '';
}

export function slotLabel(moment: SkincareMoment, step: SkincareStep): string {
  if (step === 'tratamento') return moment === 'manha' ? 'Tratamento / sérum' : 'Tratamento / ativo';
  return optionLabel(SKINCARE_STEPS, step);
}

function ruleMatches(rule: SkincareRule, a: SkinAnswers): boolean {
  if (rule.field === 'pele') return a.pele === rule.value;
  if (rule.field === 'afeccao') return a.afec.includes(rule.value);
  if (rule.field === 'olheira') return a.olheira === 'sim' && a.olheiraTipo === rule.value;
  if (rule.field === 'idade') return a.idade === rule.value;
  return false;
}

export function productToItem(p: SkincareProduct, moment: SkincareMoment): SkincareRoutineItem {
  return {
    moment,
    step: p.step,
    productId: p.id,
    name: p.name,
    brand: p.brand,
    activeIngredient: p.activeIngredient,
    howTo: p.howTo,
    note: p.note,
  };
}

/**
 * Monta a rotina a partir das respostas: soma todas as regras que batem; cada produto incluído entra
 * nos momentos/etapa do cadastro; uma restrição (característica evitada) tira o produto mesmo que outra regra o inclua.
 */
export function generateRoutine(
  answers: SkinAnswers,
  products: SkincareProduct[],
  rules: SkincareRule[],
  tagOptions: readonly Option[] = skincareTagOptions(),
): { items: SkincareRoutineItem[]; avoided: SkincareAvoided[]; guidelines: SkincareGuideline[] } {
  const byId = new Map(products.map((p) => [p.id, p]));
  const hits = rules.filter((r) => ruleMatches(r, answers));

  const avoidBy = new Map<string, string[]>();
  for (const r of hits) {
    for (const tag of r.avoidTags) {
      const sources = avoidBy.get(tag) ?? [];
      const label = ruleConditionLabel(r);
      if (!sources.includes(label)) sources.push(label);
      avoidBy.set(tag, sources);
    }
  }

  const items: SkincareRoutineItem[] = [];
  const avoided = new Map<string, SkincareAvoided>();
  const guidelines: SkincareGuideline[] = [];

  for (const r of hits) {
    if (r.note) guidelines.push({ text: r.note, source: ruleConditionLabel(r) });
    for (const pid of r.productIds) {
      const p = byId.get(pid);
      if (!p) continue;
      const tag = p.tags.find((t) => avoidBy.has(t));
      if (tag) {
        avoided.set(pid, {
          productId: pid,
          name: p.name,
          reason: `${optionLabel(tagOptions, tag)} · ${avoidBy.get(tag)!.join(', ')}`,
        });
        continue;
      }
      for (const m of p.moments) {
        if (!MOMENT_SLOTS[m]?.includes(p.step)) continue;
        if (items.some((i) => i.productId === pid && i.moment === m)) continue;
        items.push(productToItem(p, m));
      }
    }
  }

  return { items, avoided: [...avoided.values()], guidelines };
}

export function formatDateBR(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : isoDate;
}

/** Texto da rotina para mandar por WhatsApp ou e-mail. */
export function routineAsText(items: SkincareRoutineItem[], guidelines: SkincareGuideline[], notes: string): string {
  const lines: string[] = [];
  for (const [m, label] of SKINCARE_MOMENTS) {
    const ofMoment = MOMENT_SLOTS[m].flatMap((st) => items.filter((i) => i.moment === m && i.step === st));
    if (ofMoment.length === 0) continue;
    lines.push('', `*${label}*`);
    ofMoment.forEach((i, idx) => {
      lines.push(`${idx + 1}. ${slotLabel(m, i.step)}: ${i.name}${i.brand ? ` (${i.brand})` : ''}`);
      if (i.howTo) lines.push(`   ${i.howTo}`);
      if (i.note) lines.push(`   ⚠ ${i.note}`);
    });
  }
  if (guidelines.length) {
    lines.push('', '*Orientações*', ...guidelines.map((g) => `• ${g.text}`));
  }
  if (notes.trim()) lines.push('', '*Observações*', notes.trim());
  return lines.join('\n').trim();
}
