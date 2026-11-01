import { Box, Button, Card, MenuItem, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { adminApi } from '../api/admin';
import { useUrlState, urlDate } from '../../../../frontend/src/hooks/useUrlState';
import { LIST_HEADER_SELECT_SX, ListCardHeader } from '../../../../frontend/src/components/ListCardHeader';
import { StatCard } from '../../../../frontend/src/components/StatCard';
import { formatBytes, formatDate, formatLastAccess } from '../components/adminUi';
import { clickableProps } from '../../../../frontend/src/utils/a11y';
import { getApiErrorMessage } from '../../../../frontend/src/utils/apiError';
import { fontSizes } from '../../../../frontend/src/theme/fontSizes';
import type { PlatformModuleUsage, PlatformTenantUsage } from '../../../../frontend/src/types';

const STATS_GRID_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
  gap: 2,
} as const;

const HEAD_SX = {
  display: { xs: 'none', md: 'grid' },
  gap: 1.5,
  px: 2.5,
  py: 1.5,
  borderBottom: 1,
  borderColor: 'divider',
  bgcolor: 'grey.50',
  fontSize: fontSizes['2xs'],
  fontWeight: 800,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'text.disabled',
} as const;

const ROW_SX = {
  display: 'grid',
  gap: 1.5,
  px: { xs: 2, md: 2.5 },
  py: 1.5,
  borderBottom: 1,
  borderColor: 'grey.100',
  alignItems: 'center',
  '&:last-of-type': { borderBottom: 0 },
} as const;

const NUMBER_SX = { fontSize: fontSizes.sm, fontWeight: 700, fontVariantNumeric: 'tabular-nums' } as const;

const MODULE_COLS = 'minmax(0, 1.3fr) minmax(0, 1.6fr) 110px 110px 110px minmax(0, 1.4fr)';
const TENANT_COLS = 'minmax(0, 1.8fr) minmax(0, 0.9fr) 90px 120px 110px 130px 130px 110px';

/** Mês corrente no fuso do navegador (o backend usa o mesmo padrão no Brasil). */
function currentMonth() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const ym = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  return { from: `${ym}-01`, to: `${ym}-${pad(last)}` };
}

const n = (v: number) => v.toLocaleString('pt-BR');

function AdoptionBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
      <Box
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label="Clínicas usando no período"
        sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: 'grey.100', overflow: 'hidden' }}
      >
        <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: 'primary.main', borderRadius: 3 }} />
      </Box>
      <Typography sx={{ ...NUMBER_SX, fontSize: fontSizes.xs, color: 'text.secondary', whiteSpace: 'nowrap' }}>
        {n(value)} de {n(max)}
      </Typography>
    </Stack>
  );
}

function ModuleRow({ module, single }: { module: PlatformModuleUsage; single: boolean }) {
  const enabled = module.enabledTenants > 0;
  return (
    <Box sx={{ ...ROW_SX, gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', md: MODULE_COLS } }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: fontSizes.md, fontWeight: 700, color: enabled ? 'text.primary' : 'text.disabled' }}>
          {module.label}
        </Typography>
        <Typography sx={{ display: { md: 'none' }, fontSize: fontSizes.xs, color: 'text.secondary' }} noWrap>
          {module.metricLabel ?? 'Sem registro próprio'}
        </Typography>
      </Box>
      <Typography sx={{ display: { xs: 'none', md: 'block' }, fontSize: fontSizes.sm, color: 'text.secondary' }} noWrap>
        {module.metricLabel ?? 'Sem registro próprio (lê os outros módulos)'}
      </Typography>
      <Typography sx={NUMBER_SX}>{module.periodCount == null ? '—' : n(module.periodCount)}</Typography>
      <Typography sx={{ ...NUMBER_SX, display: { xs: 'none', md: 'block' }, color: 'text.secondary' }}>
        {module.totalCount == null ? '—' : n(module.totalCount)}
      </Typography>
      <Typography sx={{ ...NUMBER_SX, display: { xs: 'none', md: 'block' }, color: 'text.secondary' }}>
        {n(module.requests)}
      </Typography>
      <Box sx={{ display: { xs: 'none', md: 'block' }, minWidth: 0 }}>
        {single ? (
          <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 600, color: enabled ? 'primary.dark' : 'text.disabled' }}>
            {!enabled ? 'Fora do plano' : module.activeTenants ? 'Em uso no período' : 'Habilitado, sem uso'}
          </Typography>
        ) : module.activeTenants == null ? (
          <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary' }}>
            Habilitado em {n(module.enabledTenants)}
          </Typography>
        ) : (
          <AdoptionBar value={module.activeTenants} max={module.enabledTenants} />
        )}
      </Box>
    </Box>
  );
}

