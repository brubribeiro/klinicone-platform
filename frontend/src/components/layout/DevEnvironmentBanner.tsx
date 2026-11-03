import { Box, Typography, useTheme } from '@mui/material';

import { fontSizes } from '../../theme/fontSizes';
import { isDevEnvironment } from '../../utils/appEnv';
import { DEV_BAR_HEIGHT } from './layoutTheme';

/** Faixa discreta no topo quando o front está em ambiente de desenvolvimento/staging. */
export function DevEnvironmentBanner() {
  const theme = useTheme();
  if (!isDevEnvironment()) return null;

  return (
    <Box
      role="status"
      aria-label="Ambiente de desenvolvimento"
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: theme.zIndex.modal + 2,
        height: DEV_BAR_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#5C6B4A',
        color: '#F4F7EF',
        letterSpacing: '0.14em',
      }}
    >
      <Typography
        component="span"
        sx={{ fontSize: fontSizes.xs, fontWeight: 700, lineHeight: 1 }}
      >
        DEV
      </Typography>
    </Box>
  );
}
