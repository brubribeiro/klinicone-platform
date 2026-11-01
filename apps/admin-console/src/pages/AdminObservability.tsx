import type { ReactNode } from 'react';
import { Box, Card, MenuItem, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { adminApi } from '../api/admin';
import { useUrlState, urlEnum } from '../../../../frontend/src/hooks/useUrlState';
import { LIST_HEADER_SELECT_SX, ListCardHeader } from '../../../../frontend/src/components/ListCardHeader';
import { StatCard } from '../../../../frontend/src/components/StatCard';
import { formatDateTime } from '../components/adminUi';
import { getApiErrorMessage } from '../../../../frontend/src/utils/apiError';
import { fontSizes } from '../../../../frontend/src/theme/fontSizes';
import type { ApiRequestErrorEntry, ApiRouteStats } from '../../../../frontend/src/types';

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
const SECTION_TITLE_SX = {
  px: 2.5,
  py: 1.75,
  borderBottom: 1,
  borderColor: 'divider',
  fontSize: fontSizes.md,
  fontWeight: 800,
} as const;

const SLOW_COLS = 'minmax(0, 2.4fr) 110px 100px 100px 100px';
const ERROR_COLS = 'minmax(0, 2.4fr) 100px 100px 110px';
const RECENT_COLS = '150px minmax(0, 1.6fr) 70px minmax(0, 2fr) minmax(0, 1fr)';

const WINDOWS = [
  { value: '24', label: 'Últimas 24 horas' },
  { value: '168', label: 'Últimos 7 dias' },
  { value: '720', label: 'Últimos 30 dias' },
] as const;
type WindowValue = (typeof WINDOWS)[number]['value'];
const urlWindow = urlEnum<WindowValue>(WINDOWS.map((w) => w.value));

/** p95 acima de 1 s chama atenção; acima de 2,5 s é lento. */
const SLOW_MS = 1000;
const VERY_SLOW_MS = 2500;

const n = (v: number) => v.toLocaleString('pt-BR');
const ms = (v: number | null) => (v == null ? '—' : v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s` : `${n(v)} ms`);
const pct = (v: number) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

function latencyColor(v: number | null) {
  if (v == null) return 'text.secondary';
  return v > VERY_SLOW_MS ? 'error.main' : v > SLOW_MS ? 'warning.dark' : 'text.primary';
}

function RouteLabel({ method, route }: { method: string; route: string }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
      <Box
        component="span"
        sx={{
          flexShrink: 0,
          px: 0.75,
          py: 0.25,
          borderRadius: 1,
          bgcolor: 'grey.100',
          color: 'text.secondary',
          fontSize: fontSizes['2xs'],
          fontWeight: 800,
          letterSpacing: '0.04em',
        }}
      >
        {method}
      </Box>
      <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 600, fontFamily: 'monospace' }} noWrap title={route}>
        {route}
      </Typography>
    </Stack>
  );
}

function Section({
  title,
  head,
  cols,
  minWidth,
  loading,
  empty,
  children,
}: {
  title: string;
  head: string[];
  cols: string;
  minWidth: number;
  loading: boolean;
  empty: string | null;
  children: ReactNode;
}) {
  return (
    <Card sx={{ p: 0, overflow: 'hidden' }}>
      <Typography component="h3" sx={SECTION_TITLE_SX}>
        {title}
      </Typography>
      <Box sx={{ overflowX: 'auto' }}>
        <Box sx={{ ...HEAD_SX, gridTemplateColumns: cols, minWidth }}>
          {head.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </Box>
        {loading ? (
          <Stack spacing={1.25} sx={{ px: 2.5, py: 2 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={36} />
            ))}
          </Stack>
        ) : empty ? (
          <Typography color="text.secondary" sx={{ px: 2.5, py: 4, textAlign: 'center', fontSize: fontSizes.sm }}>
            {empty}
          </Typography>
        ) : (
          <Box sx={{ minWidth: { md: minWidth } }}>{children}</Box>
        )}
      </Box>
    </Card>
  );
}

function SlowRouteRow({ route }: { route: ApiRouteStats }) {
  return (
    <Box sx={{ ...ROW_SX, gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', md: SLOW_COLS } }}>
      <RouteLabel method={route.method} route={route.route} />
      <Typography sx={{ ...NUMBER_SX, display: { xs: 'none', md: 'block' }, color: 'text.secondary' }}>
        {n(route.count)}
      </Typography>
      <Typography sx={{ ...NUMBER_SX, display: { xs: 'none', md: 'block' }, color: 'text.secondary' }}>
        {ms(route.avgMs)}
      </Typography>
      <Typography sx={{ ...NUMBER_SX, color: latencyColor(route.p95Ms) }}>{ms(route.p95Ms)}</Typography>
      <Typography sx={{ ...NUMBER_SX, display: { xs: 'none', md: 'block' }, color: latencyColor(route.maxMs) }}>
        {ms(route.maxMs)}
      </Typography>
    </Box>
  );
}

function ErrorRouteRow({ route }: { route: ApiRouteStats }) {
  return (
    <Box sx={{ ...ROW_SX, gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', md: ERROR_COLS } }}>
      <RouteLabel method={route.method} route={route.route} />
      <Typography sx={{ ...NUMBER_SX, color: 'error.main' }}>{n(route.serverErrors)}</Typography>
      <Typography sx={{ ...NUMBER_SX, display: { xs: 'none', md: 'block' } }}>{pct(route.errorRate)}</Typography>
      <Typography sx={{ ...NUMBER_SX, display: { xs: 'none', md: 'block' }, color: 'text.secondary' }}>
        {n(route.count)}
      </Typography>
    </Box>
  );
}

function RecentErrorRow({ error }: { error: ApiRequestErrorEntry }) {
  return (
    <Box sx={{ ...ROW_SX, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: RECENT_COLS } }}>
      <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }} noWrap>
        {formatDateTime(error.createdAt)}
      </Typography>
      <RouteLabel method={error.method} route={error.route} />
      <Typography sx={{ ...NUMBER_SX, color: 'error.main' }}>{error.statusCode}</Typography>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 700 }} noWrap title={error.errorName ?? undefined}>
          {error.errorName ?? 'Erro sem tipo'}
        </Typography>
        {error.message && (
          <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }} noWrap title={error.message}>
            {error.message}
          </Typography>
        )}
      </Box>
      <Typography
        sx={{ fontSize: fontSizes.sm, color: error.tenant ? 'text.primary' : 'text.disabled' }}
        noWrap
        title={error.tenant?.name}
      >
        {error.tenant?.name ?? 'Sem clínica'}
      </Typography>
    </Box>
  );
}

/** Saúde da API (super-admin): erros 5xx e rotas lentas, a partir das métricas agregadas por hora. */
export function AdminObservability() {
  const [windowHours, setWindowHours] = useUrlState<WindowValue>('janela', '24', urlWindow);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'observability', { hours: windowHours }],
    queryFn: () => adminApi.getObservability({ hours: Number(windowHours) }),
    placeholderData: keepPreviousData,
    // Métricas são gravadas a cada minuto
    refetchInterval: 60_000,
    retry: false,
  });

  const totals = data?.totals;
  const hasTraffic = !!totals?.count;

  return (
    <Stack spacing={2.5}>
      <Card sx={{ p: 0, overflow: 'hidden' }}>
        <ListCardHeader
          nowrapFrom={null}
          title={
            <Typography sx={{ fontSize: fontSizes.md, color: 'text.secondary', fontWeight: 600 }}>
              {data ? (
                <>
                  Desde{' '}
                  <Box component="span" sx={{ color: 'text.primary', fontWeight: 800 }}>
                    {formatDateTime(data.window.since)}
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
            value={windowHours}
            onChange={(e) => setWindowHours(e.target.value as WindowValue)}
            inputProps={{ 'aria-label': 'Janela' }}
            sx={{ ...LIST_HEADER_SELECT_SX, minWidth: { sm: 200 } }}
          >
            {WINDOWS.map((w) => (
              <MenuItem key={w.value} value={w.value}>
                {w.label}
              </MenuItem>
            ))}
          </TextField>
        </ListCardHeader>
        {error && (
          <Typography color="error" sx={{ px: 2.75, py: 1.5, fontSize: fontSizes.sm }}>
            {getApiErrorMessage(error, 'Não foi possível carregar a saúde da API.')}
          </Typography>
        )}
      </Card>

      <Box sx={STATS_GRID_SX}>
        <StatCard
          label={totals ? `Requisições (${n(totals.routes)} ${totals.routes === 1 ? 'rota' : 'rotas'})` : 'Requisições'}
          value={n(totals?.count ?? 0)}
          loading={isLoading}
        />
        <StatCard
          label={totals ? `Erros 5xx (${pct(totals.errorRate)})` : 'Erros 5xx'}
          value={n(totals?.serverErrors ?? 0)}
          color={totals?.serverErrors ? 'error.main' : undefined}
          loading={isLoading}
        />
        <StatCard
          label="p95 geral"
          value={ms(totals?.p95Ms ?? null)}
          color={latencyColor(totals?.p95Ms ?? null)}
          loading={isLoading}
          skeletonWidth={90}
        />
        <StatCard
          label={totals?.avgMs != null ? `Mais lenta (média ${ms(totals.avgMs)})` : 'Mais lenta'}
          value={ms(totals?.maxMs ?? null)}
          color={latencyColor(totals?.maxMs ?? null)}
          loading={isLoading}
          skeletonWidth={90}
        />
      </Box>

      <Section
        title="Rotas mais lentas"
        head={['Rota', 'Requisições', 'Média', 'p95', 'Máximo']}
        cols={SLOW_COLS}
        minWidth={760}
        loading={isLoading}
        empty={hasTraffic ? null : 'Nenhuma requisição registrada nesta janela.'}
      >
        {data?.slowRoutes.map((r) => <SlowRouteRow key={`${r.method} ${r.route}`} route={r} />)}
      </Section>

      <Section
        title="Erros 5xx por rota"
        head={['Rota', 'Erros 5xx', 'Taxa', 'Requisições']}
        cols={ERROR_COLS}
        minWidth={680}
        loading={isLoading}
        empty={data?.errorRoutes.length ? null : 'Nenhum erro 5xx nesta janela.'}
      >
        {data?.errorRoutes.map((r) => <ErrorRouteRow key={`${r.method} ${r.route}`} route={r} />)}
      </Section>

      <Section
        title="Erros recentes"
        head={['Quando', 'Rota', 'Status', 'Erro', 'Clínica']}
        cols={RECENT_COLS}
        minWidth={900}
        loading={isLoading}
        empty={data?.recentErrors.length ? null : 'Nenhum erro 5xx nesta janela.'}
      >
        {data?.recentErrors.map((e) => <RecentErrorRow key={e.id} error={e} />)}
      </Section>

      <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', px: 0.5 }}>
        Métricas agregadas por hora e rota, gravadas a cada minuto e guardadas por 30 dias. O p95 é estimado por
        faixas de duração (50 ms, 100 ms, 250 ms, 500 ms, 1 s, 2,5 s, 5 s). Dos erros fica só o tipo e o resumo da
        mensagem — sem corpo, parâmetros ou dados de pacientes.
      </Typography>
    </Stack>
  );
}
