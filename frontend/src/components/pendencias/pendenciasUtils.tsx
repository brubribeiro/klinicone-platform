import { darken, lighten, type Theme } from '@mui/material';

import type { PendingCategory, PendingGroup, PendingItem, PendingRule } from '../../types';

/** Traços do protótipo Aurora (viewBox 24). */
export const PEND_ICONS = {
  doc: 'M6 3h7l5 5v13H6zM13 3v5h5M9 13h6M9 16.5h6',
  box: 'M12 3l7.5 4v8.5L12 20l-7.5-4.5V7zM4.6 7L12 11l7.4-4M12 11v9',
  money: 'M12 3.5v17M15.5 7.5H10a2.5 2.5 0 0 0 0 5h4a2.5 2.5 0 0 1 0 5H8',
  shield: 'M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z',
  device: 'M4 5h16v11H4zM9 20h6M12 16v4',
  people: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 6.5a2.6 2.6 0 0 1 0 5.2M16 20a6 6 0 0 0-2.4-4.8',
  megaphone: 'M4 10v4l12 5V5zM16 8.5a3.5 3.5 0 0 1 0 7',
  flame: 'M12 21c4-2.5 6-5.5 6-9 0-3-1.5-5.5-4-7 .5 2.5-.5 4-2 5.5S9 14 9 16c-1-1-1.5-2.5-1.5-4C6 13.5 6 15 6 16c0 2.5 2 4 6 5z',
  alert: 'M12 8v5M12 16.2v.1',
  clock: 'M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zM12 7.5V12l3.2 2',
  calendar: 'M6 5h12a2.5 2.5 0 0 1 2.5 2.5v10.5a2.5 2.5 0 0 1-2.5 2.5H6a2.5 2.5 0 0 1-2.5-2.5V7.5A2.5 2.5 0 0 1 6 5zM3.5 9.5h17M8 3v4M16 3v4',
  check: 'M20 6L9 17l-5-5',
  plus: 'M12 5v14M5 12h14',
  list: 'M4 6h16M4 12h16M4 18h10',
  chart: 'M5 19V9M11 19V5M17 19v-6',
} as const;

export type PendIconName = keyof typeof PEND_ICONS;

export function PendIcon({ name, size = 17, strokeWidth = 1.7 }: { name: PendIconName; size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PEND_ICONS[name]} />
    </svg>
  );
}

/** Tokens da paleta do tema (`grupo.tom`), para seguir o Aurora teal e o modo escuro. */
export const CATEGORY_META: Record<PendingCategory, { label: string; color: string; icon: PendIconName }> = {
  ADMINISTRATIVE: { label: 'Administrativo', color: 'primary.main', icon: 'doc' },
  FINANCE: { label: 'Financeiro', color: 'success.dark', icon: 'money' },
  INVENTORY: { label: 'Estoque', color: 'warning.main', icon: 'box' },
  OPERATIONAL: { label: 'Clínica/Operacional', color: 'warning.light', icon: 'people' },
  MAINTENANCE: { label: 'Manutenção', color: 'info.main', icon: 'device' },
  HEALTH_SURVEILLANCE: { label: 'Vigilância Sanitária', color: 'error.main', icon: 'shield' },
  MARKETING: { label: 'Marketing', color: 'info.dark', icon: 'megaphone' },
  TEAM: { label: 'Equipe', color: 'warning.dark', icon: 'people' },
  PATIENTS: { label: 'Pacientes', color: 'success.main', icon: 'people' },
  MANAGEMENT: { label: 'Gestão', color: 'secondary.main', icon: 'chart' },
};

/** Resolve um token `grupo.tom` da paleta para a cor do tema atual. */
export function categoryColor(theme: Theme, category: PendingCategory): string {
  const [group, shade] = CATEGORY_META[category].color.split('.');
  return (theme.palette as unknown as Record<string, Record<string, string>>)[group][shade];
}

/** Fundo sólido suave a partir de uma cor (sem transparência). */
export function softBg(theme: Theme, color: string, level = 0.88) {
  return theme.palette.mode === 'dark' ? darken(color, level - 0.08) : lighten(color, level);
}

export type PendTone = 'error' | 'warning' | 'info' | 'success' | 'primary';

/** Cores de um tom de status: fundos sólidos suaves (opacos), borda e texto do tema. */
export function pendTone(theme: Theme, tone: PendTone) {
  const { main, dark } = theme.palette[tone];
  const soft = (light: number, deep: number) =>
    theme.palette.mode === 'dark' ? darken(main, deep) : lighten(main, light);
  return {
    main,
    text: dark,
    tint: soft(0.92, 0.82),
    statBg: soft(0.9, 0.8),
    chipBg: soft(0.84, 0.7),
    border: soft(0.6, 0.45),
  };
}