function TenantRow({ tenant, onSelect }: { tenant: PlatformTenantUsage; onSelect: () => void }) {
  const used = Object.entries(tenant.usage).filter(([, u]) => u && u.period > 0).length;
  return (
    <Box
      {...clickableProps(onSelect, `Ver uso de ${tenant.name}`)}
      sx={{
        ...ROW_SX,
        gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', md: TENANT_COLS },
        cursor: 'pointer',
        '&:hover': { bgcolor: 'grey.50' },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: fontSizes.md, fontWeight: 700, color: tenant.active ? 'text.primary' : 'text.disabled' }} noWrap>
          {tenant.name}
        </Typography>
        <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }} noWrap>
          {tenant.slug}
          {!tenant.active && ' · Suspensa'}
        </Typography>
      </Box>
      <Typography sx={{ display: { xs: 'none', md: 'block' }, fontSize: fontSizes.sm, color: tenant.plan ? 'text.primary' : 'text.disabled' }} noWrap>
        {tenant.plan?.name ?? 'Sem plano'}
      </Typography>
      <Typography sx={{ ...NUMBER_SX, display: { xs: 'none', md: 'block' } }}>{n(tenant.activeUsers)}</Typography>
      <Typography sx={{ display: { xs: 'none', md: 'block' }, fontSize: fontSizes.sm, color: 'text.secondary' }} noWrap>
        {formatLastAccess(tenant.lastAccessAt)}
      </Typography>
      <Typography sx={NUMBER_SX}>
        {used}
        <Box component="span" sx={{ color: 'text.disabled', fontWeight: 600 }}>
          {' '}
          / {tenant.features.length}
        </Box>
      </Typography>
      <Typography sx={{ ...NUMBER_SX, display: { xs: 'none', md: 'block' } }}>
        {n(tenant.usage.appointments?.period ?? 0)}
      </Typography>
      <Typography sx={{ ...NUMBER_SX, display: { xs: 'none', md: 'block' } }}>
        {n(tenant.usage.finance?.period ?? 0)}
      </Typography>
      <Typography sx={{ display: { xs: 'none', md: 'block' }, fontSize: fontSizes.sm, color: 'text.secondary' }} noWrap>
        {formatBytes(tenant.storageBytes)}
      </Typography>
    </Box>
  );
}

