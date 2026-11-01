import { useState } from 'react';
import { Box, Button, Card, Chip, IconButton, Skeleton, Stack, Tooltip, Typography, alpha } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import BlockIcon from '@mui/icons-material/Block';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../api/admin';
import { useAppDialog } from '../../../../frontend/src/contexts/AppDialogContext';
import { useAppToast } from '../../../../frontend/src/contexts/AppToastContext';
import { LIST_HEADER_ACTION_SX, ListCardHeader } from '../../../../frontend/src/components/ListCardHeader';
import { PlanFormDialog } from '../components/PlanFormDialog';
import { ROW_ACTION_SX } from '../components/adminUi';
import { getApiErrorMessage } from '../../../../frontend/src/utils/apiError';
import { fontSizes } from '../../../../frontend/src/theme/fontSizes';
import { formatPlanPrice } from '../../../../frontend/src/features/platformFeatures';
import type { AdminPlan } from '../../../../frontend/src/types';

const CARDS_GRID_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
  gap: 2,
} as const;

const formatNumber = (v: number) => v.toLocaleString('pt-BR');

/** Planos da plataforma (super-admin): só cadastro, sem cobrança. */
export function AdminPlans() {
  const queryClient = useQueryClient();
  const { confirm } = useAppDialog();
  const toast = useAppToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminPlan | null>(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: adminApi.listPlans,
  });

  const activeMutation = useMutation({
    mutationFn: ({ plan, active }: { plan: AdminPlan; active: boolean }) => adminApi.setPlanActive(plan.id, active),
    onSuccess: (updated, { active }) => {
      queryClient.setQueryData<AdminPlan[]>(['admin', 'plans'], (old) =>
        old?.map((p) => (p.id === updated.id ? updated : p)),
      );
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenants'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenant'] });
      toast.success(active ? `Plano ${updated.name} ativado.` : `Plano ${updated.name} desativado.`);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível alterar o plano.')),
  });

  const toggleActive = async (plan: AdminPlan) => {
    if (plan.active) {
      const ok = await confirm({
        title: 'Desativar plano',
        message: `Desativar o plano ${plan.name}?`,
        details: [
          'Ele deixa de aparecer para novas clínicas e trocas de plano.',
          plan.tenantCount
            ? `${plan.tenantCount} ${plan.tenantCount === 1 ? 'clínica continua' : 'clínicas continuam'} com ele até você trocar.`
            : 'Nenhuma clínica usa este plano.',
        ],
        confirmLabel: 'Desativar',
        confirmColor: 'error',
      });
      if (ok) activeMutation.mutate({ plan, active: false });
    } else {
      activeMutation.mutate({ plan, active: true });
    }
  };

  const openForm = (plan: AdminPlan | null) => {
    setEditing(plan);
    setFormOpen(true);
  };

  const activeCount = plans.filter((p) => p.active).length;

  return (
    <Stack spacing={2.5}>
      <Card sx={{ p: 0, overflow: 'hidden' }}>
        <ListCardHeader
          title={
            <Typography sx={{ fontSize: fontSizes.md, color: 'text.secondary', fontWeight: 600 }}>
              {isLoading ? (
                <Skeleton width={180} />
              ) : (
                <>
                  <Box component="span" sx={{ color: 'text.primary', fontWeight: 800 }}>
                    {plans.length}
                  </Box>{' '}
                  {plans.length === 1 ? 'plano' : 'planos'}
                  {plans.length > activeCount && ` · ${activeCount} ${activeCount === 1 ? 'ativo' : 'ativos'}`}
                </>
              )}
            </Typography>
          }
        >
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openForm(null)} sx={LIST_HEADER_ACTION_SX}>
            Novo plano
          </Button>
        </ListCardHeader>
      </Card>

      {isLoading ? (
        <Box sx={CARDS_GRID_SX}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={230} sx={{ borderRadius: '18px' }} />
          ))}
        </Box>
      ) : plans.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center', borderRadius: '18px' }}>
          <WorkspacePremiumOutlinedIcon sx={{ fontSize: 46, color: 'text.disabled', mb: 1 }} />
          <Typography sx={{ fontWeight: 700 }}>Nenhum plano cadastrado</Typography>
          <Typography color="text.secondary" sx={{ fontSize: fontSizes.md, mt: 0.5 }}>
            Crie os planos para atribuir às clínicas.
          </Typography>
        </Card>
      ) : (
        <Box sx={CARDS_GRID_SX}>
          {plans.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              pending={activeMutation.isPending}
              onEdit={() => openForm(p)}
              onToggleActive={() => toggleActive(p)}
            />
          ))}
        </Box>
      )}

      <PlanFormDialog open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
    </Stack>
  );
}

