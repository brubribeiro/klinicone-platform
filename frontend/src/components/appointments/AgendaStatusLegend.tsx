import { Box, Typography } from '@mui/material';

import type { AppointmentStatus } from '../../types';
import { fontSizes } from '../../theme/fontSizes';
import { statusColors, statusLabel } from './agendaConfig';
import { LegendSwatch } from './AgendaToolbar';

export function AgendaStatusLegend() {
  return (
    <Box
      data-tour="agenda-legend"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1.5, sm: 2 },
        flexWrap: 'wrap',
        px: 2,
        py: 1.15,
        mb: 1.5,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '13px',
        boxShadow: '0 1px 2px rgba(16,40,37,.04),0 8px 24px -12px rgba(16,40,37,.10)',
      }}
    >
      <Typography
        sx={{
          fontSize: fontSizes.xs,
          fontWeight: 700,
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.4px',
        }}
      >
        Status
      </Typography>
      {Object.entries(statusLabel).map(([key, label]) => (
        <LegendSwatch key={key} color={statusColors[key as AppointmentStatus]?.border} label={label} />
      ))}
    </Box>
  );
}
