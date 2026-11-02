import { useState, type ReactNode } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Container,
  IconButton,
  Link as MuiLink,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import { keyframes } from '@mui/system';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MenuIcon from '@mui/icons-material/Menu';
import { useQuery } from '@tanstack/react-query';

import { publicApi } from '../../../../frontend/src/api/public';
import { AuroraIcon } from '../../../../frontend/src/components/AuroraIcon';
import { LandingHeroPreview } from '../components/LandingHeroPreview';
import { LandingPlans } from '../components/LandingPlans';
import { LandingVideo } from '../components/LandingVideo';
import {
  AUDIENCE,
  BENEFITS,
  BRAND_NAME,
  BRAND_TAGLINE,
  FAQ,
  HERO,
  MODULES,
  MORE_FEATURES,
  STEPS,
  type LandingModule,
} from '../components/landingContent';
import { fontSizes } from '../../../../frontend/src/theme/fontSizes';
import { clinicPanelUrl } from '../../../../frontend/src/utils/appUrls';
import { APP_VERSION } from '../../../../frontend/src/version';

// Mesmo verde-escuro do menu lateral e do painel de marca do login
const BRAND_BG = '#0E2926';
const BRAND_SUBTITLE = '#A9C4BE';
const BRAND_MUTED = '#8FAAA4';

const auroraFloat = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(14px, -22px) scale(1.06); }
`;
const auroraFloat2 = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(-18px, 16px) scale(1.08); }
`;

const contactEmail = import.meta.env.VITE_ADMIN_CONTACT_EMAIL?.trim() ?? '';

