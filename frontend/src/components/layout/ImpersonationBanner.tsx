import { Box, Typography, useTheme } from '@mui/material';
import SwitchAccountIcon from '@mui/icons-material/SwitchAccount';

import { fontSizes } from '../../theme/fontSizes';

interface ImpersonationBannerProps {
  userName?: string;
  onStop: () => void;
  stopLabel?: string;
  /** Deslocamento do topo (ex.: faixa DEV). */
  top?: number;
}

/** Faixa fixa no topo enquanto o admin visualiza o sistema como outro usuário. */
export function ImpersonationBanner({
  userName,
  onStop,
  stopLabel = 'Voltar à minha conta',
  top = 0,
}: ImpersonationBannerProps) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        position: 'fixed',
        top,
        left: 0,
        right: 0,
        zIndex: theme.zIndex.modal + 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        py: 0.75,
        px: 2,
        bgcolor: '#C25A4C',
        color: '#fff',
      }}
    >
      <SwitchAccountIcon sx={{ fontSize: 20 }} />
      <Typography variant="body2" fontWeight={600}>
        Você está visualizando como {userName}
      </Typography>
      <Box
        component="button"
        onClick={onStop}
        sx={{
          ml: 1,
          px: 2,
          py: 0.5,
          border: '1px solid rgba(255,255,255,0.6)',
          borderRadius: 1.5,
          bgcolor: 'transparent',
          color: '#fff',
          cursor: 'pointer',
          fontSize: fontSizes.sm,
          fontWeight: 600,
          '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
        }}
      >
        {stopLabel}
      </Box>
    </Box>
  );
}
