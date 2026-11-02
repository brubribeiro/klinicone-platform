// Chaves usadas pela anamnese de pele (mesmas do frontend em components/skincare/skincareUtils.ts).
export const SKINCARE_MOMENTS = ['manha', 'noite', 'semanal'] as const;
export const SKINCARE_STEPS = ['limpeza', 'tratamento', 'hidratacao', 'protetor', 'olhos', 'esfoliacao', 'mascara'] as const;
/** Fallback quando o catálogo `skincare_tag` ainda não foi seedado. */
export const SKINCARE_TAGS_FALLBACK = ['acido', 'acido-alto', 'retinoide', 'fragrancia', 'oleo'] as const;
export const SKINCARE_RULE_FIELDS = ['pele', 'afeccao', 'olheira', 'idade'] as const;

export const SKINCARE_RULE_VALUES: Record<(typeof SKINCARE_RULE_FIELDS)[number], string[]> = {
  pele: ['normal', 'seca', 'mista', 'oleosa', 'sensivel', 'acneica'],
  afeccao: ['melasma', 'manchas', 'acne', 'rosacea'],
  olheira: ['pigmentares', 'vasculares', 'mistas'],
  idade: ['25', '35', '55'],
};
