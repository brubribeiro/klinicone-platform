import type { ReactNode } from 'react';
import { Box, Card, Skeleton, Stack, Typography, type SxProps, type Theme } from '@mui/material';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ScheduleIcon from '@mui/icons-material/Schedule';
import type { Dayjs } from 'dayjs';
import { fontSizes } from '../../theme/fontSizes';
import { brl } from '../../utils/money';
import { toneBg } from './RecurringExpenseRow';
import { UPCOMING_DAYS, formatDue } from './recurringDue';

function SummaryCard({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Card
      sx={{
        p: { xs: 2, sm: '18px 20px' },
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: 132,
        ...sx,
      }}
    >
      {children}
    </Card>
  );
}

function SummaryIcon({ children, tone }: { children: ReactNode; tone: 'primary' | 'warning' }) {
  return (
    <Box
      sx={{
        width: 34,
        height: 34,
        borderRadius: '10px',
        bgcolor: toneBg(tone, 0.12),
        color: `${tone}.main`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {children}
    </Box>
  );
}

interface RecurringSummaryCardsProps {
  loading: boolean;
  totalMonthly: number;
  activeFixedMonthly: number;
  activeVariableMonthly: number;
  fixedPct: number;
  variablePct: number;
  dueStats: { activeCount: number; upcoming: number; next: Dayjs | null };
}

/** Resumo do topo: total mensal (fixo × variável), contas ativas e vencimentos próximos. */
export function RecurringSummaryCards({
  loading: isLoading,
  totalMonthly,
  activeFixedMonthly,
  activeVariableMonthly,
  fixedPct,
  variablePct,
  dueStats,
}: RecurringSummaryCardsProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1.5fr 1fr 1fr' },
        gap: { xs: 1.5, sm: 2.25 },
      }}
    >
      <SummaryCard sx={{ gridColumn: { sm: '1 / -1', md: 'auto' } }}>
        <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={1}>
          <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary', fontWeight: 600 }}>
            Total mensal recorrente
          </Typography>
          <Typography sx={{ fontSize: fontSizes.xs, color: 'text.disabled', fontWeight: 600 }}>
            {isLoading ? <Skeleton width={90} /> : `${brl.format(totalMonthly * 12)} / ano`}
          </Typography>
        </Stack>
        <Typography
          sx={{ fontSize: fontSizes['6xl'], fontWeight: 800, letterSpacing: '-.6px', mt: 0.75, mb: 1.75 }}
        >
          {isLoading ? <Skeleton width={180} /> : brl.format(totalMonthly)}
        </Typography>
        <Box sx={{ display: 'flex', height: 8, borderRadius: '6px', overflow: 'hidden', bgcolor: 'grey.100' }}>
          <Box sx={{ width: `${fixedPct}%`, bgcolor: 'primary.main', transition: 'width .3s' }} />
          <Box sx={{ width: `${variablePct}%`, bgcolor: 'warning.main', transition: 'width .3s' }} />
        </Box>
        <Stack direction="row" flexWrap="wrap" useFlexGap columnGap={2} rowGap={0.5} sx={{ mt: 1.25 }}>
          {[
            { label: 'Fixo', pct: fixedPct, value: activeFixedMonthly, color: 'primary.main' },
            { label: 'Variável', pct: variablePct, value: activeVariableMonthly, color: 'warning.main' },
          ].map((s) => (
            <Stack key={s.label} direction="row" alignItems="center" spacing={0.75}>
              <Box sx={{ width: 9, height: 9, borderRadius: '3px', bgcolor: s.color }} />
              <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', fontWeight: 600 }}>
                {s.label} {s.pct}% · {brl.format(s.value)}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </SummaryCard>

      <SummaryCard>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary', fontWeight: 600 }}>
            Contas ativas
          </Typography>
          <SummaryIcon tone="primary">
            <ReceiptLongOutlinedIcon sx={{ fontSize: 18 }} />
          </SummaryIcon>
        </Stack>
        <Box>
          <Typography sx={{ fontSize: fontSizes['7xl'], fontWeight: 800, letterSpacing: '-.8px', lineHeight: 1.2 }}>
            {isLoading ? <Skeleton width={50} /> : dueStats.activeCount}
          </Typography>
          <Typography sx={{ fontSize: fontSizes.xs, color: 'text.disabled', fontWeight: 600 }}>
            despesas recorrentes em vigor
          </Typography>
        </Box>
      </SummaryCard>

      <SummaryCard>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary', fontWeight: 600 }}>
            Vencem em {UPCOMING_DAYS} dias
          </Typography>
          <SummaryIcon tone="warning">
            <ScheduleIcon sx={{ fontSize: 18 }} />
          </SummaryIcon>
        </Stack>
        <Box>
          <Typography sx={{ fontSize: fontSizes['7xl'], fontWeight: 800, letterSpacing: '-.8px', lineHeight: 1.2 }}>
            {isLoading ? <Skeleton width={50} /> : dueStats.upcoming}
          </Typography>
          <Typography sx={{ fontSize: fontSizes.xs, color: 'text.disabled', fontWeight: 600 }}>
            {dueStats.next ? `próximo: ${formatDue(dueStats.next)}` : 'nenhum vencimento'}
          </Typography>
        </Box>
      </SummaryCard>
    </Box>
  );
}
