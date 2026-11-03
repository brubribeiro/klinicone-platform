import { Box, Button, Card, Typography, Link as MuiLink } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Link } from 'react-router-dom';
import { AuroraIcon } from '../components/AuroraIcon';
import { fontSizes } from '../theme/fontSizes';
import { BRAND_NAME } from '../brand';
import { TERMS_LAST_UPDATED, TERMS_SECTIONS } from '../legal/termsSections';
import type { LegalPageProps } from '../legal/legalPageProps';

export type { LegalPageProps };

export function TermsOfUse({
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
            width: '100%',
            px: { xs: 2, sm: 4 },
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
                flexShrink: 0,
                borderRadius: '11px',
                background: (t) => `linear-gradient(135deg, #22BBAA, ${t.palette.primary.dark})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: (t) => `0 6px 16px -4px ${alpha(t.palette.primary.dark, 0.5)}`,
              }}
            >
              <svg width="21" height="21" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                <path d="M12 3c4.2 5 6.2 8.2 6.2 11.2A6.2 6.2 0 0 1 5.8 14.2C5.8 11.2 7.8 8 12 3z" />
              </svg>
            </Box>
            <Typography noWrap sx={{ fontWeight: 800, fontSize: fontSizes['2xl'], letterSpacing: '-0.4px' }}>
              {BRAND_NAME}
            </Typography>
          </Box>
          <Button
            component={Link}
            to={backTo}
            variant="outlined"
            startIcon={<AuroraIcon name="chevronLeft" size={16} strokeWidth={2.2} />}
            sx={{
              flexShrink: 0,
              height: 40,
              px: 2,
              borderRadius: '11px',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              color: 'text.secondary',
              fontSize: fontSizes.sm,
              '&:hover': { borderColor: 'primary.main', bgcolor: 'background.paper', color: 'primary.main' },
            }}
          >
            {backLabel}
          </Button>
        </Box>
      </Box>

      <Box
        component="main"
        sx={{
          width: '100%',
          px: { xs: 2, sm: 4 },
          pt: { xs: 4, sm: 6 },
          pb: { xs: 6, sm: 10 },
        }}
      >
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: fontSizes.xs,
            fontWeight: 800,
            color: 'primary.main',
            bgcolor: (t) => alpha(t.palette.primary.main, 0.09),
            border: '1px solid',
            borderColor: (t) => alpha(t.palette.primary.main, 0.17),
            px: 1.625,
            py: 0.75,
            borderRadius: '8px',
            letterSpacing: '0.4px',
            textTransform: 'uppercase',
            mb: 2.5,
          }}
        >
          Documento legal
        </Box>
        <Typography
          component="h1"
          sx={{ m: 0, mb: 1.5, fontSize: { xs: fontSizes['6xl'], sm: fontSizes['7xl'] }, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.2 }}
        >
          Termos de Uso
        </Typography>
        <Typography sx={{ mb: { xs: 3, sm: 5 }, fontSize: fontSizes.md, color: 'text.secondary', fontWeight: 500 }}>
          Última atualização: {TERMS_LAST_UPDATED}
        </Typography>

        <Card sx={{ borderRadius: '20px', px: { xs: 2.5, sm: 5.5 }, py: { xs: 3, sm: 5 } }}>
          {TERMS_SECTIONS.map((section, i) => (
            <Box key={section.title} sx={{ mb: i === TERMS_SECTIONS.length - 1 ? 0 : 3.5 }}>
              <Typography
                component="h2"
                sx={{ mb: 1.5, fontSize: fontSizes['2xl'], fontWeight: 800, letterSpacing: '-0.3px' }}
              >
                {section.title}
              </Typography>
              <Typography sx={{ fontSize: fontSizes.lg, lineHeight: 1.7, color: 'grey.700' }}>{section.body}</Typography>
            </Box>
          ))}
        </Card>

        <Typography sx={{ mt: 4, textAlign: 'center', fontSize: fontSizes.sm, color: 'text.disabled', fontWeight: 500 }}>
          © {new Date().getFullYear()} {BRAND_NAME} ·{' '}
          <MuiLink
            component={Link}
            to="/privacidade"
            underline="none"
            sx={{ color: 'text.secondary', fontWeight: 700, '&:hover': { color: 'primary.main' } }}
          >
            Política de Privacidade
          </MuiLink>
        </Typography>
      </Box>
    </Box>
  );
}
