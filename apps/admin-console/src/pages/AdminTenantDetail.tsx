import { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { Alert, Box, Button, Card, Link, Skeleton, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import LoginIcon from '@mui/icons-material/Login';
import BlockIcon from '@mui/icons-material/Block';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../api/admin';
import { StatCard } from '../../../../frontend/src/components/StatCard';
import { TenantFormDialog } from '../components/TenantFormDialog';
import { PlatformAuditList } from '../components/PlatformAuditList';
import { useTenantActions } from '../components/useTenantActions';
import { PlanSelect } from '../components/PlanSelect';
import { TenantFeaturesEditor } from '../components/TenantFeaturesEditor';
import { useAppToast } from '../../../../frontend/src/contexts/AppToastContext';
import {
  TenantStatusPill,
  formatBytes,
  formatCnpj,
  formatDate,
  formatDateTime,
  formatLastAccess,
} from '../components/adminUi';
import { TenantSpecialtyChips } from '../components/TenantSpecialtyChips';
import { formatDateOnlyFromApi } from '../../../../frontend/src/utils/dateOnly';
import { getApiErrorMessage } from '../../../../frontend/src/utils/apiError';
import { adminPath } from '../../../../frontend/src/utils/adminPath';
import { fontSizes } from '../../../../frontend/src/theme/fontSizes';

const STATS_GRID_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(5, minmax(0, 1fr))' },
  gap: 2,
} as const;

const SECTION_TITLE_SX = {
  px: 2.5,
  py: 1.75,
  borderBottom: 1,
  borderColor: 'divider',
  fontSize: fontSizes.md,
  fontWeight: 800,
} as const;

/** Detalhe de uma clínica: métricas de uso, administradores e histórico do super-admin. */
export function AdminTenantDetail() {
  const { id = '' } = useParams();
  const actions = useTenantActions();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const [editOpen, setEditOpen] = useState(false);

  const { data: tenant, isLoading, error } = useQuery({
    queryKey: ['admin', 'tenant', id],
    queryFn: () => adminApi.getTenant(id),
    enabled: !!id,
  });

  const { data: audit, isLoading: auditLoading } = useQuery({
    queryKey: ['admin', 'audit', { tenantId: id }],
    queryFn: () => adminApi.listAudit({ tenantId: id, limit: 10 }),
    enabled: !!id,
  });

  const planMutation = useMutation({
    mutationFn: (planId: string) => adminApi.updateTenant(id, { planId: planId || null }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenant', id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenants'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      toast.success(updated.plan ? `Plano alterado para ${updated.plan.name}.` : 'Plano removido da clínica.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível trocar o plano.')),
  });

  if (error) {
    return (
      <Stack spacing={2}>
        <BackLink />
        <Alert severity="error">{getApiErrorMessage(error, 'Não foi possível carregar a clínica.')}</Alert>
      </Stack>
    );
  }

  const m = tenant?.metrics;

  return (
    <Stack spacing={2.5}>
      <BackLink />

      <Card sx={{ p: { xs: 2, sm: 2.75 } }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between"
        >
          <Box sx={{ minWidth: 0 }}>
            {isLoading || !tenant ? (
              <>
                <Skeleton width={240} sx={{ fontSize: fontSizes['3xl'] }} />
                <Skeleton width={180} />
              </>
            ) : (
              <>
                <Stack direction="row" alignItems="center" spacing={1.25}>
                  <Typography component="h2" sx={{ fontSize: fontSizes['3xl'], fontWeight: 800, letterSpacing: '-0.5px' }}>
                    {tenant.name}
                  </Typography>
                  <TenantStatusPill active={tenant.active} />
                </Stack>
                <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary', mt: 0.5 }}>
                  {tenant.slug} · criada em {formatDate(tenant.createdAt)}
                  {!tenant.active && tenant.suspendedAt && ` · suspensa em ${formatDateTime(tenant.suspendedAt)}`}
                </Typography>
                {(tenant.specialties.length > 0 || tenant.foundedAt) && (
                  <Box sx={{ mt: 1 }}>
                    {tenant.specialties.length > 0 && <TenantSpecialtyChips specialties={tenant.specialties} />}
                    {tenant.foundedAt && (
                      <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary', mt: tenant.specialties.length ? 0.75 : 0 }}>
                        Inaugurada em {formatDateOnlyFromApi(tenant.foundedAt)}
                      </Typography>
                    )}
                  </Box>
                )}
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1.5 }}>
                  <Typography component="span" sx={{ fontSize: fontSizes.sm, fontWeight: 700, color: 'text.secondary' }}>
                    Plano
                  </Typography>
                  <PlanSelect
                    size="small"
                    value={tenant.planId ?? ''}
                    onChange={(planId) => {
                      if (planId !== (tenant.planId ?? '')) planMutation.mutate(planId);
                    }}
                    currentPlan={tenant.plan}
                    disabled={planMutation.isPending}
                    inputProps={{ 'aria-label': 'Plano da clínica' }}
                    sx={{ minWidth: 200 }}
                  />
                </Stack>
              </>
            )}
          </Box>

          {tenant && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setEditOpen(true)}>
                Editar
              </Button>
              {tenant.active ? (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<BlockIcon />}
                  disabled={actions.pending}
                  onClick={() => actions.suspend(tenant)}
                >
                  Suspender
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  color="success"
                  startIcon={<PlayCircleOutlineIcon />}
                  disabled={actions.pending}
                  onClick={() => actions.reactivate(tenant)}
                >
                  Reativar
                </Button>
              )}
              <Button
                variant="contained"
                startIcon={<LoginIcon />}
                disabled={actions.pending}
                onClick={() => actions.enter(tenant)}
              >
                Entrar como
              </Button>
            </Stack>
          )}
        </Stack>
      </Card>

      {tenant && !tenant.active && (
        <Alert severity="warning">
          Clínica suspensa: os usuários dela não conseguem entrar e veem o aviso de suspensão na tela de login.
        </Alert>
      )}

      <Box sx={STATS_GRID_SX}>
        <StatCard
          label={m ? `Usuários ativos (de ${m.totalUsers})` : 'Usuários ativos'}
          value={m?.activeUsers ?? 0}
          loading={isLoading}
        />
        <StatCard label="Pacientes" value={m?.patients ?? 0} loading={isLoading} />
        <StatCard label="Agendamentos do mês" value={m?.appointmentsThisMonth ?? 0} loading={isLoading} />
        <StatCard
          label="Último acesso"
          value={formatLastAccess(m?.lastAccessAt)}
          loading={isLoading}
          skeletonWidth={90}
        />
        <StatCard
          label={m ? `Armazenamento (${m.files} ${m.files === 1 ? 'arquivo' : 'arquivos'})` : 'Armazenamento'}
          value={formatBytes(m?.storageBytes ?? 0)}
          loading={isLoading}
          skeletonWidth={90}
        />
      </Box>

      {tenant && hasTenantProfile(tenant) && (
        <Card sx={{ p: 0, overflow: 'hidden' }}>
          <Typography component="h3" sx={SECTION_TITLE_SX}>
            Cadastro da clínica
          </Typography>
          <Box sx={{ px: 2.5, py: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <ProfileField label="Razão social" value={tenant.legalName} />
            <ProfileField label="CNPJ" value={tenant.document ? formatCnpj(tenant.document) : null} />
            <ProfileField label="Telefone" value={tenant.phone} />
            <ProfileField label="E-mail de contato" value={tenant.email} />
            <ProfileField label="Cidade" value={tenant.city} />
            <ProfileField label="UF" value={tenant.state} />
            {tenant.notes && (
              <Box sx={{ gridColumn: { sm: '1 / -1' } }}>
                <ProfileField label="Nota interna" value={tenant.notes} multiline />
              </Box>
            )}
          </Box>
        </Card>
      )}

      {tenant && (
        <Card sx={{ p: 0, overflow: 'hidden' }}>
          <Typography component="h3" sx={SECTION_TITLE_SX}>
            Módulos da clínica
          </Typography>
          <TenantFeaturesEditor tenant={tenant} />
        </Card>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(0, 1.4fr)' }, gap: 2.5 }}>
        <Card sx={{ p: 0, overflow: 'hidden', alignSelf: 'start' }}>
          <Typography component="h3" sx={SECTION_TITLE_SX}>
            Administradores
          </Typography>
          {isLoading ? (
            <Box sx={{ px: 2.5, py: 2 }}>
              <Skeleton variant="rounded" height={44} />
            </Box>
          ) : tenant?.admins.length ? (
            tenant.admins.map((a) => (
              <Box
                key={a.id}
                sx={{ px: 2.5, py: 1.5, borderBottom: 1, borderColor: 'grey.100', '&:last-of-type': { borderBottom: 0 } }}
              >
                <Typography sx={{ fontSize: fontSizes.md, fontWeight: 700 }} noWrap>
                  {a.name}
                  {!a.active && (
                    <Box component="span" sx={{ color: 'text.disabled', fontWeight: 600 }}>
                      {' '}
                      (inativo)
                    </Box>
                  )}
                </Typography>
                <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }} noWrap>
                  {a.email} · último acesso {formatLastAccess(a.lastAccessAt).toLowerCase()}
                </Typography>
              </Box>
            ))
          ) : (
            <Typography color="text.secondary" sx={{ px: 2.5, py: 3 }}>
              Nenhum administrador.
            </Typography>
          )}
        </Card>

        <Card sx={{ p: 0, overflow: 'hidden', alignSelf: 'start' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={SECTION_TITLE_SX}>
            <span>Histórico na plataforma</span>
            <Link
              component={RouterLink}
              to={`${adminPath('/auditoria')}?clinica=${id}`}
              underline="hover"
              sx={{ fontSize: fontSizes.sm, fontWeight: 700 }}
            >
              Ver tudo
            </Link>
          </Stack>
          <PlatformAuditList entries={audit?.data ?? []} loading={auditLoading} />
        </Card>
      </Box>

      <TenantFormDialog open={editOpen} onClose={() => setEditOpen(false)} editing={tenant ?? null} />
    </Stack>
  );
}

function BackLink() {
  return (
    <Box>
      <Button component={RouterLink} to={adminPath('/clinicas')} startIcon={<ArrowBackIcon />} size="small">
        Clínicas
      </Button>
    </Box>
  );
}

function hasTenantProfile(tenant: {
  legalName: string | null;
  document: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
}) {
  return [tenant.legalName, tenant.document, tenant.phone, tenant.email, tenant.city, tenant.state, tenant.notes].some(
    Boolean,
  );
}

function ProfileField({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string | null | undefined;
  multiline?: boolean;
}) {
  if (!value) return null;
  return (
    <Box>
      <Typography sx={{ fontSize: fontSizes['2xs'], fontWeight: 800, letterSpacing: '0.06em', color: 'text.disabled', textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 600, mt: 0.35, whiteSpace: multiline ? 'pre-wrap' : 'nowrap' }} noWrap={!multiline}>
        {value}
      </Typography>
    </Box>
  );
}
