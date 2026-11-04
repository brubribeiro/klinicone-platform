import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { Alert, AlertTitle, Box, CircularProgress, Link as MuiLink, Stack, Typography, useTheme } from '@mui/material';
import { keyframes } from '@mui/system';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import { AuroraIcon } from '../components/AuroraIcon';
import { APP_VERSION } from '../version';
import { fontSizes } from '../theme/fontSizes';
import { ExternalRedirect } from '../components/ExternalRedirect';
import { BRAND_LEGAL_NAME, BRAND_NAME, BRAND_TAGLINE } from '../brand';
import { adminConsoleUrl } from '../utils/appUrls';
import { clearAuthNotice, readAuthNotice, tenantSuspendedMessage } from '../utils/authNotice';

/** Dica quando o botão GSI não monta ou o popup/FedCM falha (bloqueadores, pop-ups). */
const GOOGLE_BUTTON_HELP =
  'Não abre? Desative bloqueadores de anúncio ou permita pop-ups neste site.';

// Painel de marca Aurora (mesmo verde-escuro do menu lateral)
const BRAND_BG = '#0E2926';
const BRAND_TAGLINE_COLOR = '#8FAAA4';
const BRAND_SUBTITLE = '#A9C4BE';
const BRAND_FOOTER = '#7C928D';
const TEXT_SOFT = '#94A4A0';
const LINK_UNDERLINE = '#C9D6D2';

const auroraFloat = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(14px, -22px) scale(1.06); }
`;
const auroraFloat2 = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(-18px, 16px) scale(1.08); }
`;

function BrandLogo({ dark = false }: { dark?: boolean }) {
  return (
    <Stack direction="row" alignItems="center" sx={{ gap: '14px' }}>
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: '14px',
          background: 'linear-gradient(135deg,#22BBAA,#0E7C7B)',
          boxShadow: '0 8px 22px -4px rgba(15,124,123,.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
          <path d="M12 3c4.2 5 6.2 8.2 6.2 11.2A6.2 6.2 0 0 1 5.8 14.2C5.8 11.2 7.8 8 12 3z" />
        </svg>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05, minWidth: 0 }}>
        <Box
          component="span"
          sx={{
            fontWeight: 800,
            fontSize: fontSizes['3xl'],
            letterSpacing: '-0.4px',
            color: dark ? '#fff' : 'text.primary',
          }}
        >
          {BRAND_NAME}
        </Box>
        <Box
          component="span"
          sx={{
            fontWeight: 700,
            fontSize: fontSizes['3xs'],
            letterSpacing: '1.6px',
            textTransform: 'uppercase',
            color: dark ? BRAND_TAGLINE_COLOR : 'text.secondary',
          }}
        >
          {BRAND_TAGLINE}
        </Box>
      </Box>
    </Stack>
  );
}

