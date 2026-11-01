import { Box, Typography, alpha } from '@mui/material';
import type { ReactNode } from 'react';

import { fontSizes } from '../../../../frontend/src/theme/fontSizes';
import {
  PLATFORM_FEATURE_LABELS,
  type PlatformFeature,
} from '../../../../frontend/src/features/platformFeatures';

type Tone = 'primary' | 'danger' | 'muted';

/** Chip compacto selecionável (teal/rosé Aurora) para o catálogo de módulos. */
export function FeatureModuleChip({
  feature,
  selected,
  onClick,
  disabled,
  tone = 'primary',
  hint,
}: {
  feature: PlatformFeature;
  selected: boolean;
  onClick?: () => void;
  disabled?: boolean;
  tone?: Tone;
  hint?: string;
}) {
  const danger = tone === 'danger';
  const muted = tone === 'muted' || disabled;

  return (
    <Box
      component="button"
      type="button"
      aria-pressed={selected}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      title={hint}
      sx={(t) => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.6,
        fontFamily: 'inherit',
        fontSize: fontSizes.xs,
        fontWeight: 700,
        lineHeight: 1.25,
        px: 1.35,
        py: 0.85,
        borderRadius: '10px',
        border: '1.5px solid',
        cursor: disabled ? 'default' : 'pointer',
        textAlign: 'left',
        transition: 'border-color .15s, background-color .15s, color .15s, opacity .15s',
        opacity: disabled && !selected ? 0.72 : 1,
        ...(selected
          ? danger
            ? {
                borderColor: t.palette.error.main,
                bgcolor: alpha(t.palette.error.main, 0.08),
                color: t.palette.error.dark,
              }
            : muted
              ? {
                  borderColor: alpha(t.palette.primary.main, 0.45),
                  bgcolor: alpha(t.palette.primary.main, 0.06),
                  color: 'text.secondary',
                }
              : {
                  borderColor: 'primary.main',
                  bgcolor: alpha(t.palette.primary.main, 0.1),
                  color: 'primary.dark',
                }
          : {
              borderColor: 'divider',
              bgcolor: 'background.paper',
              color: 'text.secondary',
              '&:hover': disabled
                ? undefined
                : {
                    borderColor: danger ? alpha(t.palette.error.main, 0.45) : 'primary.light',
                    color: 'text.primary',
                  },
            }),
      })}
    >
      {PLATFORM_FEATURE_LABELS[feature]}
      {hint ? (
        <Typography component="span" sx={{ fontSize: fontSizes['3xs'], fontWeight: 700, opacity: 0.75 }}>
          {hint}
        </Typography>
      ) : null}
    </Box>
  );
}

/** Chip selecionável com rótulo livre (catálogos além de módulos). */
export function CatalogSelectChip({
  label,
  selected,
  onClick,
  disabled,
}: {
  label: string;
  selected: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <Box
      component="button"
      type="button"
      aria-pressed={selected}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      sx={(t) => ({
        display: 'inline-flex',
        alignItems: 'center',
        fontFamily: 'inherit',
        fontSize: fontSizes.xs,
        fontWeight: 700,
        lineHeight: 1.25,
        px: 1.35,
        py: 0.85,
        borderRadius: '10px',
        border: '1.5px solid',
        cursor: disabled ? 'default' : 'pointer',
        textAlign: 'left',
        transition: 'border-color .15s, background-color .15s, color .15s',
        ...(selected
          ? {
              borderColor: 'primary.main',
              bgcolor: alpha(t.palette.primary.main, 0.1),
              color: 'primary.dark',
            }
          : {
              borderColor: 'divider',
              bgcolor: 'background.paper',
              color: 'text.secondary',
              '&:hover': disabled
                ? undefined
                : { borderColor: 'primary.light', color: 'text.primary' },
            }),
      })}
    >
      {label}
    </Box>
  );
}

/** Grade estável de chips de módulos (evita saltos de altura no Dialog). */
export function FeatureModuleChipGrid({
  children,
  minHeight,
  'aria-label': ariaLabel,
}: {
  children: ReactNode;
  /** Altura mínima da grade — útil no modal de plano com catálogo fixo. */
  minHeight?: number;
  'aria-label'?: string;
}) {
  return (
    <Box
      role="group"
      aria-label={ariaLabel}
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0.85,
        alignContent: 'flex-start',
        minHeight: minHeight ?? undefined,
      }}
    >
      {children}
    </Box>
  );
}
