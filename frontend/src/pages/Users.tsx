import { useMemo, useState } from 'react';
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
  type Theme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SwitchAccountIcon from '@mui/icons-material/SwitchAccount';
import StarIcon from '@mui/icons-material/Star';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUrlState, urlEnum, urlPage } from '../hooks/useUrlState';
import {
  ACTIVE_FILTER_CODEC,
  matchFields,
  matchesActiveFilter,
  type ActiveFilter,
} from '../utils/listFilters';
import { usersApi } from '../api/users';
import { UserFormDialog } from '../components/users/UserFormDialog';
import {
  LIST_HEADER_ACTION_SX,
  LIST_HEADER_SELECT_SX,
  ListCardHeader,
  ListSearchField,
} from '../components/ListCardHeader';
import { useAuth } from '../contexts/AuthContext';
import { useAppDialog } from '../contexts/AppDialogContext';
import { useAppToast } from '../contexts/AppToastContext';
import { getApiErrorMessage } from '../utils/apiError';
import { usePermissions } from '../contexts/usePermissions';
import type { UserSummary } from '../types';
import { fontSizes } from '../theme/fontSizes';

const PAGE_SIZE = 8;
const GRID_COLS = 'minmax(0, 2.2fr) minmax(0, 1fr) minmax(0, 1.3fr) minmax(0, 0.9fr) 112px';
const GRID_MIN_WIDTH = 760;
const INFO_COLOR = '#5BA8DE';

const ROW_ACTION_SX = {
  width: 30,
  height: 30,
  borderRadius: '9px',
  border: 1,
  borderColor: 'divider',
  bgcolor: 'background.paper',
  color: 'text.secondary',
} as const;

function initialsFor(name: string) {
  // Ignora títulos (Dr., Dra., Enf.) para as iniciais refletirem o nome.
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((w) => w && !/^(dra?|enf)\.?$/i.test(w));
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function Pill({ label, color, bg }: { label: string; color: string; bg: string | ((t: Theme) => string) }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        fontSize: fontSizes.xs,
        fontWeight: 700,
        px: 1,
        py: 0.4,
        borderRadius: '8px',
        whiteSpace: 'nowrap',
        color,
        bgcolor: bg,
      }}
    >
      {label}
    </Box>
  );
}

type ProfessionalFilter = 'ALL' | 'YES' | 'NO';
const PROFESSIONAL_FILTER_CODEC = urlEnum<ProfessionalFilter>(['ALL', 'YES', 'NO']);