export function Login() {
  const { user, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  // Clínica suspensa: vem da sessão derrubada (interceptor) ou da tentativa de login
  const [suspendedNotice, setSuspendedNotice] = useState<string | null>(readAuthNotice);
  useEffect(clearAuthNotice, []);
  const [submitting, setSubmitting] = useState(false);
  const [googleHelp, setGoogleHelp] = useState<string | null>(null);
  const googleBtnHostRef = useRef<HTMLDivElement>(null);
  const isDark = useTheme().palette.mode === 'dark';
  // O GSI aceita largura de 200 a 400 px; acompanha o container.
  const [googleBtnWidth, setGoogleBtnWidth] = useState(376);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
  const adminEmail = import.meta.env.VITE_ADMIN_CONTACT_EMAIL ?? '';

  // Se o iframe/botão oficial do Google não aparecer em ~3 s, orientar sobre bloqueadores/pop-ups.
  useEffect(() => {
    if (!googleClientId || submitting || user) {
      setGoogleHelp(null);
      return;
    }
    setGoogleHelp(null);
    const timer = window.setTimeout(() => {
      const host = googleBtnHostRef.current;
      const rendered = Boolean(
        host?.querySelector('iframe, div[role="button"], [data-is-touch-wrapper]'),
      );
      if (!rendered) setGoogleHelp(GOOGLE_BUTTON_HELP);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [googleClientId, submitting, user]);

  useEffect(() => {
    const host = googleBtnHostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const w = Math.floor(host.getBoundingClientRect().width);
      if (w > 0) setGoogleBtnWidth(Math.min(400, Math.max(200, w)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(host);
    return () => ro.disconnect();
  }, [googleClientId, submitting, user]);

  if (user) {
    if (user.panelSelectionPending) return <Navigate to="/escolher-painel" replace />;
    if (user.isSuperAdmin && !user.tenantId) {
      return <ExternalRedirect href={adminConsoleUrl('/clinicas')} />;
    }
    return <Navigate to="/" replace />;
  }

  async function handleGoogleSuccess(response: CredentialResponse) {
    if (!response.credential) return;
    setError(null);
    setGoogleHelp(null);
    setSuspendedNotice(null);
    setSubmitting(true);
    try {
      const { needsPanelSelection } = await loginWithGoogle(response.credential);
      if (needsPanelSelection) navigate('/escolher-painel');
      else navigate('/', { replace: true });
    } catch (err: any) {
      const suspended = tenantSuspendedMessage(err);
      if (suspended) {
        setSuspendedNotice(suspended);
        return;
      }
      setError(
        err?.response?.data?.message ??
          'Falha ao autenticar com Google. Verifique se seu e-mail está cadastrado.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleGoogleError() {
    setError(`Erro ao conectar com o Google. ${GOOGLE_BUTTON_HELP}`);
  }

  const year = new Date().getFullYear();

  const brandingPanel = (
    <Box
      sx={{
        flex: 1.05,
        position: 'relative',
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 6,
        p: '54px 56px',
        background: `linear-gradient(155deg, ${BRAND_BG} 0%, #0E3F39 52%, #0E7C7B 130%)`,
        overflow: 'hidden',
        '@media (prefers-reduced-motion: reduce)': {
          '& .aurora-orb': { animation: 'none' },
        },
      }}
    >
      <Box
        className="aurora-orb"
        sx={{
          position: 'absolute',
          width: 440,
          height: 440,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, rgba(55,207,190,.42), transparent 68%)',
          top: -120,
          right: -90,
          filter: 'blur(18px)',
          animation: `${auroraFloat} 13s ease-in-out infinite`,
        }}
      />
      <Box
        className="aurora-orb"
        sx={{
          position: 'absolute',
          width: 380,
          height: 380,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 50%, rgba(21,153,139,.4), transparent 70%)',
          bottom: -130,
          left: -80,
          filter: 'blur(20px)',
          animation: `${auroraFloat2} 16s ease-in-out infinite`,
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(rgba(255,255,255,.045) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
        }}
      />

      <Box sx={{ position: 'relative' }}>
        <BrandLogo dark />
      </Box>

      <Box sx={{ position: 'relative', maxWidth: 430 }}>
        <Typography
          component="h1"
          sx={{
            m: '0 0 18px',
            fontSize: fontSizes['8xl'],
            lineHeight: 1.16,
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '-1px',
            textWrap: 'balance',
            // 430px a 38px do design: em em, para quebrar igual quando a fonte raiz encolhe
            maxWidth: '11.3em',
          }}
        >
          A gestão completa da sua clínica em um só lugar.
        </Typography>
        <Typography sx={{ fontSize: fontSizes.lg, lineHeight: 1.6, color: BRAND_SUBTITLE, fontWeight: 500 }}>
          Agenda, prontuários, financeiro e estoque — tudo conectado, com a inteligência que a sua
          estética merece.
        </Typography>
      </Box>

      <Typography sx={{ position: 'relative', fontSize: fontSizes.xs, color: BRAND_FOOTER, fontWeight: 500 }}>
        © {year} {BRAND_LEGAL_NAME} · Todos os direitos reservados · v{APP_VERSION}
      </Typography>
    </Box>
  );

  const googleButton = (
    <Box
      sx={{
        position: 'relative',
        minHeight: 56,
        borderRadius: '14px',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        color: 'text.primary',
        fontSize: fontSizes.lg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        p: '8px',
        opacity: googleClientId ? 1 : 0.55,
        boxShadow: '0 2px 8px -2px rgba(16,40,37,.1)',
      }}
    >
      {submitting ? (
        <>
          <CircularProgress size={20} />
          <Box component="span" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            Verificando acesso...
          </Box>
        </>
      ) : (
        googleClientId && (
          // Botão oficial do Google, visível: o backend valida o ID token recebido em onSuccess.
          <Box ref={googleBtnHostRef} sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              ux_mode="popup"
              use_fedcm_for_button={false}
              theme={isDark ? 'filled_black' : 'outline'}
              text="signin_with"
              shape="rectangular"
              size="large"
              width={String(googleBtnWidth)}
              locale="pt-BR"
            />
          </Box>
        )
      )}
    </Box>
  );

  const loginPanel = (
    <Box
      sx={{
        flex: 0.95,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        p: { xs: 3, sm: 5 },
        bgcolor: 'background.default',
      }}
    >
      <Box sx={{ display: { xs: 'block', md: 'none' }, width: '100%', maxWidth: 392 }}>
        <BrandLogo />
      </Box>

      <Box sx={{ width: '100%', maxWidth: 392, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ mb: '34px' }}>
          <Typography
            component="h2"
            sx={{ m: '0 0 9px', fontSize: fontSizes['6xl'], fontWeight: 800, color: 'text.primary', letterSpacing: '-0.6px' }}
          >
            Bem-vindo de volta
          </Typography>
          <Typography sx={{ fontSize: fontSizes.md, color: 'text.secondary', fontWeight: 500, lineHeight: 1.5 }}>
            Acesse a plataforma com sua conta Google corporativa.
          </Typography>
        </Box>

        {googleButton}

        {!googleClientId && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Configure <strong>VITE_GOOGLE_CLIENT_ID</strong> no arquivo .env para habilitar o login.
          </Alert>
        )}

        {suspendedNotice && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <AlertTitle>Clínica suspensa</AlertTitle>
            {suspendedNotice}
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {googleHelp && !error && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {googleHelp}
          </Alert>
        )}

        <Stack
          direction="row"
          alignItems="center"
          sx={{
            gap: '10px',
            mt: '22px',
            p: '13px 15px',
            borderRadius: '12px',
            bgcolor: 'grey.50',
            border: '1px solid',
            borderColor: 'divider',
            color: 'primary.main',
          }}
        >
          <Box sx={{ display: 'flex', flexShrink: 0 }}>
            <AuroraIcon name="lock" size={17} strokeWidth={2} />
          </Box>
          <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', fontWeight: 500, lineHeight: 1.45 }}>
            Acesso exclusivo por conta Google autorizada pela clínica.
          </Typography>
        </Stack>

        <Typography
          sx={{ mt: '26px', textAlign: 'center', fontSize: fontSizes.sm, color: 'text.secondary', fontWeight: 500 }}
        >
          Não tem acesso?{' '}
          {adminEmail ? (
            <MuiLink href={`mailto:${adminEmail}`} underline="none" sx={{ color: 'primary.main', fontWeight: 700 }}>
              Fale com o administrador
            </MuiLink>
          ) : (
            <Box component="span" sx={{ color: 'text.primary', fontWeight: 700 }}>
              Fale com o administrador da clínica.
            </Box>
          )}
        </Typography>

        <Typography
          sx={{
            mt: '22px',
            textAlign: 'center',
            fontSize: fontSizes.xs,
            color: TEXT_SOFT,
            fontWeight: 500,
            lineHeight: 1.6,
            '& a': {
              color: 'text.secondary',
              fontWeight: 700,
              textDecoration: 'none',
              borderBottom: `1px solid ${LINK_UNDERLINE}`,
            },
          }}
        >
          Ao entrar, você concorda com os{' '}
          <MuiLink component={Link} to="/termos">
            Termos de Uso
          </MuiLink>{' '}
          e a{' '}
          <MuiLink component={Link} to="/privacidade">
            Política de Privacidade
          </MuiLink>
          .
        </Typography>
      </Box>

      <Typography
        sx={{ display: { xs: 'block', md: 'none' }, fontSize: fontSizes.xs, color: TEXT_SOFT, textAlign: 'center' }}
      >
        © {year} {BRAND_NAME} · v{APP_VERSION}
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', width: '100%', bgcolor: 'background.default' }}>
      {brandingPanel}
      {loginPanel}
    </Box>
  );
}
