import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  LinearProgress,
  Skeleton,
  Stack,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import { useQuery } from '@tanstack/react-query';

import { tenantPlanApi } from '../api/tenantPlan';
import { formatBytes } from '../utils/formatBytes';
import { FeedbackReportDialog } from '../components/feedback/FeedbackReportDialog';
import { PLATFORM_FEATURE_LABELS, formatPlanPrice, isPlatformFeature } from '../features/platformFeatures';
import { getApiErrorMessage } from '../utils/apiError';
import { fontSizes } from '../theme/fontSizes';

const SECTION_TITLE_SX = {
  px: 2.5,
  py: 1.75,
  borderBottom: 1,
  borderColor: 'divider',
  fontSize: fontSizes.md,
  fontWeight: 800,
} as const;

function usageRatio(used: number, max: number | undefined): number | null {
  if (max == null || max <= 0) return null;
  return Math.min(100, (used / max) * 100);
}

function LimitRow({
  label,
  used,
  max,
  formatUsed,
  formatMax,
}: {
  label: string;
  used: number;
  max?: number;
  formatUsed: (n: number) => string;
  formatMax: (n: number) => string;
}) {
  const theme = useTheme();
  const ratio = usageRatio(used, max);
  const nearLimit = ratio != null && ratio >= 85;
  const over = max != null && used > max;

  return (
    <Box sx={{ py: 2, '&:not(:last-child)': { borderBottom: 1, borderColor: 'divider' } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={2}>
        <Typography sx={{ fontWeight: 700, fontSize: fontSizes.sm }}>{label}</Typography>
        <Typography
          sx={{
            fontSize: fontSizes.sm,
            fontWeight: 700,
            color: over ? 'error.main' : nearLimit ? 'warning.main' : 'text.primary',
            whiteSpace: 'nowrap',
          }}
        >
          {formatUsed(used)}
          {max != null ? ` / ${formatMax(max)}` : ' · ilimitado'}
        </Typography>
      </Stack>
      {ratio != null && (
        <LinearProgress
          variant="determinate"
          value={ratio}
          sx={{
            mt: 1.25,
            height: 8,
            borderRadius: 4,
            bgcolor: alpha(theme.palette.primary.main, 0.08),
            '& .MuiLinearProgress-bar': {
              borderRadius: 4,
              bgcolor: over ? 'error.main' : nearLimit ? 'warning.main' : 'primary.main',
            },
          }}
        />
      )}
    </Box>
  );
}

const GB = 1024 ** 3;

function buildUpgradeFeedbackDescription(planName: string, usage?: {
  activeUsers: number;
  patients: number;
  storageBytes: number;
}): string {
  const lines = [
    'Gostaria de ampliar limites do plano, incluir módulos ou migrar para outro plano.',
    '',
    `Plano atual: ${planName}`,
  ];
  if (usage) {
    lines.push(
      `Uso atual: ${usage.activeUsers.toLocaleString('pt-BR')} usuário(s) ativo(s), ${usage.patients.toLocaleString('pt-BR')} paciente(s), ${formatBytes(usage.storageBytes)} em arquivos.`,
    );
  }
  lines.push('', 'Descreva abaixo o que você precisa (limites, módulos, etc.).');
  return lines.join('\n');
}

/** Plano da clínica, consumo vs limites e solicitação de upgrade via feedback. */
export function MyPlan() {
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['tenant', 'plan'],
    queryFn: () => tenantPlanApi.getSummary(),
  });

  const plan = data?.plan;
  const usage = data?.usage;
  const planDisplayName = plan?.name ?? 'Plano personalizado';

  const upgradeFeedbackInitial = useMemo(
    () => ({
      type: 'SUGGESTION' as const,
      title: 'Solicitação de upgrade de plano',
      description: buildUpgradeFeedbackDescription(planDisplayName, usage),
    }),
    [planDisplayName, usage],
  );

  const storageLimitBytes =
    plan?.limits?.storageGb != null ? plan.limits.storageGb * GB : undefined;

  if (error) {
    return (
      <Alert severity="error">{getApiErrorMessage(error, 'Não foi possível carregar o plano da clínica.')}</Alert>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Card data-tour="plan-current">
        <Typography component="h2" sx={SECTION_TITLE_SX}>
          Plano atual
        </Typography>
        <Box sx={{ p: { xs: 2, sm: 2.75 } }}>
          {isLoading || !data ? (
            <Stack spacing={1}>
              <Skeleton width={200} sx={{ fontSize: fontSizes['3xl'] }} />
              <Skeleton width={280} />
            </Stack>
          ) : plan ? (
            <Stack spacing={1.25}>
              <Typography sx={{ fontSize: fontSizes['3xl'], fontWeight: 800, letterSpacing: '-0.5px' }}>
                {plan.name}
              </Typography>
              <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary' }}>
                {formatPlanPrice(plan.priceCents, plan.currency)}
                {plan.description ? ` · ${plan.description}` : ''}
              </Typography>
            </Stack>
          ) : (
            <Stack spacing={1}>
              <Typography sx={{ fontSize: fontSizes['3xl'], fontWeight: 800, letterSpacing: '-0.5px' }}>
                Plano personalizado
              </Typography>
              <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary' }}>
                Sua clínica ainda não está vinculada a um plano nomeado na plataforma — todos os módulos
                permanecem disponíveis (configuração legada).
              </Typography>
            </Stack>
          )}
        </Box>
      </Card>

      <Card>
        <Typography component="h2" sx={SECTION_TITLE_SX}>
          Uso vs limites
        </Typography>
        <Box sx={{ px: { xs: 2, sm: 2.75 } }}>
          {isLoading || !usage ? (
            <>
              <Skeleton height={56} />
              <Skeleton height={56} />
              <Skeleton height={56} />
            </>
          ) : (
            <>
              <LimitRow
                label="Usuários ativos"
                used={usage.activeUsers}
                max={plan?.limits?.maxUsers}
                formatUsed={(n) => n.toLocaleString('pt-BR')}
                formatMax={(n) => n.toLocaleString('pt-BR')}
              />
              <LimitRow
                label="Pacientes cadastrados"
                used={usage.patients}
                max={plan?.limits?.maxPatients}
                formatUsed={(n) => n.toLocaleString('pt-BR')}
                formatMax={(n) => n.toLocaleString('pt-BR')}
              />
              <LimitRow
                label="Armazenamento (documentos e fotos)"
                used={usage.storageBytes}
                max={storageLimitBytes}
                formatUsed={formatBytes}
                formatMax={(n) => formatBytes(n)}
              />
              <Typography sx={{ py: 1.5, fontSize: fontSizes.xs, color: 'text.secondary' }}>
                {usage.files.toLocaleString('pt-BR')} arquivo(s) contabilizados · ao atingir um limite, novos
                usuários ativos, pacientes e envios de arquivo são bloqueados.
              </Typography>
            </>
          )}
        </Box>
      </Card>

      {data?.features?.length ? (
        <Card>
          <Typography component="h2" sx={SECTION_TITLE_SX}>
            Módulos ativos
          </Typography>
          <Box sx={{ p: { xs: 2, sm: 2.75 } }}>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {data.features.map((f) => (
                <Chip
                  key={f}
                  label={isPlatformFeature(f) ? PLATFORM_FEATURE_LABELS[f] : f}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Stack>
          </Box>
        </Card>
      ) : null}

      <Card
        sx={{
          p: { xs: 2, sm: 2.75 },
          bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
          borderColor: (t) => alpha(t.palette.primary.main, 0.2),
        }}
      >
        <Typography sx={{ fontWeight: 800, fontSize: fontSizes.lg, mb: 0.75 }}>Precisa de mais recursos?</Typography>
        <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary', mb: 2, maxWidth: 560 }}>
          Para ampliar limites, incluir módulos ou migrar de plano, envie uma solicitação à equipe da plataforma.
          Ela aparece na central de reports do administrador.
        </Typography>
        <Button
          variant="contained"
          startIcon={<TrendingUpOutlinedIcon />}
          onClick={() => setUpgradeDialogOpen(true)}
          sx={{ alignSelf: 'flex-start' }}
        >
          Solicitar upgrade
        </Button>
      </Card>

      <FeedbackReportDialog
        open={upgradeDialogOpen}
        onClose={() => setUpgradeDialogOpen(false)}
        initial={upgradeFeedbackInitial}
      />
    </Stack>
  );
}