export function Users() {
  const queryClient = useQueryClient();
  const { user: me, impersonate } = useAuth();
  const { confirm } = useAppDialog();
  const toast = useAppToast();
  const { has } = usePermissions();
  const canCreate = has('users:create');
  const canEdit = has('users:edit');
  const canDelete = has('users:delete');
  const canImpersonate = me?.roleName === 'Administrador';

  const [search, setSearch] = useUrlState('busca', '');
  const [activeFilter, setActiveFilter] = useUrlState<ActiveFilter>('status', 'ALL', ACTIVE_FILTER_CODEC);
  const [roleFilter, setRoleFilter] = useUrlState('perfil', 'ALL');
  const [professionalFilter, setProfessionalFilter] = useUrlState<ProfessionalFilter>('profissional', 'ALL', PROFESSIONAL_FILTER_CODEC);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserSummary | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  });

  const roleOptions = useMemo(() => {
    const names = new Set(users.map((u) => u.role?.name).filter(Boolean) as string[]);
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [users]);

  const filtered = useMemo(
    () =>
      users.filter((u) => {
        if (!matchesActiveFilter(u.active, activeFilter)) return false;
        if (roleFilter !== 'ALL' && u.role?.name !== roleFilter) return false;
        if (professionalFilter === 'YES' && !u.providesAppointments) return false;
        if (professionalFilter === 'NO' && u.providesAppointments) return false;
        return matchFields(search, u.name, u.email, u.role?.name);
      }),
    [users, search, activeFilter, roleFilter, professionalFilter],
  );

  const [page, setPage] = useUrlState('pagina', 0, urlPage);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const rows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário excluído.');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Não foi possível excluir o usuário.'));
    },
  });

  const handleEdit = (u: UserSummary) => {
    setEditing(u);
    setFormOpen(true);
  };

  const handleImpersonate = async (u: UserSummary) => {
    const ok = await confirm({
      title: 'Personificar usuário',
      message: `Entrar como ${u.name}? Você poderá voltar a qualquer momento.`,
      confirmLabel: 'Entrar',
    });
    if (ok) impersonate(u.id);
  };

  const handleDelete = async (u: UserSummary) => {
    const ok = await confirm({
      title: 'Excluir usuário',
      message: `Excluir ${u.name}? Se houver agendamentos vinculados, o usuário será apenas desativado.`,
      confirmLabel: 'Excluir',
      confirmColor: 'error',
    });
    if (ok) deleteMutation.mutate(u.id);
  };

  return (
    <Box>
      <Card data-tour="users-list" sx={{ p: 0, overflow: 'hidden' }}>
        <ListCardHeader
          title={
          <Typography sx={{ fontSize: fontSizes.md, color: 'text.secondary', fontWeight: 600 }}>
            {isLoading ? (
              <Skeleton width={180} />
            ) : (
              <>
                <Box component="span" sx={{ color: 'text.primary', fontWeight: 800 }}>
                  {users.length}
                </Box>{' '}
                {users.length === 1 ? 'usuário com acesso' : 'usuários com acesso'}
              </>
            )}
          </Typography>
          }
        >
          <TextField
            select
            size="small"
            value={professionalFilter}
            onChange={(e) => {
              setProfessionalFilter(e.target.value as ProfessionalFilter);
              setPage(0);
            }}
            inputProps={{ 'aria-label': 'Vínculo' }}
            sx={LIST_HEADER_SELECT_SX}
          >
            <MenuItem value="ALL">Todos os vínculos</MenuItem>
            <MenuItem value="YES">Profissional</MenuItem>
            <MenuItem value="NO">Administrativo</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(0);
            }}
            inputProps={{ 'aria-label': 'Grupo de permissão' }}
            sx={LIST_HEADER_SELECT_SX}
          >
            <MenuItem value="ALL">Todos os grupos</MenuItem>
            {roleOptions.map((name) => (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            value={activeFilter}
            onChange={(e) => {
              setActiveFilter(e.target.value as ActiveFilter);
              setPage(0);
            }}
            inputProps={{ 'aria-label': 'Status' }}
            sx={LIST_HEADER_SELECT_SX}
          >
            <MenuItem value="ALL">Todos os status</MenuItem>
            <MenuItem value="ACTIVE">Ativos</MenuItem>
            <MenuItem value="INACTIVE">Inativos</MenuItem>
          </TextField>
          <ListSearchField value={search} onChange={(v) => {
              setSearch(v);
              setPage(0);
            }}
            placeholder="Buscar usuário..." />
          {canCreate && (
            <Button data-tour="users-new"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              sx={LIST_HEADER_ACTION_SX}
            >
              Novo usuário
            </Button>
          )}
        </ListCardHeader>
        <Box sx={{ overflowX: 'auto' }}>
        {/* Cabeçalho de colunas */}
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
          <span>Usuário</span>
          <span>Vínculo</span>
          <span>Grupo de permissão</span>
          <span>Status</span>
          <span />
        </Box>

        {/* Linhas */}
        {isLoading ? (
          <Box sx={{ px: 2.5, py: 2 }}>
            <Stack spacing={1.25}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} variant="rounded" height={48} />
              ))}
            </Stack>
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ px: 2.5, py: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">
              {users.length === 0 ? 'Nenhum usuário cadastrado.' : 'Nenhum usuário encontrado com os filtros.'}
            </Typography>
          </Box>
        ) : (
          rows.map((u) => {
            const isSelf = u.id === me?.id;
            return (
              <Box
                key={u.id}
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
                  '&:hover': { bgcolor: 'grey.50' },
                  '&:last-of-type': { borderBottom: 0 },
                }}
              >
                {/* Usuário */}
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
                      color: 'primary.main',
                      bgcolor: (t) => alpha(t.palette.primary.main, 0.09),
                    }}
                  >
                    {initialsFor(u.name)}
                  </Box>
                  <Box sx={{ minWidth: 0, lineHeight: 1.3 }}>
                    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: fontSizes.md, fontWeight: 700 }} noWrap title={u.name}>
                        {u.name}
                      </Typography>
                      {u.isPrimary && (
                        <Tooltip title="Profissional principal">
                          <StarIcon sx={{ fontSize: 15, color: 'warning.main', flexShrink: 0 }} />
                        </Tooltip>
                      )}
                    </Stack>
                    <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }} noWrap title={u.email}>
                      {u.email}
                    </Typography>
                  </Box>
                </Stack>

                {/* Vínculo */}
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                  {u.providesAppointments ? (
                    <Pill label="Profissional" color="#2F6FA0" bg={alpha(INFO_COLOR, 0.16)} />
                  ) : (
                    <Pill label="Administrativo" color="text.secondary" bg="grey.100" />
                  )}
                </Box>

                {/* Grupo de permissão */}
                <Typography
                  sx={{ display: { xs: 'none', md: 'block' }, fontSize: fontSizes.sm, fontWeight: 600 }}
                  noWrap
                >
                  {u.role?.name ?? '—'}
                </Typography>

                {/* Status */}
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                  {u.active ? (
                    <Pill label="Ativo" color="primary.dark" bg={(t) => alpha(t.palette.primary.main, 0.12)} />
                  ) : (
                    <Pill label="Inativo" color="text.secondary" bg="grey.100" />
                  )}
                </Box>

                {/* Ações */}
                <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                  {canImpersonate && !isSelf && u.active && (
                    <Tooltip title="Personificar">
                      <IconButton aria-label={`Personificar ${u.name}`} onClick={() => handleImpersonate(u)} sx={ROW_ACTION_SX}>
                        <SwitchAccountIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {canEdit && (
                    <Tooltip title="Editar">
                      <IconButton aria-label={`Editar ${u.name}`} onClick={() => handleEdit(u)} sx={ROW_ACTION_SX}>
                        <EditIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {canDelete && (
                    <Tooltip title={isSelf ? 'Você não pode excluir a si mesmo' : 'Excluir'}>
                      <span>
                        <IconButton
                          aria-label={`Excluir ${u.name}`}
                          disabled={isSelf}
                          onClick={() => handleDelete(u)}
                          sx={{ ...ROW_ACTION_SX, color: 'error.main' }}
                        >
                          <DeleteIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </Stack>
              </Box>
            );
          })
        )}
        </Box>

        {/* Paginação */}
        {!isLoading && pageCount > 1 && (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems="center"
            justifyContent="space-between"
            spacing={1.5}
            sx={{ px: 2.5, py: 1.75, borderTop: 1, borderColor: 'divider' }}
          >
            <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', fontWeight: 600 }}>
              Mostrando {current * PAGE_SIZE + 1}–{Math.min((current + 1) * PAGE_SIZE, filtered.length)} de{' '}
              {filtered.length}
            </Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap justifyContent="center">
              {Array.from({ length: pageCount }).map((_, i) => {
                const activePage = i === current;
                return (
                  <Box
                    key={i}
                    component="button"
                    type="button"
                    aria-label={`Página ${i + 1}`}
                    aria-current={i === current ? 'page' : undefined}
                    onClick={() => setPage(i)}
                    sx={{
                      minWidth: 32,
                      height: 32,
                      px: 0.75,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: fontSizes.sm,
                      fontWeight: 700,
                      borderRadius: '9px',
                      border: 1,
                      borderColor: activePage ? 'primary.main' : 'divider',
                      color: activePage ? '#fff' : 'text.secondary',
                      bgcolor: activePage ? 'primary.main' : 'background.paper',
                      '&:hover': { bgcolor: activePage ? 'primary.main' : 'grey.50' },
                    }}
                  >
                    {i + 1}
                  </Box>
                );
              })}
            </Stack>
          </Stack>
        )}
      </Card>

      <UserFormDialog open={formOpen} onClose={() => setFormOpen(false)} user={editing} />
    </Box>
  );
}
