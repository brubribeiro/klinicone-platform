import { Box, alpha } from '@mui/material';

import { fontSizes } from '../../../../frontend/src/theme/fontSizes';
import type { PlanLimits } from '../../../../frontend/src/types';
import { formatBytes } from '../../../../frontend/src/utils/formatBytes';

export { formatBytes };

export const ROW_ACTION_SX = {
  width: 30,
  height: 30,
  borderRadius: '9px',
  border: 1,
  borderColor: 'divider',
  bgcolor: 'background.paper',
  color: 'text.secondary',
} as const;

/** Ativa / Suspensa. */
export function TenantStatusPill({ active }: { active: boolean }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        fontSize: fontSizes.xs,
        fontWeight: 700,
        px: 1,
        py: 0.4,
        borderRadius: '8px',
        whiteSpace: 'nowrap',
        color: active ? 'primary.dark' : 'error.dark',
        bgcolor: (t) => alpha(active ? t.palette.primary.main : t.palette.error.main, 0.12),
      }}
    >
      {active ? 'Ativa' : 'Suspensa'}
    </Box>
  );
}

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function formatDateTime(value: string | null | undefined): string {
  return value ? dateTimeFormatter.format(new Date(value)) : '—';
}

export function formatDate(value: string | null | undefined): string {
  return value ? dateFormatter.format(new Date(value)) : '—';
}

/** "agora", "há 5 min", "há 3 h", "há 2 dias", ou a data quando passa de 30 dias. */
export function formatLastAccess(value: string | null | undefined, now = Date.now()): string {
  if (!value) return 'Nunca';
  const minutes = Math.floor((now - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days <= 30) return days === 1 ? 'há 1 dia' : `há ${days} dias`;
  return formatDate(value);
}

/** "3 usuários · 500 pacientes · 5 GB"; sem limites → "Sem limites". */
export function formatCnpj(digits: string | null | undefined): string {
  const d = (digits ?? '').replace(/\D/g, '');
  if (d.length !== 14) return digits?.trim() || '—';
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function formatPlanLimits(limits: PlanLimits | null | undefined): string {
  const parts: string[] = [];
  const n = (v: number) => v.toLocaleString('pt-BR');
  if (limits?.maxUsers != null) parts.push(`${n(limits.maxUsers)} ${limits.maxUsers === 1 ? 'usuário' : 'usuários'}`);
  if (limits?.maxPatients != null)
    parts.push(`${n(limits.maxPatients)} ${limits.maxPatients === 1 ? 'paciente' : 'pacientes'}`);
  if (limits?.storageGb != null) parts.push(`${n(limits.storageGb)} GB`);
  return parts.length ? parts.join(' · ') : 'Sem limites';
}
