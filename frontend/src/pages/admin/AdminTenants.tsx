import { useDeferredValue, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  IconButton,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import LoginIcon from '@mui/icons-material/Login';
import BlockIcon from '@mui/icons-material/Block';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { adminApi, type TenantStatusFilter } from '../../api/admin';
import { useUrlState, urlEnum } from '../../hooks/useUrlState';
import {
  LIST_HEADER_ACTION_SX,
  LIST_HEADER_SELECT_SX,
  ListCardHeader,
  ListSearchField,
} from '../../components/ListCardHeader';
import { TenantFormDialog } from '../../components/admin/TenantFormDialog';
import { useTenantActions } from '../../components/admin/useTenantActions';
import { ROW_ACTION_SX, TenantStatusPill, formatLastAccess } from '../../components/admin/adminUi';
import { adminPath } from '../../utils/adminPath';
import { clickableProps } from '../../utils/a11y';
import { fontSizes } from '../../theme/fontSizes';
import { formatSpecialtiesList } from '../../features/clinicSpecialties';
import type { AdminTenant } from '../../types';

const GRID_COLS =
  'minmax(0, 2.2fr) minmax(0, 1fr) minmax(0, 0.8fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1fr) minmax(0, 0.8fr) 136px';
const GRID_MIN_WIDTH = 1000;

type StatusFilter = 'ALL' | TenantStatusFilter;
const STATUS_CODEC = urlEnum<StatusFilter>(['ALL', 'active', 'suspended']);

const numberCellSx = {
  display: { xs: 'none', md: 'block' },
  fontSize: fontSizes.sm,
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
} as const;

/** Lista de clínicas da plataforma (super-admin). */
export function AdminTenants() {
  const navigate = useNavigate();
  const actions = useTenantActions();
  const [search, setSearch] = useUrlState('busca', '');
  const [status, setStatus] = useUrlState<StatusFilter>('status', 'ALL', STATUS_CODEC);
  const deferredSearch = useDeferredValue(search.trim());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminTenant | null>(null);

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['admin', 'tenants', { search: deferredSearch, status }],
    queryFn: () =>
      adminApi.listTenants({
        search: deferredSearch || undefined,
        status: status === 'ALL' ? undefined : status,
      }),
    placeholderData: keepPreviousData,
  });

  const filtersActive = !!deferredSearch || status !== 'ALL';

  const openDetail = (t: AdminTenant) => navigate(adminPath(`/clinicas/${t.id}`));

  return (
    <Box>
      <Card sx={{ p: 0, overflow: 'hidden' }}>
        <ListCardHeader
          title={
            <Typography sx={{ fontSize: fontSizes.md, color: 'text.secondary', fontWeight: 600 }}>
              {isLoading ? (
                <Skeleton width={180} />
              ) : (
                <>
                  <Box component="span" sx={{ color: 'text.primary', fontWeight: 800 }}>
                    {tenants.length}
                  </Box>{' '}
                  {tenants.length === 1 ? 'clínica' : 'clínicas'}
                  {filtersActive ? ' encontradas' : ' na plataforma'}
                </>
              )}
            </Typography>
          }
        >
          <TextField
            select
            size="small"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            inputProps={{ 'aria-label': 'Status' }}
            sx={LIST_HEADER_SELECT_SX}
          >
            <MenuItem value="ALL">Todos os status</MenuItem>
            <MenuItem value="active">Ativas</MenuItem>
            <MenuItem value="suspended">Suspensas</MenuItem>
          </TextField>
          <ListSearchField value={search} onChange={setSearch} placeholder="Buscar clínica..." />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            sx={LIST_HEADER_ACTION_SX}
          >
            Nova clínica
          </Button>
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
            <span>Clínica</span>
            <span>Plano</span>
            <span>Usuários</span>
            <span>Pacientes</span>
            <span>Agend. do mês</span>
            <span>Último acesso</span>
            <span>Status</span>
            <span />
          </Box>

          {isLoading ? (
            <Box sx={{ px: 2.5, py: 2 }}>
              <Stack spacing={1.25}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} variant="rounded" height={48} />
                ))}
              </Stack>
            </Box>
          ) : tenants.length === 0 ? (
            <Box sx={{ px: 2.5, py: 6, textAlign: 'center' }}>
              <Typography color="text.secondary">
                {filtersActive ? 'Nenhuma clínica encontrada com os filtros.' : 'Nenhuma clínica cadastrada.'}
              </Typography>
            </Box>
          ) : (
            tenants.map((t) => (
              <Box
                key={t.id}
                {...clickableProps(() => openDetail(t), `Abrir ${t.name}`)}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', md: GRID_COLS },
                  minWidth: { md: GRID_MIN_WIDTH },
                  gap: 1.5,
                  px: { xs: 2, md: 2.5 },
                  py: 1.75,
                  borderBottom: 1,
                  borderColor: 'grey.100',
                  alignItems: 'center',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'grey.50' },
                  '&:last-of-type': { borderBottom: 0 },
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '10px',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: fontSizes.xs,
                      fontWeight: 800,
                      color: t.active ? 'primary.main' : 'text.disabled',
                      bgcolor: (th) => alpha(t.active ? th.palette.primary.main : th.palette.text.disabled, 0.09),
                    }}
                  >
                    {t.name.trim().charAt(0).toUpperCase()}
                  </Box>
                  <Box sx={{ minWidth: 0, lineHeight: 1.3 }}>
                    <Typography sx={{ fontSize: fontSizes.md, fontWeight: 700 }} noWrap title={t.name}>
                      {t.name}
                    </Typography>
                    <Typography
                      sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }}
                      noWrap
                      title={[formatSpecialtiesList(t.specialties), t.city].filter(Boolean).join(' · ') || t.slug}
                    >
                      {t.slug}
                      {(t.specialties.length > 0 || t.city) && (
                        <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
                          {' · '}
                          {[formatSpecialtiesList(t.specialties), t.city].filter(Boolean).join(' · ')}
                        </Box>
                      )}
                      <Box component="span" sx={{ display: { md: 'none' } }}>
                        {' · '}
                        {t.active ? 'Ativa' : 'Suspensa'}
                      </Box>
                    </Typography>
                  </Box>
                </Stack>

                <Typography
                  sx={{
                    display: { xs: 'none', md: 'block' },
                    fontSize: fontSizes.sm,
                    fontWeight: 600,
                    color: t.plan ? (t.plan.active ? 'text.primary' : 'text.secondary') : 'text.disabled',
                  }}
                  noWrap
                  title={t.plan && !t.plan.active ? 'Plano desativado' : undefined}
                >
                  {t.plan?.name ?? 'Sem plano'}
                </Typography>
                <Typography sx={numberCellSx}>{t.metrics.activeUsers}</Typography>
                <Typography sx={numberCellSx}>{t.metrics.patients}</Typography>
                <Typography sx={numberCellSx}>{t.metrics.appointmentsThisMonth}</Typography>
                <Typography
                  sx={{ display: { xs: 'none', md: 'block' }, fontSize: fontSizes.sm, color: 'text.secondary' }}
                  noWrap
                >
                  {formatLastAccess(t.metrics.lastAccessAt)}
                </Typography>
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                  <TenantStatusPill active={t.active} />
                </Box>

                <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                  <Tooltip title="Entrar como">
                    <IconButton
                      aria-label={`Entrar como ${t.name}`}
                      disabled={actions.pending}
                      onClick={(e) => {
                        e.stopPropagation();
                        actions.enter(t);
                      }}
                      sx={{ ...ROW_ACTION_SX, color: 'primary.main' }}
                    >
                      <LoginIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Editar">
                    <IconButton
                      aria-label={`Editar ${t.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(t);
                        setFormOpen(true);
                      }}
                      sx={ROW_ACTION_SX}
                    >
                      <EditIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  {t.active ? (
                    <Tooltip title="Suspender">
                      <IconButton
                        aria-label={`Suspender ${t.name}`}
                        disabled={actions.pending}
                        onClick={(e) => {
                          e.stopPropagation();
                          actions.suspend(t);
                        }}
                        sx={{ ...ROW_ACTION_SX, color: 'error.main' }}
                      >
                        <BlockIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Tooltip title="Reativar">
                      <IconButton
                        aria-label={`Reativar ${t.name}`}
                        disabled={actions.pending}
                        onClick={(e) => {
                          e.stopPropagation();
                          actions.reactivate(t);
                        }}
                        sx={{ ...ROW_ACTION_SX, color: 'success.main' }}
                      >
                        <PlayCircleOutlineIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </Box>
            ))
          )}
        </Box>
      </Card>

      <TenantFormDialog open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
    </Box>
  );
}