function PlanCard({
  plan,
  pending,
  onEdit,
  onToggleActive,
}: {
  plan: AdminPlan;
  pending: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
}) {
  const featureCount = plan.features?.length ?? 0;
  const limits = [
    { label: 'Preço', value: plan.priceCents != null ? formatPlanPrice(plan.priceCents, plan.currency) : null },
    { label: 'Módulos', value: featureCount ? String(featureCount) : null },
    { label: 'Usuários', value: plan.limits?.maxUsers != null ? formatNumber(plan.limits.maxUsers) : null },
  ];

  return (
    <Card
      sx={{
        p: 2.25,
        borderRadius: '18px',
        border: 1,
        borderColor: 'divider',
        boxShadow: '0 1px 2px rgba(16,40,37,0.03)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow .15s, border-color .15s',
        '&:hover': {
          boxShadow: '0 12px 30px -20px rgba(16,40,37,0.45)',
          borderColor: (t) => alpha(t.palette.primary.main, 0.5),
        },
      }}
    >
      <Stack direction="row" alignItems="flex-start" spacing={1.5}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '13px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: plan.active ? 'primary.main' : 'text.disabled',
            bgcolor: (t) => alpha(plan.active ? t.palette.primary.main : t.palette.text.disabled, 0.12),
          }}
        >
          <WorkspacePremiumOutlinedIcon fontSize="small" />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1, opacity: plan.active ? 1 : 0.65 }}>
          <Typography title={plan.name} noWrap sx={{ fontSize: fontSizes.xl, fontWeight: 800, lineHeight: 1.2 }}>
            {plan.name}
          </Typography>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.4 }} flexWrap="wrap" useFlexGap>
            <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }} noWrap>
              {plan.slug}
            </Typography>
            {!plan.active && (
              <Chip size="small" label="Inativo" sx={{ height: 21, fontSize: fontSizes['2xs'], fontWeight: 700 }} />
            )}
          </Stack>
        </Box>
        <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
          <Tooltip title="Editar">
            <IconButton aria-label={`Editar ${plan.name}`} onClick={onEdit} sx={ROW_ACTION_SX}>
              <EditIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={plan.active ? 'Desativar' : 'Ativar'}>
            <IconButton
              aria-label={`${plan.active ? 'Desativar' : 'Ativar'} ${plan.name}`}
              disabled={pending}
              onClick={onToggleActive}
              sx={{ ...ROW_ACTION_SX, color: plan.active ? 'error.main' : 'success.main' }}
            >
              {plan.active ? <BlockIcon sx={{ fontSize: 16 }} /> : <PlayCircleOutlineIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Typography
        sx={{
          fontSize: fontSizes.sm,
          color: plan.description ? 'text.secondary' : 'text.disabled',
          mt: 1.5,
          minHeight: '2.6em',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
        title={plan.description ?? undefined}
      >
        {plan.description || 'Sem descrição'}
      </Typography>

      <Box
        component="dl"
        sx={{
          m: 0,
          mt: 1.75,
          p: 1.5,
          borderRadius: '12px',
          bgcolor: 'grey.50',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 1,
        }}
      >
        {limits.map((l) => (
          <Box key={l.label} sx={{ minWidth: 0 }}>
            <Typography
              component="dt"
              sx={{
                fontSize: fontSizes['2xs'],
                fontWeight: 800,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'text.disabled',
              }}
              noWrap
            >
              {l.label}
            </Typography>
            <Typography
              component="dd"
              sx={{
                m: 0,
                fontSize: fontSizes.md,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: l.value ? 'text.primary' : 'text.secondary',
              }}
              noWrap
            >
              {l.value ?? 'Ilimitado'}
            </Typography>
          </Box>
        ))}
      </Box>

      <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary', mt: 'auto', pt: 1.75 }}>
        <Box component="span" sx={{ color: 'text.primary', fontWeight: 800 }}>
          {plan.tenantCount}
        </Box>{' '}
        {plan.tenantCount === 1 ? 'clínica neste plano' : 'clínicas neste plano'}
      </Typography>
    </Card>
  );
}
