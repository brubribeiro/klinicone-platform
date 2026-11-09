import { useDeferredValue } from 'react';
import {
  Box,
  Button,
  Card,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../api/admin';
import { useUrlState, urlEnum, urlPage } from '../../../../frontend/src/hooks/useUrlState';
import { LIST_HEADER_SELECT_SX, ListCardHeader, ListSearchField } from '../../../../frontend/src/components/ListCardHeader';
import { FeedbackDetailDialog } from '../components/FeedbackDetailDialog';
import { RowActionButton } from '../../../../frontend/src/components/RowActionButton';
import { useAppDialog } from '../../../../frontend/src/contexts/AppDialogContext';
import { useAppToast } from '../../../../frontend/src/contexts/AppToastContext';
import { getApiErrorMessage } from '../../../../frontend/src/utils/apiError';
import { formatDateTime } from '../components/adminUi';
import {
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_META,
  FeedbackStatusPill,
  FeedbackTypePill,
} from '../components/feedbackUi';
import { clickableProps } from '../../../../frontend/src/utils/a11y';
import { fontSizes } from '../../../../frontend/src/theme/fontSizes';
import type { AdminFeedbackReport, FeedbackStatus, FeedbackType } from '../../../../frontend/src/types';

const PAGE_SIZE = 25;
const GRID_COLS = '96px minmax(0, 2.4fr) minmax(0, 1.2fr) minmax(0, 1.2fr) 140px 104px 30px';
const GRID_MIN_WIDTH = 900;

type StatusFilter = 'ALL' | FeedbackStatus;
type TypeFilter = 'ALL' | FeedbackType;
const STATUS_CODEC = urlEnum<StatusFilter>(['ALL', ...FEEDBACK_STATUSES]);
const TYPE_CODEC = urlEnum<TypeFilter>(['ALL', 'BUG', 'SUGGESTION']);

const STATUS_FILTER_SX = {
  flexWrap: 'wrap',
  '& .MuiToggleButton-root': {
    textTransform: 'none',
    fontWeight: 700,
    fontSize: fontSizes.sm,
    px: 1.5,
    fontVariantNumeric: 'tabular-nums',
  },
} as const;

/** Central de reports (bugs e sugestões) de todas as clínicas — visão do super-admin. */
export function AdminFeedback() {
  const [status, setStatus] = useUrlState<StatusFilter>('status', 'OPEN', STATUS_CODEC);
  const [type, setType] = useUrlState<TypeFilter>('tipo', 'ALL', TYPE_CODEC);
  const [tenantId, setTenantId] = useUrlState('clinica', '');
  const [search, setSearch] = useUrlState('busca', '');
  const [page, setPage] = useUrlState('pagina', 0, urlPage);
  const [openId, setOpenId] = useUrlState('report', '');
  const deferredSearch = useDeferredValue(search.trim());
  const { confirm } = useAppDialog();
  const toast = useAppToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteFeedback(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'feedback', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      toast.success('Report excluído.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível excluir o report.')),
  });

  const handleDelete = async (report: AdminFeedbackReport) => {
    const ok = await confirm({
      title: 'Excluir report',
      message: `Excluir “${report.title}” (${report.tenant.name}) de vez?`,
      details: ['Não dá para desfazer.', 'Notificações já enviadas ao autor continuam com ele.'],
      confirmLabel: 'Excluir',
      confirmColor: 'error',
    });
    if (ok) deleteMutation.mutate(report.id);
  };

  const { data: tenants = [] } = useQuery({
    queryKey: ['admin', 'tenants', { search: '', status: 'ALL' }],
    queryFn: () => adminApi.listTenants(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'feedback', 'list', { status, type, tenantId, search: deferredSearch, page }],
    queryFn: () =>
      adminApi.listFeedback({
        status: status === 'ALL' ? undefined : status,
        type: type === 'ALL' ? undefined : type,
        tenantId: tenantId || undefined,
        search: deferredSearch || undefined,
        page: page + 1,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const reports = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const counts = data?.counts;
  const allCount = counts ? counts.OPEN + counts.TRIAGED + counts.CLOSED : 0;
  const filtersActive = !!deferredSearch || type !== 'ALL' || !!tenantId;

  const resetPage = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(0);
  };

  const tabs: { value: StatusFilter; label: string; count: number }[] = [
    ...FEEDBACK_STATUSES.map((s) => ({
      value: s as StatusFilter,
      label: FEEDBACK_STATUS_META[s].label,
      count: counts?.[s] ?? 0,
    })),
    { value: 'ALL', label: 'Todos', count: allCount },
  ];

  return (
    <Card sx={{ p: 0, overflow: 'hidden' }}>
      <ListCardHeader
        breakpoint="lg"
        nowrapFrom={null}
        title={
          <ToggleButtonGroup
            exclusive
            size="small"
            color="primary"
            value={status}
            onChange={(_, value: StatusFilter | null) => {
              if (value) resetPage(setStatus)(value);
            }}
            aria-label="Status"
            sx={STATUS_FILTER_SX}
          >
            {tabs.map((tab) => (
              <ToggleButton key={tab.value} value={tab.value}>
                {tab.label} ({isLoading ? '…' : tab.count})
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        }
      >
        <TextField
          select
          size="small"
          value={type}
          onChange={(e) => resetPage(setType)(e.target.value as TypeFilter)}
          inputProps={{ 'aria-label': 'Tipo' }}
          sx={LIST_HEADER_SELECT_SX}
        >
          <MenuItem value="ALL">Todos os tipos</MenuItem>
          <MenuItem value="BUG">Bugs</MenuItem>
          <MenuItem value="SUGGESTION">Sugestões</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          value={tenantId}
          onChange={(e) => resetPage(setTenantId)(e.target.value)}
          inputProps={{ 'aria-label': 'Clínica' }}
          SelectProps={{ displayEmpty: true }}
          sx={{ ...LIST_HEADER_SELECT_SX, minWidth: { sm: 200 } }}
        >
          <MenuItem value="">Todas as clínicas</MenuItem>
          {tenants.map((t) => (
            <MenuItem key={t.id} value={t.id}>
              {t.name}
            </MenuItem>
          ))}
        </TextField>
        <ListSearchField value={search} onChange={resetPage(setSearch)} placeholder="Buscar report..." />
      </ListCardHeader>

      <Box sx={{ overflowX: 'auto' }}>
        <Box
          sx={{
            display: { xs: 'none', md: 'grid' },
            gridTemplateColumns: GRID_COLS,
            minWidth: GRID_MIN_WIDTH,
            gap: 1.5,
            px: 2.5,
            py: 1.75,
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'grey.50',
            fontSize: fontSizes['2xs'],
            fontWeight: 800,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'text.disabled',
          }}
        >
          <span>Tipo</span>
          <span>Título</span>
          <span>Clínica</span>
          <span>Autor</span>
          <span>Data</span>
          <span>Status</span>
          <span />
        </Box>

        {isLoading ? (
          <Stack spacing={1.25} sx={{ px: 2.5, py: 2 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={48} />
            ))}
          </Stack>
        ) : reports.length === 0 ? (
          <Typography color="text.secondary" sx={{ px: 2.5, py: 6, textAlign: 'center' }}>
            {filtersActive || status !== 'ALL' ? 'Nenhum report com estes filtros.' : 'Nenhum report recebido.'}
          </Typography>
        ) : (
          reports.map((r) => (
            <Box
              key={r.id}
              {...clickableProps(() => setOpenId(r.id), `Abrir report ${r.title}`)}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', md: GRID_COLS },
                minWidth: { md: GRID_MIN_WIDTH },
                gap: 1.5,
                px: { xs: 2, md: 2.5 },
                py: 1.5,
                borderBottom: 1,
                borderColor: 'grey.100',
                alignItems: 'center',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'grey.50' },
                '&:last-of-type': { borderBottom: 0 },
              }}
            >
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <FeedbackTypePill type={r.type} />
              </Box>
              <Box sx={{ minWidth: 0, lineHeight: 1.3 }}>
                <Typography sx={{ fontSize: fontSizes.md, fontWeight: 700 }} noWrap title={r.title}>
                  {r.title}
                </Typography>
                <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }} noWrap title={r.pageUrl ?? undefined}>
                  <Box component="span" sx={{ display: { md: 'none' } }}>
                    {r.tenant.name} · {formatDateTime(r.createdAt)}
                  </Box>
                  <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
                    {r.pageUrl || 'Sem página'}
                  </Box>
                </Typography>
              </Box>
              <Typography sx={{ display: { xs: 'none', md: 'block' }, fontSize: fontSizes.sm, fontWeight: 600 }} noWrap>
                {r.tenant.name}
              </Typography>
              <Box sx={{ display: { xs: 'none', md: 'block' }, minWidth: 0 }}>
                <Typography sx={{ fontSize: fontSizes.sm }} noWrap title={r.user.email}>
                  {r.user.name}
                </Typography>
              </Box>
              <Typography
                sx={{
                  display: { xs: 'none', md: 'block' },
                  fontSize: fontSizes.xs,
                  color: 'text.secondary',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatDateTime(r.createdAt)}
              </Typography>
              <Box>
                <FeedbackStatusPill status={r.status} />
              </Box>
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <RowActionButton
                  title="Excluir"
                  ariaLabel={`Excluir report ${r.title}`}
                  danger
                  onClick={(ev) => {
                    ev.stopPropagation();
                    void handleDelete(r);
                  }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                </RowActionButton>
              </Box>
            </Box>
          ))
        )}
      </Box>

      {totalPages > 1 && (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 2.5, py: 1.5, borderTop: 1, borderColor: 'divider' }}
        >
          <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', fontWeight: 600 }}>
            Página {page + 1} de {totalPages}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Anterior
            </Button>
            <Button size="small" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>
              Próxima
            </Button>
          </Stack>
        </Stack>
      )}

      <FeedbackDetailDialog reportId={openId || null} onClose={() => setOpenId('')} />
    </Card>
  );
}
