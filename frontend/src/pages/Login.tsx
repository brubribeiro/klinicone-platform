import { useEffect, useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { Alert, AlertTitle, Box, ButtonBase, CircularProgress, Link as MuiLink, Stack, Typography } from '@mui/material';
import { keyframes } from '@mui/system';
import { useGoogleLogin, useGoogleOAuth, type CodeResponse, type NonOAuthError } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import { AuroraIcon } from '../components/AuroraIcon';
import { APP_VERSION } from '../version';
import { fontSizes } from '../theme/fontSizes';
import { ExternalRedirect } from '../components/ExternalRedirect';
import { BRAND_LEGAL_NAME, BRAND_NAME, BRAND_TAGLINE } from '../brand';
import { KlinicOneMark, KlinicOneWordmark } from '../components/brand/KlinicOneLogo';
import { adminConsoleUrl } from '../utils/appUrls';
import { clearAuthNotice, readAuthNotice, tenantSuspendedMessage } from '../utils/authNotice';

const GOOGLE_SCRIPT_BLOCKED =
  'Não foi possível carregar o login do Google. Desative bloqueadores de anúncio neste site e recarregue a página.';
const GOOGLE_POPUP_BLOCKED =
  'O navegador bloqueou a janela do Google. Permita pop-ups neste site e clique em "Entrar com o Google" de novo.';
const GOOGLE_GENERIC_ERROR = 'Erro ao conectar com o Google. Tente novamente.';

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
      <KlinicOneMark size={48} sx={{ filter: 'drop-shadow(0 8px 14px rgba(15,124,123,.45))' }} />
      <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05, minWidth: 0 }}>
        <KlinicOneWordmark
          height={24}
          color={dark ? '#fff' : 'text.primary'}
          accentColor={dark ? '#5FD3C6' : undefined}
          sx={{ mb: '6px' }}
        />
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

function GoogleGIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51z"
      />
    </svg>
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
  const { scriptLoadedSuccessfully } = useGoogleOAuth();

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
  const adminEmail = import.meta.env.VITE_ADMIN_CONTACT_EMAIL ?? '';

  // Fluxo auth-code em popup: o backend troca o code (redirect_uri 'postmessage') e valida o id_token.
  const requestGoogleCode = useGoogleLogin({
    flow: 'auth-code',
    ux_mode: 'popup',
    select_account: true,
    onSuccess: (response) => void handleGoogleCode(response),
    onError: handleGoogleOAuthError,
    onNonOAuthError: handleGoogleNonOAuthError,
  });

  if (user) {
    if (user.panelSelectionPending) return <Navigate to="/escolher-painel" replace />;
    if (user.isSuperAdmin && !user.tenantId) {
      return <ExternalRedirect href={adminConsoleUrl('/clinicas')} />;
    }
    return <Navigate to="/" replace />;
  }

  function startGoogleLogin() {
    if (!googleClientId || submitting) return;
    setError(null);
    if (!scriptLoadedSuccessfully) {
      setError(GOOGLE_SCRIPT_BLOCKED);
      return;
    }
    requestGoogleCode();
  }

  async function handleGoogleCode(response: Pick<CodeResponse, 'code'>) {
    if (!response.code) return;
    setError(null);
    setSuspendedNotice(null);
    setSubmitting(true);
    try {
      const { needsPanelSelection } = await loginWithGoogle({ code: response.code });
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

  function handleGoogleOAuthError(response: Pick<CodeResponse, 'error'>) {
    // Usuário cancelou na tela de consentimento: não é erro.
    if (response.error === 'access_denied') return;
    setError(GOOGLE_GENERIC_ERROR);
  }

  function handleGoogleNonOAuthError(err: NonOAuthError) {
    if (err.type === 'popup_closed') return;
    setError(err.type === 'popup_failed_to_open' ? GOOGLE_POPUP_BLOCKED : GOOGLE_GENERIC_ERROR);
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
    <ButtonBase
      onClick={startGoogleLogin}
      disabled={!googleClientId || submitting}
      aria-busy={submitting}
      sx={{
        width: '100%',
        height: 56,
        borderRadius: '14px',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        color: 'text.primary',
        fontFamily: 'inherit',
        fontSize: fontSizes.lg,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        boxShadow: '0 2px 8px -2px rgba(16,40,37,.1)',
        transition: 'border-color .15s, box-shadow .15s',
        '&:hover': {
          borderColor: 'primary.main',
          boxShadow: '0 6px 20px -6px rgba(21,153,139,.4)',
        },
        '&.Mui-focusVisible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: 2,
        },
        '&.Mui-disabled': { opacity: googleClientId ? 1 : 0.55 },
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
        <>
          <GoogleGIcon />
          Entrar com o Google
        </>
      )}
    </ButtonBase>
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