/** mailto para o e-mail de contato da plataforma; null sem `VITE_ADMIN_CONTACT_EMAIL`. */
function contactHref(subject: string): string | null {
  if (!contactEmail) return null;
  const body = 'Olá! Tenho interesse na plataforma.\n\nNome:\nClínica:\nCidade:\nTelefone/WhatsApp:\n';
  return `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const loginHref = clinicPanelUrl('/login');

function BrandLogo() {
  return (
    <Stack direction="row" alignItems="center" sx={{ gap: '12px' }}>
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: '12px',
          background: 'linear-gradient(135deg,#22BBAA,#0E7C7B)',
          boxShadow: '0 4px 12px -4px rgba(15,124,123,.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
          <path d="M12 3c4.2 5 6.2 8.2 6.2 11.2A6.2 6.2 0 0 1 5.8 14.2C5.8 11.2 7.8 8 12 3z" />
        </svg>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
        <Box component="span" sx={{ fontWeight: 800, fontSize: fontSizes['2xl'], color: '#fff', letterSpacing: '-0.3px' }}>
          {BRAND_NAME}
        </Box>
        <Box
          component="span"
          sx={{
            fontWeight: 700,
            fontSize: fontSizes['3xs'],
            letterSpacing: '1.4px',
            textTransform: 'uppercase',
            color: BRAND_MUTED,
          }}
        >
          {BRAND_TAGLINE}
        </Box>
      </Box>
    </Stack>
  );
}

function SectionTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <Box sx={{ textAlign: 'center', maxWidth: 640, mx: 'auto', mb: { xs: 4, md: 6 } }}>
      <Typography
        sx={{
          fontSize: fontSizes.xs,
          fontWeight: 800,
          letterSpacing: '1.4px',
          textTransform: 'uppercase',
          color: 'primary.main',
          mb: 1,
        }}
      >
        {eyebrow}
      </Typography>
      <Typography
        component="h2"
        sx={{
          fontSize: { xs: fontSizes['6xl'], md: fontSizes['8xl'] },
          fontWeight: 800,
          letterSpacing: '-0.8px',
          lineHeight: 1.2,
          textWrap: 'balance',
        }}
      >
        {title}
      </Typography>
      {subtitle && (
        <Typography sx={{ mt: 1.5, color: 'text.secondary', fontSize: fontSizes.xl, lineHeight: 1.6 }}>{subtitle}</Typography>
      )}
    </Box>
  );
}

function Section({ id, children, tinted = false }: { id?: string; children: ReactNode; tinted?: boolean }) {
  return (
    <Box
      component="section"
      id={id}
      sx={{ py: { xs: 8, md: 12 }, bgcolor: tinted ? 'background.paper' : 'background.default', scrollMarginTop: 72 }}
    >
      <Container maxWidth="lg">{children}</Container>
    </Box>
  );
}

function IconBadge({ name }: { name: Parameters<typeof AuroraIcon>[0]['name'] }) {
  return (
    <Box
      sx={{
        width: 44,
        height: 44,
        borderRadius: '12px',
        bgcolor: 'primary.main',
        backgroundImage: 'linear-gradient(135deg,#22BBAA,#0E7C7B)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <AuroraIcon name={name} size={22} />
    </Box>
  );
}

function ModuleRow({ module, reverse }: { module: LandingModule; reverse: boolean }) {
  return (
    <Box
      id={`modulo-${module.id}`}
      sx={{
        display: 'grid',
        gap: { xs: 3, md: 7 },
        gridTemplateColumns: { xs: '1fr', md: reverse ? '1fr 1.35fr' : '1.35fr 1fr' },
        alignItems: 'center',
        scrollMarginTop: 88,
      }}
    >
      <Box sx={{ order: { md: reverse ? 2 : 1 }, minWidth: 0 }}>
        <LandingVideo name={module.video} label={`Vídeo: ${module.title} no painel, com dados fictícios`} />
      </Box>
      <Box sx={{ order: { md: reverse ? 1 : 2 } }}>
        <IconBadge name={module.icon} />
        <Typography component="h3" sx={{ mt: 2, fontWeight: 800, fontSize: { xs: fontSizes['4xl'], md: fontSizes['5xl'] }, letterSpacing: '-0.4px' }}>
          {module.title}
        </Typography>
        <Typography sx={{ mt: 1, color: 'text.secondary', fontSize: fontSizes.xl, lineHeight: 1.6 }}>{module.text}</Typography>
        <Stack component="ul" spacing={1.25} sx={{ listStyle: 'none', p: 0, m: 0, mt: 2.5 }}>
          {module.points.map((point) => (
            <Stack component="li" key={point} direction="row" spacing={1.25} alignItems="flex-start">
              <CheckRoundedIcon sx={{ color: 'primary.main', fontSize: 20, mt: '2px', flexShrink: 0 }} />
              <Typography sx={{ fontSize: fontSizes.lg, lineHeight: 1.5 }}>{point}</Typography>
            </Stack>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}

/**
 * Landing pública de divulgação (`/`, fora do painel em `/painel`): sem login, sem chamadas
 * de sessão. Só lê os planos ativos (`GET /public/plans`); sem planos, a seção some.
 */
export function Landing() {
  const { data: plans = [] } = useQuery({
    queryKey: ['public', 'plans'],
    queryFn: publicApi.listPlans,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const hasPlans = plans.length > 0;
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const mainContact = contactHref(`Quero conhecer o ${BRAND_NAME}`);
  const year = new Date().getFullYear();

  const navLinks = [
    { href: '#funcionalidades', label: 'Módulos' },
    { href: '#como-funciona', label: 'Como funciona' },
    { href: '#para-quem', label: 'Para quem' },
    ...(hasPlans ? [{ href: '#planos', label: 'Planos' }] : []),
    { href: '#faq', label: 'Dúvidas' },
    { href: '#contato', label: 'Contato' },
  ];

  return (
    <Box sx={{ bgcolor: 'background.default', color: 'text.primary', minHeight: '100vh' }}>
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: 'rgba(14,41,38,.92)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255,255,255,.06)',
        }}
      >
        <Container maxWidth="lg">
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ height: 68 }}>
            <MuiLink href="#inicio" underline="none" aria-label={`${BRAND_NAME} — início`}>
              <BrandLogo />
            </MuiLink>
            <Stack component="nav" direction="row" spacing={3} sx={{ display: { xs: 'none', lg: 'flex' } }}>
              {navLinks.map((l) => (
                <MuiLink
                  key={l.href}
                  href={l.href}
                  underline="none"
                  sx={{ color: BRAND_SUBTITLE, fontWeight: 600, fontSize: fontSizes.md, '&:hover': { color: '#fff' } }}
                >
                  {l.label}
                </MuiLink>
              ))}
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button href={loginHref} sx={{ color: '#fff', fontWeight: 700, '&:hover': { bgcolor: 'rgba(255,255,255,.08)' } }}>
                Entrar
              </Button>
              {mainContact && (
                <Button href={mainContact} variant="contained" sx={{ display: { xs: 'none', sm: 'inline-flex' }, borderRadius: '10px' }}>
                  Falar com a gente
                </Button>
              )}
              <IconButton
                aria-label="Abrir menu"
                aria-controls={menuAnchor ? 'landing-menu' : undefined}
                aria-expanded={Boolean(menuAnchor)}
                onClick={(e) => setMenuAnchor(e.currentTarget)}
                sx={{ display: { lg: 'none' }, color: '#fff' }}
              >
                <MenuIcon />
              </IconButton>
              <Menu
                id="landing-menu"
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                {navLinks.map((l) => (
                  <MenuItem key={l.href} component="a" href={l.href} onClick={() => setMenuAnchor(null)}>
                    {l.label}
                  </MenuItem>
                ))}
                {mainContact && (
                  <MenuItem component="a" href={mainContact} sx={{ color: 'primary.main', fontWeight: 700 }}>
                    Falar com a gente
                  </MenuItem>
                )}
              </Menu>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Box
        component="section"
        id="inicio"
        sx={{
          position: 'relative',
          overflow: 'hidden',
          background: `linear-gradient(155deg, ${BRAND_BG} 0%, #0E3F39 55%, #0E7C7B 140%)`,
          pt: { xs: 7, md: 11 },
          pb: { xs: 12, md: 14 },
          '@media (prefers-reduced-motion: reduce)': { '& .aurora-orb': { animation: 'none' } },
        }}
      >
        <Box
          className="aurora-orb"
          sx={{
            position: 'absolute',
            width: 520,
            height: 520,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, rgba(55,207,190,.38), transparent 68%)',
            top: -160,
            right: -120,
            filter: 'blur(18px)',
            animation: `${auroraFloat} 13s ease-in-out infinite`,
          }}
        />
        <Box
          className="aurora-orb"
          sx={{
            position: 'absolute',
            width: 420,
            height: 420,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 50% 50%, rgba(21,153,139,.38), transparent 70%)',
            bottom: -170,
            left: -110,
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
        <Container maxWidth="lg" sx={{ position: 'relative' }}>
          <Box
            sx={{
              display: 'grid',
              gap: { xs: 7, md: 6 },
              gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' },
              alignItems: 'center',
            }}
          >
            <Box>
              <Box
                sx={{
                  display: 'inline-block',
                  px: 1.5,
                  py: 0.5,
                  mb: 2.5,
                  borderRadius: '999px',
                  border: '1px solid rgba(143,170,164,.35)',
                  color: BRAND_SUBTITLE,
                  fontSize: fontSizes.xs,
                  fontWeight: 700,
                }}
              >
                {HERO.eyebrow}
              </Box>
              <Typography
                component="h1"
                sx={{
                  fontSize: { xs: fontSizes['7xl'], md: fontSizes['9xl'] },
                  lineHeight: 1.12,
                  fontWeight: 800,
                  color: '#fff',
                  letterSpacing: '-1.2px',
                  textWrap: 'balance',
                }}
              >
                {HERO.title}
              </Typography>
              <Typography
                sx={{ mt: 2.5, fontSize: { xs: fontSizes.xl, md: fontSizes['2xl'] }, lineHeight: 1.6, color: BRAND_SUBTITLE, maxWidth: 540 }}
              >
                {HERO.subtitle}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 4 }}>
                {mainContact && (
                  <Button href={mainContact} variant="contained" size="large" sx={{ height: 50, px: 3.5, borderRadius: '12px', fontSize: fontSizes.lg }}>
                    Falar com a gente
                  </Button>
                )}
                <Button
                  href={loginHref}
                  variant="outlined"
                  size="large"
                  sx={{
                    height: 50,
                    px: 3.5,
                    borderRadius: '12px',
                    fontSize: fontSizes.lg,
                    color: '#fff',
                    borderColor: 'rgba(255,255,255,.35)',
                    '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,.06)' },
                  }}
                >
                  Já sou cliente · Entrar
                </Button>
              </Stack>
            </Box>
            <LandingHeroPreview />
          </Box>
        </Container>
      </Box>

      <Section>
        <SectionTitle
          eyebrow="Por que usar"
          title="Menos planilha, mais tempo para atender"
          subtitle="Tudo o que a clínica precisa no dia a dia, conectado: o agendamento alimenta a ficha, o financeiro e as métricas."
        />
        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' } }}>
          {BENEFITS.map((b) => (
            <Box
              key={b.title}
              sx={{ p: 3, borderRadius: '18px', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
            >
              <IconBadge name={b.icon} />
              <Typography component="h3" sx={{ mt: 2, fontWeight: 800, fontSize: fontSizes['2xl'] }}>
                {b.title}
              </Typography>
              <Typography sx={{ mt: 1, color: 'text.secondary', fontSize: fontSizes.md, lineHeight: 1.6 }}>{b.text}</Typography>
            </Box>
          ))}
        </Box>
      </Section>

      <Section id="funcionalidades" tinted>
        <SectionTitle
          eyebrow="Módulos"
          title="Veja a plataforma funcionando"
          subtitle="Vídeos curtos do painel, gravados com dados fictícios. Os módulos variam conforme o plano, e cada pessoa da equipe vê o que o grupo dela permite."
        />
        <Stack spacing={{ xs: 8, md: 12 }}>
          {MODULES.map((m, i) => (
            <ModuleRow key={m.id} module={m} reverse={i % 2 === 1} />
          ))}
        </Stack>
        <Typography component="h3" sx={{ mt: { xs: 10, md: 14 }, mb: 3, textAlign: 'center', fontWeight: 800, fontSize: fontSizes['4xl'] }}>
          E ainda
        </Typography>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' } }}>
          {MORE_FEATURES.map((f) => (
            <Stack
              key={f.title}
              direction="row"
              spacing={2}
              sx={{ p: 2.5, borderRadius: '16px', bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}
            >
              <Box sx={{ color: 'primary.main', pt: 0.25 }}>
                <AuroraIcon name={f.icon} size={24} />
              </Box>
              <Box>
                <Typography component="h4" sx={{ fontWeight: 800, fontSize: fontSizes.xl }}>
                  {f.title}
                </Typography>
                <Typography sx={{ mt: 0.5, color: 'text.secondary', fontSize: fontSizes.md, lineHeight: 1.55 }}>{f.text}</Typography>
              </Box>
            </Stack>
          ))}
        </Box>
      </Section>

      <Section id="como-funciona">
        <SectionTitle
          eyebrow="Como funciona"
          title="Do primeiro contato à equipe atendendo"
          subtitle="Sem instalação e sem migração complicada: a clínica começa a usar no navegador."
        />
        <Box component="ol" sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, listStyle: 'none', p: 0, m: 0 }}>
          {STEPS.map((step, i) => (
            <Box component="li" key={step.title} sx={{ p: 3, borderRadius: '18px', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
              <Box
                aria-hidden="true"
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  backgroundImage: 'linear-gradient(135deg,#22BBAA,#0E7C7B)',
                  color: '#fff',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {i + 1}
              </Box>
              <Typography component="h3" sx={{ mt: 2, fontWeight: 800, fontSize: fontSizes['2xl'] }}>
                {step.title}
              </Typography>
              <Typography sx={{ mt: 1, color: 'text.secondary', fontSize: fontSizes.md, lineHeight: 1.6 }}>{step.text}</Typography>
            </Box>
          ))}
        </Box>
      </Section>

      <Section id="para-quem" tinted>
        <SectionTitle
          eyebrow="Para quem é"
          title="Feita para a rotina de clínicas de estética e saúde"
          subtitle="Do consultório de uma profissional só a clínicas com equipe, salas e vários serviços."
        />
        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' } }}>
          {AUDIENCE.map((a) => (
            <Box key={a.title} sx={{ p: 3, borderRadius: '18px', bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
              <IconBadge name={a.icon} />
              <Typography component="h3" sx={{ mt: 2, fontWeight: 800, fontSize: fontSizes['2xl'] }}>
                {a.title}
              </Typography>
              <Typography sx={{ mt: 1, color: 'text.secondary', fontSize: fontSizes.md, lineHeight: 1.6 }}>{a.text}</Typography>
            </Box>
          ))}
        </Box>
      </Section>

      {hasPlans && (
        <Section id="planos">
          <SectionTitle
            eyebrow="Planos"
            title="Escolha o tamanho certo para a sua clínica"
            subtitle="Nada para instalar: fale com a gente e preparamos a clínica e os acessos da equipe."
          />
          <LandingPlans plans={plans} contactHref={contactHref} />
        </Section>
      )}

      <Section id="faq" tinted={hasPlans}>
        <SectionTitle eyebrow="Dúvidas" title="Perguntas frequentes" />
        <Box sx={{ maxWidth: 760, mx: 'auto' }}>
          {FAQ.map((item) => (
            <Accordion
              key={item.q}
              disableGutters
              elevation={0}
              sx={{
                mb: 1.5,
                borderRadius: '14px !important',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: hasPlans ? 'background.default' : 'background.paper',
                '&::before': { display: 'none' },
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2.5, py: 0.5 }}>
                <Typography component="h3" sx={{ fontWeight: 700, fontSize: fontSizes.xl }}>
                  {item.q}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2.5, pt: 0, pb: 2.5 }}>
                <Typography sx={{ color: 'text.secondary', fontSize: fontSizes.lg, lineHeight: 1.6 }}>{item.a}</Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </Section>

      <Box component="section" id="contato" sx={{ py: { xs: 8, md: 10 }, scrollMarginTop: 72 }}>
        <Container maxWidth="md">
          <Box
            sx={{
              position: 'relative',
              overflow: 'hidden',
              textAlign: 'center',
              px: { xs: 3, md: 8 },
              py: { xs: 6, md: 8 },
              borderRadius: '28px',
              border: '1px solid rgba(95,211,198,.2)',
              background: `linear-gradient(155deg, ${BRAND_BG} 0%, #0E3F39 55%, #0E7C7B 140%)`,
            }}
          >
            <Typography
              component="h2"
              sx={{ fontSize: { xs: fontSizes['6xl'], md: fontSizes['8xl'] }, fontWeight: 800, color: '#fff', letterSpacing: '-0.8px', lineHeight: 1.2 }}
            >
              Vamos organizar a sua clínica?
            </Typography>
            <Typography sx={{ mt: 2, color: BRAND_SUBTITLE, fontSize: fontSizes.xl, lineHeight: 1.6, maxWidth: 520, mx: 'auto' }}>
              {mainContact
                ? 'Conte um pouco sobre a sua clínica e mostramos a plataforma funcionando com a sua rotina.'
                : 'Já tem acesso? Entre com a conta Google cadastrada pela sua clínica.'}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center" sx={{ mt: 4 }}>
              {mainContact && (
                <Button href={mainContact} variant="contained" size="large" sx={{ height: 50, px: 4, borderRadius: '12px', fontSize: fontSizes.lg }}>
                  Falar com a gente
                </Button>
              )}
              <Button
                href={loginHref}
                variant="outlined"
                size="large"
                sx={{
                  height: 50,
                  px: 4,
                  borderRadius: '12px',
                  fontSize: fontSizes.lg,
                  color: '#fff',
                  borderColor: 'rgba(255,255,255,.35)',
                  '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,.06)' },
                }}
              >
                Entrar na plataforma
              </Button>
            </Stack>
          </Box>
        </Container>
      </Box>

      <Box component="footer" sx={{ borderTop: '1px solid', borderColor: 'divider', py: 4 }}>
        <Container maxWidth="lg">
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            alignItems="center"
            justifyContent="space-between"
            sx={{ color: 'text.secondary', fontSize: fontSizes.sm }}
          >
            <Box>
              © {year} {BRAND_NAME} · {BRAND_TAGLINE} · v{APP_VERSION}
            </Box>
            <Stack direction="row" spacing={3}>
              <MuiLink href={clinicPanelUrl('/termos')} color="inherit" underline="hover">
                Termos de uso
              </MuiLink>
              <MuiLink href={clinicPanelUrl('/privacidade')} color="inherit" underline="hover">
                Privacidade
              </MuiLink>
              <MuiLink href={loginHref} color="inherit" underline="hover">
                Entrar
              </MuiLink>
            </Stack>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
