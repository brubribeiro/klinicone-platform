import { Box, Button, Stack, Typography } from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';

import type { PublicPlan } from '../../../../frontend/src/api/public';
import { PLATFORM_FEATURES, PLATFORM_FEATURE_LABELS, formatPlanPrice, isPlatformFeature } from '../../../../frontend/src/features/platformFeatures';
import { fontSizes } from '../../../../frontend/src/theme/fontSizes';

const numberFormat = new Intl.NumberFormat('pt-BR');

function limitLines(plan: PublicPlan): string[] {
  const l = plan.limits;
  return [
    l?.maxUsers != null ? `Até ${numberFormat.format(l.maxUsers)} usuários` : 'Usuários ilimitados',
    l?.maxPatients != null ? `Até ${numberFormat.format(l.maxPatients)} pacientes` : 'Pacientes ilimitados',
    l?.storageGb != null ? `${numberFormat.format(l.storageGb)} GB para fotos e documentos` : 'Armazenamento sob medida',
  ];
}

const MAX_FEATURES_SHOWN = 6;

function featureLabel(f: string): string {
  return isPlatformFeature(f) ? PLATFORM_FEATURE_LABELS[f] : f;
}

/**
 * Módulos do plano em poucas linhas. Se inclui tudo do plano anterior, vira
 * "Tudo do plano X, mais:" com só os módulos novos; senão, os primeiros + "e mais N".
 */
function featureLines(plan: PublicPlan, previous: PublicPlan | undefined): string[] {
  let header: string[] = [];
  let labels = plan.features.map(featureLabel);
  if (previous?.features.length && previous.features.every((f) => plan.features.includes(f))) {
    const extra = plan.features.filter((f) => !previous.features.includes(f));
    header = [extra.length ? `Tudo do plano ${previous.name}, mais:` : `Tudo do plano ${previous.name}`];
    labels = extra.map(featureLabel);
  } else if (plan.features.length >= PLATFORM_FEATURES.length) {
    return [`Todos os ${PLATFORM_FEATURES.length} módulos`];
  }
  if (labels.length > MAX_FEATURES_SHOWN) {
    const rest = labels.length - (MAX_FEATURES_SHOWN - 1);
    labels = [...labels.slice(0, MAX_FEATURES_SHOWN - 1), `e mais ${rest} módulos`];
  }
  return [...header, ...labels];
}

type Props = {
  plans: PublicPlan[];
  /** mailto do contato; sem e-mail configurado o botão do plano não aparece. */
  contactHref: (subject: string) => string | null;
};

/** Planos ativos cadastrados no painel super-admin; o do meio fica em destaque. */
export function LandingPlans({ plans, contactHref }: Props) {
  const highlighted = plans.length >= 3 ? Math.floor(plans.length / 2) : -1;

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 3,
        gridTemplateColumns: { xs: '1fr', md: `repeat(${Math.min(plans.length, 3)}, 1fr)` },
        alignItems: 'stretch',
      }}
    >
      {plans.map((plan, i) => {
        const featured = i === highlighted;
        const href = contactHref(`Quero conhecer o plano ${plan.name}`);
        return (
          <Stack
            key={plan.slug}
            sx={{
              position: 'relative',
              p: 3.5,
              borderRadius: '20px',
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: featured ? 'primary.main' : 'divider',
              boxShadow: featured ? '0 24px 60px -28px rgba(21,153,139,.55)' : 'none',
            }}
          >
            {featured && (
              <Box
                sx={{
                  position: 'absolute',
                  top: -13,
                  left: 28,
                  px: 1.5,
                  py: 0.5,
                  borderRadius: '999px',
                  bgcolor: 'primary.main',
                  color: '#fff',
                  fontSize: fontSizes['2xs'],
                  fontWeight: 800,
                  letterSpacing: '.6px',
                  textTransform: 'uppercase',
                }}
              >
                Mais escolhido
              </Box>
            )}
            <Typography component="h3" sx={{ fontSize: fontSizes['4xl'], fontWeight: 800 }}>
              {plan.name}
            </Typography>
            {plan.description && (
              <Typography sx={{ mt: 0.5, color: 'text.secondary', fontSize: fontSizes.md, minHeight: { md: '3em' } }}>
                {plan.description}
              </Typography>
            )}
            <Box sx={{ my: 2.5 }}>
              {plan.priceCents != null ? (
                <Typography sx={{ fontSize: fontSizes['7xl'], fontWeight: 800, letterSpacing: '-1px' }}>
                  {formatPlanPrice(plan.priceCents, plan.currency)}
                  <Box component="span" sx={{ fontSize: fontSizes.md, fontWeight: 600, color: 'text.secondary', ml: 0.5 }}>
                    /mês
                  </Box>
                </Typography>
              ) : (
                <Typography sx={{ fontSize: fontSizes['5xl'], fontWeight: 800 }}>Sob consulta</Typography>
              )}
            </Box>

            <Stack spacing={1} sx={{ mb: 2.5 }}>
              {limitLines(plan).map((line) => (
                <Typography key={line} sx={{ fontSize: fontSizes.md, fontWeight: 600 }}>
                  {line}
                </Typography>
              ))}
            </Stack>

            {plan.features.length > 0 && (
              <Stack spacing={1} sx={{ mb: 3, pt: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
                {featureLines(plan, plans[i - 1]).map((line) => (
                  <Stack key={line} direction="row" spacing={1} alignItems="center" sx={{ color: 'primary.main' }}>
                    <CheckRoundedIcon sx={{ fontSize: fontSizes.xl }} />
                    <Typography sx={{ fontSize: fontSizes.md, color: 'text.primary' }}>{line}</Typography>
                  </Stack>
                ))}
              </Stack>
            )}

            {href && (
              <Button
                href={href}
                variant={featured ? 'contained' : 'outlined'}
                fullWidth
                sx={{ mt: 'auto', borderRadius: '12px', fontWeight: 700 }}
              >
                Quero este plano
              </Button>
            )}
          </Stack>
        );
      })}
    </Box>
  );
}
