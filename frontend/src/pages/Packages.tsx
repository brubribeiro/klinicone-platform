import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Chip,
  Divider,
  IconButton,
  InputBase,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { urlPage, useUrlState } from '../hooks/useUrlState';
import { packagesApi } from '../api/packages';
import { PackageFormDialog } from '../components/packages/PackageFormDialog';
import { useAppDialog } from '../contexts/AppDialogContext';
import { useAppToast } from '../contexts/AppToastContext';
import { getApiErrorMessage } from '../utils/apiError';
import { usePermissions } from '../contexts/usePermissions';
import type { Package } from '../types';
import { fontSizes } from '../theme/fontSizes';
import { brl } from '../utils/money';

const ICON_COLORS = ['#15998B', '#E0915B', '#5BA8DE', '#D46B8A', '#9B7BD4', '#4FB3A8'];
const PAGE_SIZE = 8;

function colorFor(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = text.charCodeAt(i) + ((hash << 5) - hash);
  return ICON_COLORS[Math.abs(hash) % ICON_COLORS.length];
}

export function Packages() {
  const queryClient = useQueryClient();
  const { confirm } = useAppDialog();
  const toast = useAppToast();
  const { has } = usePermissions();
  const canManage = has('packages:edit');
  const canCreate = has('packages:create');

  const [search, setSearch] = useUrlState('busca', '');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Package | null>(null);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['packages'],
    queryFn: () => packagesApi.list(),
  });

  const { data: stats } = useQuery({
    queryKey: ['packages', 'stats'],
    queryFn: () => packagesApi.getStats(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => packagesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      toast.success('Pacote excluído.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível excluir o pacote.')),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return packages;
    return packages.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        p.items?.some((it) => it.procedure?.name.toLowerCase().includes(q)),
    );
  }, [packages, search]);

  const [page, setPage] = useUrlState('pagina', 0, urlPage);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const rows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const handleEdit = (p: Package) => {
    setEditing(p);
    setFormOpen(true);
  };

  const handleDelete = async (p: Package) => {
    const ok = await confirm({
      title: 'Excluir pacote',
      message: `Excluir o pacote "${p.name}"?`,
      confirmLabel: 'Excluir',
      confirmColor: 'error',
    });
    if (ok) deleteMutation.mutate(p.id);
  };

  return (
    <Box>
      {/* Stats + busca + ações */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent="space-between"
        spacing={1.5}
        sx={{ mb: 2.5 }}
      >
        <Typography sx={{ fontSize: fontSizes.md, color: 'text.secondary', fontWeight: 600 }}>
          {stats ? (
            <>
              <Box component="span" sx={{ color: 'text.primary', fontWeight: 800 }}>
                {stats.activePackages}
              </Box>{' '}
              {stats.activePackages === 1 ? 'pacote ativo' : 'pacotes ativos'}
              {'  ·  '}
              <Box component="span" sx={{ color: 'text.primary', fontWeight: 800 }}>
                {stats.patientsWithPackage}
              </Box>{' '}
              {stats.patientsWithPackage === 1 ? 'paciente com pacote' : 'pacientes com pacote'}
            </>
          ) : (
            <Skeleton width={260} />
          )}
        </Typography>

        <Stack
          direction="row"
          alignItems="center"
          spacing={1.25}
          flexWrap={{ xs: 'wrap', md: 'nowrap' }}
          useFlexGap
          justifyContent={{ md: 'flex-end' }}
          sx={{ minWidth: 0 }}
        >
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{
              height: 38,
              px: 1.75,
              borderRadius: '12px',
              border: 1,
              borderColor: 'divider',
              bgcolor: 'grey.50',
              width: { xs: '100%', sm: 240 },
              minWidth: 0,
            }}
          >
            <SearchIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
            <InputBase
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Buscar pacote..."
              inputProps={{ 'aria-label': 'Buscar pacote' }}
              sx={{ fontSize: fontSizes.sm, flex: 1 }}
            />
          </Stack>
          {canCreate && (
            <Button data-tour="packages-new"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              sx={{ flexShrink: 0, whiteSpace: 'nowrap', height: 38, px: 2.25, borderRadius: '12px', boxShadow: (t) => `0 6px 16px -6px ${t.palette.primary.main}` }}
            >
              Criar pacote
            </Button>
          )}
        </Stack>
      </Stack>

      {/* Lista de cards */}
      {isLoading ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)', xl: 'repeat(4, 1fr)' },
            gap: 2,
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={230} sx={{ borderRadius: '18px' }} />
          ))}
        </Box>
      ) : filtered.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center', borderRadius: '18px' }}>
          <Inventory2OutlinedIcon sx={{ fontSize: 46, color: 'text.disabled', mb: 1 }} />
          <Typography sx={{ fontWeight: 700 }}>
            {packages.length === 0 ? 'Nenhum pacote cadastrado' : 'Nenhum pacote encontrado'}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: fontSizes.md, mt: 0.5 }}>
            {packages.length === 0
              ? 'Monte combos e pacotes de sessões para oferecer aos pacientes.'
              : 'Tente ajustar a busca.'}
          </Typography>
        </Card>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)', xl: 'repeat(4, 1fr)' },
            gap: 2,
          }}
        >
          {rows.map((p) => {
            const color = colorFor(p.name);
            const original = p.originalPrice ?? 0;
            const sale = p.salePrice ?? Number(p.totalPrice ?? 0);
            const savings = p.savingsPercent ?? 0;
            const activeCount = p.activePatientsCount ?? 0;
            return (
              <Card
                key={p.id}
                sx={{
                  p: 2.25,
                  borderRadius: '18px',
                  border: 1,
                  borderColor: 'divider',
                  boxShadow: '0 1px 2px rgba(16,40,37,0.03)',
                  opacity: p.active ? 1 : 0.6,
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'box-shadow .15s, border-color .15s',
                  '&:hover': { boxShadow: '0 12px 30px -20px rgba(16,40,37,0.45)', borderColor: alpha(color, 0.5) },
                }}
              >
                {/* Header */}
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
                      bgcolor: alpha(color, 0.12),
                      color,
                    }}
                  >
                    <Inventory2OutlinedIcon fontSize="small" />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      title={p.name}
                      sx={{
                        fontSize: fontSizes.xl,
                        fontWeight: 800,
                        lineHeight: 1.2,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {p.name}
                    </Typography>
                    {(p.highlight || !p.active) && (
                      <Stack direction="row" spacing={0.75} sx={{ mt: 0.6 }} flexWrap="wrap" useFlexGap>
                        {p.highlight === 'BEST_SELLER' && (
                          <Chip
                            size="small"
                            label="Mais vendido"
                            sx={{
                              height: 21,
                              fontSize: fontSizes['2xs'],
                              fontWeight: 700,
                              bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
                              color: 'primary.dark',
                            }}
                          />
                        )}
                        {p.highlight === 'RECURRING' && (
                          <Chip
                            size="small"
                            label="Recorrente"
                            sx={{
                              height: 21,
                              fontSize: fontSizes['2xs'],
                              fontWeight: 700,
                              bgcolor: alpha('#5BA8DE', 0.16),
                              color: '#2F6FA0',
                            }}
                          />
                        )}
                        {!p.active && (
                          <Chip size="small" label="Inativo" sx={{ height: 21, fontSize: fontSizes['2xs'], fontWeight: 700 }} />
                        )}
                      </Stack>
                    )}
                  </Box>
                  {canManage && (
                    <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                      <Tooltip title="Editar">
                        <IconButton
                          aria-label={`Editar ${p.name}`}
                          onClick={() => handleEdit(p)}
                          sx={{ width: 30, height: 30, borderRadius: '9px', border: 1, borderColor: 'divider', color: 'text.secondary' }}
                        >
                          <EditIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Excluir">
                        <IconButton
                          aria-label={`Excluir ${p.name}`}
                          onClick={() => handleDelete(p)}
                          sx={{
                            width: 30,
                            height: 30,
                            borderRadius: '9px',
                            border: 1,
                            borderColor: 'divider',
                            color: 'error.main',
                          }}
                        >
                          <DeleteIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  )}
                </Stack>

                {/* Tags de procedimentos */}
                {(p.items?.length ?? 0) > 0 && (
                  <Stack direction="row" spacing={0.75} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                    {p.items.map((it) => (
                      <Chip
                        key={it.id}
                        size="small"
                        label={it.quantity > 1 ? `${it.procedure?.name} ×${it.quantity}` : it.procedure?.name}
                        sx={{
                          height: 24,
                          fontSize: fontSizes.xs,
                          fontWeight: 600,
                          bgcolor: 'grey.100',
                          color: 'text.secondary',
                        }}
                      />
                    ))}
                  </Stack>
                )}

                <Divider sx={{ my: 1.75 }} />

                {/* Preço + métricas */}
                <Stack
                  direction="row"
                  alignItems="flex-end"
                  justifyContent="space-between"
                  spacing={1}
                  sx={{ mt: 'auto' }}
                  flexWrap="wrap"
                  useFlexGap
                >
                  <Box sx={{ minWidth: 0 }}>
                    {original > sale && (
                      <Typography
                        sx={{ fontSize: fontSizes.xs, color: 'text.disabled', textDecoration: 'line-through', lineHeight: 1 }}
                      >
                        {brl.format(original)}
                      </Typography>
                    )}
                    <Typography sx={{ fontSize: fontSizes['5xl'], fontWeight: 800, lineHeight: 1.15, mt: 0.25 }}>
                      {brl.format(sale)}
                    </Typography>
                    <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }}>
                      {p.sessionCount} {p.sessionCount === 1 ? 'sessão' : 'sessões'}
                    </Typography>
                  </Box>
                  <Stack alignItems="flex-end" spacing={0.6}>
                    {savings > 0 && (
                      <Chip
                        size="small"
                        label={`economia ${savings}%`}
                        sx={{
                          height: 23,
                          fontSize: fontSizes['2xs'],
                          fontWeight: 700,
                          bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
                          color: 'primary.dark',
                        }}
                      />
                    )}
                    <Typography sx={{ fontSize: fontSizes.xs, color: 'text.disabled', textAlign: 'right' }}>
                      {activeCount} {activeCount === 1 ? 'paciente ativo' : 'pacientes ativos'}
                    </Typography>
                  </Stack>
                </Stack>
              </Card>
            );
          })}
        </Box>
      )}

      {/* Paginação */}
      {!isLoading && filtered.length > 0 && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems="center"
          justifyContent="space-between"
          spacing={1.5}
          sx={{ mt: 3 }}
        >
          <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary' }}>
            Mostrando {current * PAGE_SIZE + 1}–{Math.min((current + 1) * PAGE_SIZE, filtered.length)} de{' '}
            {filtered.length}
          </Typography>
          {pageCount > 1 && (
            <Stack
              direction="row"
              spacing={1}
              flexWrap="wrap"
              useFlexGap
              justifyContent={{ xs: 'center', sm: 'flex-end' }}
            >
              {Array.from({ length: pageCount }).map((_, i) => {
                const activePage = i === current;
                return (
                  <Box
                    key={i}
                    component="button"
                    type="button"
                    aria-label={`Página ${i + 1}`}
                    aria-current={activePage ? 'page' : undefined}
                    onClick={() => setPage(i)}
                    sx={{
                      minWidth: 38,
                      height: 38,
                      px: 1,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: fontSizes.md,
                      fontWeight: 700,
                      borderRadius: '10px',
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
          )}
        </Stack>
      )}

      <PackageFormDialog open={formOpen} onClose={() => setFormOpen(false)} pkg={editing} />
    </Box>
  );
}
