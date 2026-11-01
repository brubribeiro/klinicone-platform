import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Chip, Stack, Typography, alpha } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../api/admin';
import { useAppToast } from '../../../../frontend/src/contexts/AppToastContext';
import { getApiErrorMessage } from '../../../../frontend/src/utils/apiError';
import {
  PLATFORM_FEATURES,
  PLATFORM_FEATURE_LABELS,
  type PlatformFeature,
} from '../../../../frontend/src/features/platformFeatures';
import { FeatureModuleChip, FeatureModuleChipGrid } from './FeatureModuleChips';
import { fontSizes } from '../../../../frontend/src/theme/fontSizes';
import type { AdminTenantDetail } from '../../../../frontend/src/types';

interface Props {
  tenant: AdminTenantDetail;
}

/**
 * Overrides de módulos da clínica: extras (além do plano) e negados (do plano).
 * Efetivo = (plano ∪ extra) − denied.
 */
export function TenantFeaturesEditor({ tenant }: Props) {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const planFeatures = useMemo(
    () =>
      new Set(
        (tenant.plan?.features ?? []).filter((f): f is PlatformFeature =>
          (PLATFORM_FEATURES as readonly string[]).includes(f),
        ),
      ),
    [tenant.plan?.features],
  );

  const [extra, setExtra] = useState<PlatformFeature[]>([]);
  const [denied, setDenied] = useState<PlatformFeature[]>([]);

  useEffect(() => {
    setExtra(
      (tenant.featuresExtra ?? []).filter((f): f is PlatformFeature =>
        (PLATFORM_FEATURES as readonly string[]).includes(f),
      ),
    );
    setDenied(
      (tenant.featuresDenied ?? []).filter((f): f is PlatformFeature =>
        (PLATFORM_FEATURES as readonly string[]).includes(f),
      ),
    );
  }, [tenant.id, tenant.featuresExtra, tenant.featuresDenied]);

  const dirty =
    JSON.stringify([...extra].sort()) !== JSON.stringify([...(tenant.featuresExtra ?? [])].sort()) ||
    JSON.stringify([...denied].sort()) !== JSON.stringify([...(tenant.featuresDenied ?? [])].sort());

  const saveMutation = useMutation({
    mutationFn: () =>
      adminApi.updateTenant(tenant.id, {
        featuresExtra: extra.length ? extra : null,
        featuresDenied: denied.length ? denied : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenant', tenant.id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      toast.success('Módulos da clínica atualizados.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível salvar os módulos.')),
  });

  const toggleExtra = (f: PlatformFeature) => {
    const on = !extra.includes(f);
    setExtra((prev) => (on ? [...prev, f] : prev.filter((x) => x !== f)));
    if (on) setDenied((prev) => prev.filter((x) => x !== f));
  };

  const toggleDenied = (f: PlatformFeature) => {
    const on = !denied.includes(f);
    setDenied((prev) => (on ? [...prev, f] : prev.filter((x) => x !== f)));
    if (on) setExtra((prev) => prev.filter((x) => x !== f));
  };

  const effective = tenant.effectiveFeatures ?? [];
  const notInPlan = PLATFORM_FEATURES.filter((f) => !planFeatures.has(f));
  const inPlan = PLATFORM_FEATURES.filter((f) => planFeatures.has(f));

  return (
    <Stack spacing={2.25} sx={{ px: 2.5, py: 2 }}>
      <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary' }}>
        {tenant.plan
          ? `Plano ${tenant.plan.name}: ${(tenant.plan.features ?? []).length} módulos. Abaixo você pode acrescentar ou remover em relação ao plano.`
          : 'Sem plano: a clínica tem todos os módulos. Ao atribuir um plano, use extras e negados para ajustar.'}
      </Typography>

      <Box>
        <Typography
          sx={{
            fontSize: fontSizes.xs,
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'text.disabled',
            mb: 1,
          }}
        >
          Efetivos agora ({effective.length})
        </Typography>
        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75}>
          {effective.length ? (
            effective.map((f) => (
              <Chip
                key={f}
                size="small"
                label={PLATFORM_FEATURE_LABELS[f as PlatformFeature] ?? f}
                sx={(t) => ({
                  fontWeight: 700,
                  borderRadius: '9px',
                  bgcolor: alpha(t.palette.primary.main, 0.1),
                  color: 'primary.dark',
                  border: '1px solid',
                  borderColor: alpha(t.palette.primary.main, 0.28),
                })}
              />
            ))
          ) : (
            <Typography color="text.secondary" sx={{ fontSize: fontSizes.sm }}>
              Nenhum módulo
            </Typography>
          )}
        </Stack>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2.25,
          alignItems: 'stretch',
        }}
      >
        <Box
          sx={{
            p: { xs: 1.75, sm: 2 },
            borderRadius: '16px',
            border: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            minHeight: 200,
          }}
        >
          <Typography
            sx={{
              fontSize: fontSizes.xs,
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'text.disabled',
              mb: 0.5,
            }}
          >
            Extras (além do plano)
          </Typography>
          <Typography sx={{ fontSize: fontSizes.xs, color: 'text.disabled', mb: 1.25 }}>
            Módulos que o plano não traz
          </Typography>
          <FeatureModuleChipGrid aria-label="Módulos extras">
            {notInPlan.map((f) => (
              <FeatureModuleChip
                key={f}
                feature={f}
                selected={extra.includes(f)}
                onClick={() => toggleExtra(f)}
              />
            ))}
            {inPlan.map((f) => (
              <FeatureModuleChip
                key={`plan-${f}`}
                feature={f}
                selected
                disabled
                tone="muted"
                hint="plano"
              />
            ))}
          </FeatureModuleChipGrid>
          {!PLATFORM_FEATURES.length && null}
        </Box>

        <Box
          sx={{
            p: { xs: 1.75, sm: 2 },
            borderRadius: '16px',
            border: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            minHeight: 200,
          }}
        >
          <Typography
            sx={{
              fontSize: fontSizes.xs,
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'text.disabled',
              mb: 0.5,
            }}
          >
            Removidos (do plano)
          </Typography>
          <Typography sx={{ fontSize: fontSizes.xs, color: 'text.disabled', mb: 1.25 }}>
            Desliga um módulo que o plano inclui
          </Typography>
          {planFeatures.size ? (
            <FeatureModuleChipGrid aria-label="Módulos removidos">
              {inPlan.map((f) => (
                <FeatureModuleChip
                  key={f}
                  feature={f}
                  selected={denied.includes(f)}
                  tone="danger"
                  onClick={() => toggleDenied(f)}
                />
              ))}
            </FeatureModuleChipGrid>
          ) : (
            <Typography color="text.secondary" sx={{ fontSize: fontSizes.sm }}>
              Atribua um plano para negar módulos dele.
            </Typography>
          )}
        </Box>
      </Box>

      <Box>
        <Button
          variant="contained"
          disabled={!dirty || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? 'Salvando…' : 'Salvar módulos'}
        </Button>
      </Box>
    </Stack>
  );
}
