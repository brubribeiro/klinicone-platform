import type { ReactNode } from 'react';
import { Card, Skeleton, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import type { SystemStyleObject } from '@mui/system';
import { fontSizes } from '../theme/fontSizes';

/** Faixa de KPIs no topo das listagens (Pacientes, Documentos, Metas, etc.). */
export const TOP_STAT_CARD_MIN_HEIGHT = { xs: 88, sm: 92 } as const;

interface StatCardProps {
  label: string;
  value: ReactNode;
  loading?: boolean;
  color?: string;
  skeletonWidth?: number;
  /** Com altura fixa o skeleton não segue o tamanho da fonte do valor. */
  skeletonHeight?: number;
  sx?: SystemStyleObject<Theme>;
  valueSx?: SystemStyleObject<Theme>;
  labelSx?: SystemStyleObject<Theme>;
}

/** Card de indicador (número grande + rótulo) acima das listagens. */
export function StatCard({
  label,
  value,
  loading,
  color = 'text.primary',
  skeletonWidth = 60,
  skeletonHeight,
  sx,
  valueSx,
  labelSx,
}: StatCardProps) {
  return (
    <Card
      sx={{
        p: { xs: 2, sm: 2.25 },
        borderRadius: '16px',
        minHeight: TOP_STAT_CARD_MIN_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        ...sx,
      }}
    >
      {loading ? (
        <Skeleton
          variant="text"
          width={skeletonWidth}
          height={skeletonHeight}
          sx={skeletonHeight ? undefined : { fontSize: fontSizes['6xl'] }}
        />
      ) : (
        <Typography
          sx={{
            fontSize: { xs: '1.4rem', sm: '1.65rem' },
            fontWeight: 800,
            letterSpacing: '-0.5px',
            color,
            ...valueSx,
          }}
        >
          {value}
        </Typography>
      )}
      <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', fontWeight: 600, mt: 0.25, ...labelSx }}>
        {label}
      </Typography>
    </Card>
  );
}
