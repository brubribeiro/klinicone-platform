import { Box, Typography, Link as MuiLink, alpha } from '@mui/material';
import { Link } from 'react-router-dom';
import { AuroraIcon } from '../components/AuroraIcon';
import { fontSizes } from '../theme/fontSizes';
import { BRAND_NAME } from '../brand';
import { PrivacyPolicyContent, PRIVACY_LAST_UPDATED } from '../legal/PrivacyPolicyContent';
import type { LegalPageProps } from '../legal/legalPageProps';

export type { LegalPageProps };

const CONTENT_SX = { width: '100%', px: { xs: 2.5, sm: 4 } };

export function PrivacyPolicy({
  backTo = '/login',
  backLabel = 'Voltar ao login',
}: LegalPageProps = {}) {
  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', color: 'text.primary' }}>
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: (t) => alpha(t.palette.background.default, 0.85),
          backdropFilter: 'blur(12px)',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box
          sx={{
            ...CONTENT_SX,
            py: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '11px',
                background: 'linear-gradient(135deg,#22BBAA,#0E7C7B)',
                boxShadow: '0 6px 16px -4px rgba(15,124,123,.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="21" height="21" viewBox="0 0 24 24" fill="#fff">
                <path d="M12 3c4.2 5 6.2 8.2 6.2 11.2A6.2 6.2 0 0 1 5.8 14.2C5.8 11.2 7.8 8 12 3z" />
              </svg>
            </Box>
            <Typography noWrap sx={{ fontWeight: 800, fontSize: fontSizes['2xl'], letterSpacing: '-0.4px' }}>
              {BRAND_NAME}
            </Typography>
          </Box>
          <MuiLink
            component={Link}
            to={backTo}
            underline="none"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexShrink: 0,
              height: 40,
              px: 2,
              borderRadius: '11px',
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              color: 'text.secondary',
              fontSize: fontSizes.sm,
              fontWeight: 700,
              '&:hover': { borderColor: 'primary.main', color: 'primary.dark' },
            }}
          >
            <AuroraIcon name="chevronLeft" size={16} strokeWidth={2.2} />
            {backLabel}
          </MuiLink>
        </Box>
      </Box>

      <Box component="main" sx={{ ...CONTENT_SX, pt: { xs: 4, sm: 6 }, pb: { xs: 6, sm: 10 } }}>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            mb: 2.5,
            px: 1.625,
            py: 0.75,
            borderRadius: '8px',
            border: 1,
            borderColor: (t) => alpha(t.palette.primary.main, 0.17),
            bgcolor: (t) => alpha(t.palette.primary.main, 0.09),
            color: 'primary.main',
            fontSize: fontSizes.xs,
            fontWeight: 800,
            letterSpacing: '0.4px',
            textTransform: 'uppercase',
          }}
        >
          Documento legal
        </Box>
        <Typography
          component="h1"
          sx={{ mb: 1.5, fontSize: { xs: fontSizes['6xl'], sm: '2.25rem' }, fontWeight: 800, letterSpacing: '-1px' }}
        >
          Política de Privacidade
        </Typography>
        <Typography sx={{ mb: { xs: 3, sm: 5 }, fontSize: fontSizes.md, fontWeight: 500, color: 'text.secondary' }}>
          Última atualização: {PRIVACY_LAST_UPDATED}
        </Typography>

        <Box
          sx={{
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: '20px',
            px: { xs: 2.5, sm: 5.5 },
            py: { xs: 3, sm: 5 },
            boxShadow: '0 1px 2px rgba(16,40,37,.04),0 8px 24px -12px rgba(16,40,37,.10)',
          }}
        >
          <PrivacyPolicyContent />
        </Box>

        <Typography sx={{ mt: 4, textAlign: 'center', fontSize: fontSizes.sm, fontWeight: 500, color: 'grey.400' }}>
          © {new Date().getFullYear()} {BRAND_NAME} ·{' '}
          <MuiLink component={Link} to="/termos" underline="none" sx={{ color: 'text.secondary', fontWeight: 700 }}>
            Termos de Uso
          </MuiLink>
        </Typography>
      </Box>
    </Box>
  );
}
