import { Box, alpha, type Theme } from '@mui/material';

import { fontSizes } from '../../../../frontend/src/theme/fontSizes';
import type { FeedbackStatus, FeedbackType } from '../../../../frontend/src/types';

export const FEEDBACK_STATUSES: FeedbackStatus[] = ['OPEN', 'TRIAGED', 'CLOSED'];

export const FEEDBACK_STATUS_META: Record<FeedbackStatus, { label: string }> = {
  OPEN: { label: 'Aberto' },
  TRIAGED: { label: 'Em triagem' },
  CLOSED: { label: 'Fechado' },
};

const FEEDBACK_STATUS_PALETTE: Record<
  FeedbackStatus,
  'warning' | 'info' | 'success'
> = {
  OPEN: 'warning',
  TRIAGED: 'info',
  CLOSED: 'success',
};

export const FEEDBACK_TYPE_META: Record<FeedbackType, { label: string }> = {
  BUG: { label: 'Bug' },
  SUGGESTION: { label: 'Sugestão' },
};

const FEEDBACK_TYPE_PALETTE: Record<FeedbackType, 'error' | 'secondary'> = {
  BUG: 'error',
  SUGGESTION: 'secondary',
};

type PaletteMainKey = 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';

function pillFromPalette(theme: Theme, paletteKey: PaletteMainKey) {
  const main = theme.palette[paletteKey].main;
  return {
    display: 'inline-block',
    fontSize: fontSizes.xs,
    fontWeight: 700,
    px: 1,
    py: 0.4,
    borderRadius: '8px',
    whiteSpace: 'nowrap',
    color: main,
    bgcolor: alpha(main, 0.12),
  } as const;
}

export function ColorPill({ label, color }: { label: string; color: string }) {
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
        color,
        bgcolor: alpha(color, 0.12),
      }}
    >
      {label}
    </Box>
  );
}

export function FeedbackStatusPill({ status }: { status: FeedbackStatus }) {
  const label = FEEDBACK_STATUS_META[status].label;
  const paletteKey = FEEDBACK_STATUS_PALETTE[status];
  return (
    <Box component="span" sx={(theme) => pillFromPalette(theme, paletteKey)}>
      {label}
    </Box>
  );
}

export function FeedbackTypePill({ type }: { type: FeedbackType }) {
  const label = FEEDBACK_TYPE_META[type].label;
  const paletteKey = FEEDBACK_TYPE_PALETTE[type];
  return (
    <Box component="span" sx={(theme) => pillFromPalette(theme, paletteKey)}>
      {label}
    </Box>
  );
}