/** Uso da plataforma por módulo do catálogo, agregado ou por clínica (só contagens). */
export function AdminUsage() {
  const month = currentMonth();
  const [tenantId, setTenantId] = useUrlState('clinica', '');
  const [from, setFrom] = useUrlState('de', month.from, urlDate);
  const [to, setTo] = useUrlState('ate', month.to, urlDate);

  const { data: tenants = [] } = useQuery({
    queryKey: ['admin', 'tenants', { search: '', status: 'ALL' }],
    queryFn: () => adminApi.listTenants(),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'usage', { tenantId, from, to }],
    queryFn: () => adminApi.getUsage({ tenantId: tenantId || undefined, from, to }),
    placeholderData: keepPreviousData,
    retry: false,
  });

  const single = !!tenantId;
  const totals = data?.totals;
  const isCurrentMonth = from === month.from && to === month.to;

  return (
    <Stack spacing={2.5}>
      <Card sx={{ p: 0, overflow: 'hidden' }}>
        <ListCardHeader
          nowrapFrom={null}
          title={
            <Typography sx={{ fontSize: fontSizes.md, color: 'text.secondary', fontWeight: 600 }}>
              {data ? (
                <>
                  Período{' '}
                  <Box component="span" sx={{ color: 'text.primary', fontWeight: 800 }}>
                    {formatDate(`${data.range.from}T12:00:00`)} – {formatDate(`${data.range.to}T12:00:00`)}
                  </Box>
                </>
              ) : (
                <Skeleton width={200} />
              )}
            </Typography>
          }
        >
          <TextField
            select
            size="small"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            inputProps={{ 'aria-label': 'Clínica' }}
            SelectProps={{ displayEmpty: true }}
            sx={{ ...LIST_HEADER_SELECT_SX, minWidth: { sm: 220 } }}
          >
            <MenuItem value="">Todas as clínicas</MenuItem>
            {tenants.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="date"
            size="small"
            value={from}
            onChange={(e) => e.target.value && setFrom(e.target.value)}
            inputProps={{ 'aria-label': 'De', max: to }}
            sx={LIST_HEADER_SELECT_SX}
          />
          <TextField
            type="date"
            size="small"
            value={to}
            onChange={(e) => e.target.value && setTo(e.target.value)}
            inputProps={{ 'aria-label': 'Até', min: from }}
            sx={LIST_HEADER_SELECT_SX}
          />
          {!isCurrentMonth && (
            <Button
              size="small"
              onClick={() => {
                setFrom(month.from);
                setTo(month.to);
              }}
            >
              Este mês
            </Button>
          )}
        </ListCardHeader>
        {error && (
          <Typography color="error" sx={{ px: 2.75, py: 1.5, fontSize: fontSizes.sm }}>
            {getApiErrorMessage(error, 'Não foi possível carregar o uso.')}
          </Typography>
        )}
      </Card>

      <Box sx={STATS_GRID_SX}>
        <StatCard
          label={single ? 'Status da clínica' : `Clínicas (${totals?.activeTenants ?? 0} ativas)`}
          value={single ? (data?.tenants[0]?.active ? 'Ativa' : 'Suspensa') : (totals?.tenants ?? 0)}
          loading={isLoading}
        />
        <StatCard label="Usuários ativos" value={totals?.activeUsers ?? 0} loading={isLoading} />
        <StatCard
          label="Acessaram no período"
          value={totals?.usersAccessedInPeriod ?? 0}
          loading={isLoading}
        />
        <StatCard
          label={totals ? `Armazenamento (${n(totals.files)} ${totals.files === 1 ? 'arquivo' : 'arquivos'})` : 'Armazenamento'}
          value={formatBytes(totals?.storageBytes ?? 0)}
          loading={isLoading}
          skeletonWidth={90}
        />
      </Box>

      <Card sx={{ p: 0, overflow: 'hidden' }}>
        <Typography component="h3" sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider', fontSize: fontSizes.md, fontWeight: 800 }}>
          Uso por módulo
        </Typography>
        <Box sx={{ overflowX: 'auto' }}>
          <Box sx={{ ...HEAD_SX, gridTemplateColumns: MODULE_COLS }}>
            <span>Módulo</span>
            <span>O que é contado</span>
            <span>No período</span>
            <span>Total</span>
            <span>Requisições</span>
            <span>{single ? 'Situação' : 'Clínicas usando / habilitadas'}</span>
          </Box>
          {isLoading ? (
            <Stack spacing={1.25} sx={{ px: 2.5, py: 2 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} variant="rounded" height={40} />
              ))}
            </Stack>
          ) : (
            data?.modules.map((m) => <ModuleRow key={m.key} module={m} single={single} />)
          )}
        </Box>
      </Card>

      {!single && (
        <Card sx={{ p: 0, overflow: 'hidden' }}>
          <Typography component="h3" sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider', fontSize: fontSizes.md, fontWeight: 800 }}>
            Por clínica
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <Box sx={{ ...HEAD_SX, gridTemplateColumns: TENANT_COLS, minWidth: 980 }}>
              <span>Clínica</span>
              <span>Plano</span>
              <span>Usuários</span>
              <span>Último acesso</span>
              <span>Módulos em uso</span>
              <span>Agendamentos</span>
              <span>Lançamentos</span>
              <span>Armazen.</span>
            </Box>
            {isLoading ? (
              <Stack spacing={1.25} sx={{ px: 2.5, py: 2 }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} variant="rounded" height={44} />
                ))}
              </Stack>
            ) : data?.tenants.length ? (
              <Box sx={{ minWidth: { md: 980 } }}>
                {data.tenants.map((t) => (
                  <TenantRow key={t.id} tenant={t} onSelect={() => setTenantId(t.id)} />
                ))}
              </Box>
            ) : (
              <Typography color="text.secondary" sx={{ px: 2.5, py: 5, textAlign: 'center' }}>
                Nenhuma clínica cadastrada.
              </Typography>
            )}
          </Box>
        </Card>
      )}

      <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', px: 0.5 }}>
        Contagens derivadas dos registros de cada módulo (sem dados de pacientes). “Requisições” = chamadas à API
        do módulo no período, medidas desde a observabilidade (detalhes em Saúde da API).
        “Módulos em uso” = módulos com pelo menos um registro no período, sobre os habilitados no plano.
      </Typography>
    </Stack>
  );
}
