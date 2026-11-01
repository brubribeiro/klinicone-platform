import { useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Alert,
  Box,
  ButtonBase,
  CircularProgress,
  Stack,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';

import { useAuth } from '../contexts/AuthContext';
import { AuroraIcon } from '../components/AuroraIcon';
import { APP_VERSION } from '../version';
import { fontSizes } from '../theme/fontSizes';
import { adminConsoleUrl, clinicPanelUrl } from '../utils/appUrls';

const BRAND_BG = '#0E2926';

interface PanelChoiceProps {
  title: string;
  description: string;
  icon: ReactNode;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}

/** Card clicável — mesmo visual em repouso para clínica e plataforma (sem variant contained). */
function PanelChoiceButton({ title, description, icon, loading, disabled, onClick }: PanelChoiceProps) {
  const theme = useTheme();

  return (
    <ButtonBase
      onClick={onClick}
      disabled={disabled}
      focusRipple
      sx={{
        width: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        gap: 1.5,
        py: 1.75,
        px: 2,
        borderRadius: '14px',
        textAlign: 'left',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        color: 'text.primary',
        transition: theme.transitions.create(['border-color', 'background-color', 'box-shadow'], {
          duration: theme.transitions.duration.shorter,
        }),
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: alpha(theme.palette.primary.main, 0.06),
        },
        '&:active': {
          bgcolor: alpha(theme.palette.primary.main, 0.12),
        },
        '&.Mui-focusVisible': {
          borderColor: 'primary.main',
          outline: `2px solid ${alpha(theme.palette.primary.main, 0.35)}`,
          outlineOffset: 2,
        },
        '&.Mui-disabled': {
          opacity: 0.65,
          cursor: 'not-allowed',
        },
      }}
    >
      {loading ? <CircularProgress size={22} sx={{ mt: 0.25 }} /> : icon}
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: fontSizes.md, lineHeight: 1.35 }}>{title}</Typography>
        <Typography sx={{ fontWeight: 500, fontSize: fontSizes.xs, color: 'text.secondary', mt: 0.25 }}>
          {description}
        </Typography>
      </Box>
    </ButtonBase>
  );
}

/** Escolha entre painel da clínica e painel da plataforma (conta dual). */
export function ChoosePanel() {
  const { user, selectPanel } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<'clinic' | 'admin' | null>(null);

  if (!user) return <Navigate to="/login" replace />;
  if (!user.canChoosePanel) {
    if (user.isSuperAdmin && !user.tenantId) {
      window.location.replace(adminConsoleUrl('/clinicas'));
      return null;
    }
    return <Navigate to="/" replace />;
  }

  async function choose(panel: 'clinic' | 'admin') {
    setError(null);
    setLoading(panel);
    try {
      await selectPanel(panel);
      if (panel === 'admin') {
        window.location.href = adminConsoleUrl('/clinicas');
        return;
      }
      window.location.href = clinicPanelUrl('/');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Não foi possível abrir o painel. Tente novamente.';
      setError(message);
    } finally {
      setLoading(null);
    }
  }

  const year = new Date().getFullYear();
  const busy = loading !== null;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        background: `linear-gradient(155deg, ${BRAND_BG} 0%, #0E3F39 52%, #0E7C7B 130%)`,
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 440,
          p: { xs: 3, sm: 4 },
          borderRadius: '20px',
          bgcolor: 'background.paper',
          boxShadow: '0 24px 60px -20px rgba(0,0,0,.45)',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              background: 'linear-gradient(135deg,#22BBAA,#0E7C7B)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              flexShrink: 0,
            }}
            aria-hidden
          >
            <AuroraIcon name="dashboard" size={22} strokeWidth={2} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: fontSizes.xl, letterSpacing: '-0.3px' }}>
              Escolha o painel
            </Typography>
            <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary', fontWeight: 500 }}>
              Olá, {user.name.split(' ')[0]} — onde deseja entrar?
            </Typography>
          </Box>
        </Stack>

        <Stack spacing={1.5}>
          <PanelChoiceButton
            title="Painel da clínica"
            description="Agenda, pacientes e rotina do dia a dia"
            icon={<BusinessOutlinedIcon color="primary" sx={{ mt: 0.25 }} />}
            loading={loading === 'clinic'}
            disabled={busy}
            onClick={() => choose('clinic')}
          />
          <PanelChoiceButton
            title="Painel da plataforma"
            description="Clínicas, planos, catálogos e auditoria da plataforma"
            icon={<AdminPanelSettingsOutlinedIcon color="primary" sx={{ mt: 0.25 }} />}
            loading={loading === 'admin'}
            disabled={busy}
            onClick={() => choose('admin')}
          />
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        <Typography sx={{ mt: 3, textAlign: 'center', fontSize: fontSizes['2xs'], color: 'text.secondary' }}>
          © {year} Mila Barreto · v{APP_VERSION}
        </Typography>
      </Box>
    </Box>
  );
}
