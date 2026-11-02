import { ToggleButton, ToggleButtonGroup, alpha, type SxProps, type Theme } from '@mui/material';

import { fontSizes } from '../../theme/fontSizes';

export const availabilityShortcutToggleSx: SxProps<Theme> = {
  flexWrap: 'wrap',
  gap: 0.75,
  '& .MuiToggleButtonGroup-grouped': {
    border: 1,
    borderColor: 'divider',
    borderRadius: '10px !important',
    mx: 0,
    px: 1.75,
    py: 0.65,
    fontSize: fontSizes.sm,
    fontWeight: 600,
    textTransform: 'none',
    lineHeight: 1.35,
    '&.Mui-selected': {
      bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
      color: 'primary.dark',
      borderColor: 'primary.main',
    },
  },
};

/** Atalhos visuais (ToggleButtonGroup) — horário semanal, motivo/período de bloqueio. */
export function AvailabilityShortcutToggles({
  options,
  value,
  onChange,
  size = 'small',
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
  size?: 'small' | 'medium' | 'large';
}) {
  return (
    <ToggleButtonGroup
      exclusive
      size={size}
      value={value}
      onChange={(_, val) => {
        if (val && typeof val === 'string') onChange(val);
      }}
      sx={availabilityShortcutToggleSx}
    >
      {options.map((o) => (
        <ToggleButton key={o.value} value={o.value}>
          {o.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
