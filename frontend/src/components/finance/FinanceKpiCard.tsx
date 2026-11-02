import type { ReactNode } from 'react';
import { Box, Card, Skeleton, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { TOP_STAT_CARD_MIN_HEIGHT } from '../StatCard';
import { fontSizes } from '../../theme/fontSizes';
import { clickableProps } from '../../utils/a11y';

/** Financeiro usa rótulo no topo + rodapé; altura mínima alinhada à faixa de KPIs das demais telas. */
const FINANCE_KPI_MIN_HEIGHT = {
  xs: TOP_STAT_CARD_MIN_HEIGHT.xs + 28,
  sm: TOP_STAT_CARD_MIN_HEIGHT.sm + 28,
} as const;

export function FinancePill({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        fontSize: fontSizes.xs,
        fontWeight: 700,
        color: tone,
        bgcolor: alpha(tone, 0.13),
        px: 1,
        py: '2px',
        borderRadius: '7px',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </Box>
  );
}

interface FinanceKpiCardProps {
  label: string;
  tone: string;
  loading?: boolean;
  value: ReactNode;
  valueColor?: string;
  footer?: ReactNode;
  active?: boolean;
  onClick?: () => void;
}

export function FinanceKpiCard({ label, tone, loading, value, valueColor, footer, active, onClick }: FinanceKpiCardProps) {
  return (
    <Card
      {...(onClick && clickableProps(onClick))}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        p: 2.5,
        minHeight: FINANCE_KPI_MIN_HEIGHT,
        borderRadius: '18px',
        border: 1,
        borderColor: active ? tone : 'divider',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color .15s, box-shadow .15s',
        ...(onClick && { '&:hover': { borderColor: alpha(tone, 0.6) } }),
      }}
    >
      <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, bgcolor: tone }} />
      <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 600, color: 'text.secondary', mb: 1.5 }}>
        {label}
      </Typography>
      {loading ? (
        <Skeleton width={140} height={36} sx={{ mb: 1 }} />
      ) : (
        <Typography
          sx={{
            fontSize: fontSizes['6xl'],
            fontWeight: 800,
            letterSpacing: '-0.8px',
            lineHeight: 1.15,
            color: valueColor ?? 'text.primary',
            mb: 1.25,
          }}
        >
          {value}
        </Typography>
      )}
      <Box sx={{ minHeight: 22 }}>{!loading && footer}</Box>
    </Card>
  );
}