export const CATEGORY_OPTIONS = (Object.keys(CATEGORY_META) as PendingCategory[]).map((value) => ({
  value,
  label: CATEGORY_META[value].label,
}));

export const GROUP_ORDER: PendingGroup[] = ['URGENT', 'OVERDUE', 'UPCOMING'];

export const GROUP_META: Record<
  PendingGroup,
  { label: string; chipLabel: string; tone: PendTone; icon: PendIconName }
> = {
  URGENT: { label: 'Urgentes', chipLabel: 'Urgente', tone: 'error', icon: 'alert' },
  OVERDUE: { label: 'Atrasadas', chipLabel: 'Atrasada', tone: 'warning', icon: 'clock' },
  UPCOMING: { label: 'Próximas', chipLabel: 'Próxima', tone: 'info', icon: 'calendar' },
};

export const RESOLVED_META = { label: 'Resolvidas', tone: 'success' } as const satisfies { label: string; tone: PendTone };

export const RULE_META: Record<
  PendingRule,
  { label: string; description: string; icon: PendIconName; param: { label: string; suffix: string } | null }
> = {
  LOW_STOCK: {
    label: 'Estoque abaixo do mínimo',
    description: 'Cria pendência para cada item com quantidade menor que o estoque mínimo.',
    icon: 'box',
    param: { label: 'Margem de folga (unidades)', suffix: 'un' },
  },
  EXPIRING_STOCK: {
    label: 'Produto perto do vencimento',
    description: 'Alerta quando a validade do lote está próxima.',
    icon: 'box',
    param: { label: 'Antecedência', suffix: 'dias' },
  },
  BILLS_DUE: {
    label: 'Contas a vencer',
    description: 'Cada despesa não paga dentro do prazo entra como pendência financeira.',
    icon: 'money',
    param: { label: 'Antecedência', suffix: 'dias' },
  },
  APPOINTMENT_NO_OUTCOME: {
    label: 'Agendamento sem desfecho',
    description: 'Atendimentos que já passaram e seguem sem confirmação de comparecimento.',
    icon: 'people',
    param: null,
  },
  EQUIPMENT_MAINTENANCE: {
    label: 'Manutenção de equipamento',
    description: 'Equipamentos com manutenção agendada ou em atraso.',
    icon: 'device',
    param: { label: 'Antecedência', suffix: 'dias' },
  },
  DOCUMENT_UNSIGNED: {
    label: 'Documento sem assinatura',
    description: 'Termos e fichas enviados que continuam sem assinatura do paciente.',
    icon: 'doc',
    param: null,
  },
  COMMEMORATIVE_DATE: {
    label: 'Data comemorativa sem promoção',
    description: 'Sugere criar campanha para datas próximas sem promoção vinculada.',
    icon: 'megaphone',
    param: { label: 'Antecedência', suffix: 'dias' },
  },
};

export const RULE_CATEGORY: Record<PendingRule, PendingCategory> = {
  LOW_STOCK: 'INVENTORY',
  EXPIRING_STOCK: 'INVENTORY',
  BILLS_DUE: 'FINANCE',
  APPOINTMENT_NO_OUTCOME: 'OPERATIONAL',
  EQUIPMENT_MAINTENANCE: 'MAINTENANCE',
  DOCUMENT_UNSIGNED: 'ADMINISTRATIVE',
  COMMEMORATIVE_DATE: 'MARKETING',
};

export function itemIcon(item: PendingItem): PendIconName {
  return item.rule ? RULE_META[item.rule].icon : CATEGORY_META[item.category].icon;
}

export function isManual(item: PendingItem) {
  return item.rule === null;
}

/** Fatias da rosca (r externo 54, interno 36, centro 64) como no protótipo. */
export function donutPaths(slices: { n: number; color: string }[]) {
  const total = slices.reduce((acc, s) => acc + s.n, 0);
  if (!total) return [];
  const r = 54;
  const ri = 36;
  const c = 64;
  let acc = 0;
  return slices.map((s) => {
    const start = acc;
    acc += s.n / total;
    // Fatia única: arco de 360° não desenha; usa quase-círculo.
    const end = s.n === total ? acc - 0.0001 : acc;
    const a0 = start * 2 * Math.PI - Math.PI / 2;
    const a1 = end * 2 * Math.PI - Math.PI / 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad: number, ang: number) => `${c + rad * Math.cos(ang)} ${c + rad * Math.sin(ang)}`;
    return {
      color: s.color,
      d: `M${p(r, a0)} A${r} ${r} 0 ${large} 1 ${p(r, a1)} L${p(ri, a1)} A${ri} ${ri} 0 ${large} 0 ${p(ri, a0)} Z`,
    };
  });
}
