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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { urlPage, useUrlState } from '../hooks/useUrlState';
import { usePlatformCatalog } from '../hooks/usePlatformCatalog';
import { proceduresApi } from '../api/procedures';
import { ProcedureFormDialog } from '../components/procedures/ProcedureFormDialog';
import {
  LIST_HEADER_ACTION_SX,
  LIST_HEADER_SELECT_SX,
  ListCardHeader,
  ListSearchField,
} from '../components/ListCardHeader';
import { useAppDialog } from '../contexts/AppDialogContext';
import { useAppToast } from '../contexts/AppToastContext';
import { getApiErrorMessage } from '../utils/apiError';
import { usePermissions } from '../contexts/usePermissions';
import type { Procedure } from '../types';
import { fontSizes } from '../theme/fontSizes';
import { PAGE_MAX_WIDTH } from '../theme/layout';
import { brl } from '../utils/money';

const PAGE_SIZE = 8;
const AVATAR_COLORS = ['#15998B', '#5BA8DE', '#D46B8A', '#E0915B', '#9B7BD4', '#4FB3A8'];
const GRID_COLS = '2fr 1fr 0.7fr 0.7fr 0.9fr 0.9fr 0.9fr 0.95fr 0.95fr 0.75fr 52px';
const GRID_MIN_WIDTH = PAGE_MAX_WIDTH;
function colorFor(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = text.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Procedures() {
  const queryClient = useQueryClient();
  const { confirm } = useAppDialog();
  const toast = useAppToast();
  const { has } = usePermissions();
  const canCreate = has('procedures:create');
  const canEdit = has('procedures:edit');
  const canDelete = has('procedures:delete');
  const procedureCategorySuggestions = usePlatformCatalog('procedure_category');

  const [search, setSearch] = useUrlState('busca', '');
  const [category, setCategory] = useUrlState('categoria', 'Todos');
  const [page, setPage] = useUrlState('pagina', 0, urlPage);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Procedure | null>(null);

  const { data: procedures = [], isLoading } = useQuery({
    queryKey: ['procedures'],
    queryFn: () => proceduresApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => proceduresApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procedures'] });
      toast.success('Procedimento excluído.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível excluir o procedimento.')),
  });

  const categories = useMemo(() => {
    const set = new Set<string>(procedureCategorySuggestions.map((c) => c.value));
    procedures.forEach((p) => p.category?.trim() && set.add(p.category.trim()));
    return ['Todos', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [procedures, procedureCategorySuggestions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return procedures.filter((p) => {
      if (category !== 'Todos' && (p.category ?? '') !== category) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q)
      );
    });
  }, [procedures, search, category]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const rows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const handleDelete = async (p: Procedure) => {
    const ok = await confirm({
      title: 'Excluir procedimento',
      message: `Excluir procedimento ${p.name}?`,
      confirmLabel: 'Excluir',
      confirmColor: 'error',
    });
    if (ok) deleteMutation.mutate(p.id);
  };

  return (
    <Box>
      <Card data-tour="procedures-list" sx={{ p: 0, overflow: 'hidden' }}>
        <ListCardHeader
          title={
            <Typography sx={{ fontSize: fontSizes.xl, fontWeight: 700 }}>
              {category === 'Todos' ? 'Todos os procedimentos' : category}
            </Typography>
          }
        >
          <TextField
            select
            size="small"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(0);
            }}
            inputProps={{ 'aria-label': 'Categoria' }}
            sx={{ ...LIST_HEADER_SELECT_SX, width: { xs: 'calc(50% - 5px)', sm: 196 } }}
          >
            <MenuItem value="Todos">Todas as categorias</MenuItem>
            {categories.slice(1).map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </TextField>
          <ListSearchField value={search} onChange={(v) => {
              setSearch(v);
              setPage(0);
            }}
            placeholder="Buscar procedimento..." ariaLabel="Buscar procedimento" />
          {canCreate && (
            <Button data-tour="procedures-new"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              sx={LIST_HEADER_ACTION_SX}
            >
              Novo procedimento
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
            px: 2.75,
            py: 1.5,
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'grey.50',
            fontSize: fontSizes['2xs'],
            fontWeight: 800,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'text.secondary',
          }}
        >
          <span>Procedimento</span>
          <span>Categoria</span>
          <span>Duração</span>
          <span>Realizados</span>
          <span>Custo mat.</span>
          <span>Taxa pgto.</span>
          <span>Desp. fixa</span>
          <span>Custo total</span>
          <span>Valor</span>
          <span>Margem</span>
          <span />
        </Box>

        {/* Linhas */}
        {isLoading ? (
          <Box sx={{ px: 2.75, py: 2 }}>
            <Stack spacing={1.25}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} variant="rounded" height={52} />
              ))}
            </Stack>
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ px: 2.75, py: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">
              {procedures.length === 0
                ? 'Nenhum procedimento cadastrado.'
                : 'Nenhum procedimento encontrado.'}
            </Typography>
          </Box>
        ) : (
          rows.map((p) => {
            const color = colorFor(p.name);
            const catColor = p.category ? colorFor(p.category) : '#8B8680';
            const margin = p.profitMargin;
            const marginTone = margin == null ? '#8B8680' : margin < 50 ? '#C25A4C' : '#15998B';
            return (
              <Box
                key={p.id}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr auto', md: GRID_COLS },
                  minWidth: { md: GRID_MIN_WIDTH },
                  gap: 1.5,
                  px: { xs: 2, md: 2.75 },
                  py: 1.5,
                  borderBottom: 1,
                  borderColor: 'divider',
                  alignItems: 'center',
                  opacity: p.active ? 1 : 0.55,
                  '&:hover': { bgcolor: 'grey.50' },
                  '&:last-of-type': { borderBottom: 0 },
                }}
              >
                {/* Procedimento */}
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '11px',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: fontSizes.sm,
                      fontWeight: 800,
                      color: '#fff',
                      bgcolor: color,
                    }}
                  >
                    {initialsFor(p.name)}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: fontSizes.md, fontWeight: 700 }} noWrap title={p.name}>
                      {p.name}
                    </Typography>
                    <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }} noWrap>
                      {p.recurrenceDays ? `Retorno: ${p.recurrenceDays} dias` : 'Sem retorno'}
                      {!p.active ? ' · Inativo' : ''}
                    </Typography>
                  </Box>
                </Stack>

                {/* Categoria */}
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                  {p.category ? (
                    <Box
                      component="span"
                      sx={{
                        display: 'inline-block',
                        fontSize: fontSizes.xs,
                        fontWeight: 700,
                        px: 1,
                        py: 0.4,
                        borderRadius: '8px',
                        color: catColor,
                        bgcolor: alpha(catColor, 0.14),
                      }}
                    >
                      {p.category}
                    </Box>
                  ) : (
                    <Typography sx={{ fontSize: fontSizes.sm, color: 'text.disabled' }}>—</Typography>
                  )}
                </Box>

                {/* Duração */}
                <Typography sx={{ display: { xs: 'none', md: 'block' }, fontSize: fontSizes.sm, color: 'text.secondary', fontWeight: 600 }}>
                  {p.durationMinutes} min
                </Typography>

                {/* Realizados */}
                <Typography sx={{ display: { xs: 'none', md: 'block' }, fontSize: fontSizes.sm, color: 'text.secondary', fontWeight: 600 }}>
                  {p.appointmentsCount ?? 0}×
                </Typography>

                {/* Custo mat. */}
                <Typography sx={{ display: { xs: 'none', md: 'block' }, fontSize: fontSizes.sm, color: 'text.secondary', fontWeight: 700 }}>
                  {p.baseCost ? brl.format(p.baseCost) : '—'}
                </Typography>

                {/* Taxa pgto. */}
                <Tooltip title={p.maxFeePercent ? `Maior taxa ativa: ${p.maxFeePercent.toFixed(1)}%` : ''}>
                  <Typography sx={{ display: { xs: 'none', md: 'block' }, fontSize: fontSizes.sm, color: 'text.secondary', fontWeight: 600 }}>
                    {p.maxFeeCost ? brl.format(p.maxFeeCost) : '—'}
                  </Typography>
                </Tooltip>

                {/* Desp. fixa */}
                <Tooltip
                  title={
                    p.hourlyCost
                      ? `Custo/hora: ${brl.format(p.hourlyCost)} × ${p.durationMinutes} min`
                      : 'Despesa fixa proporcional ao tempo'
                  }
                >
                  <Typography sx={{ display: { xs: 'none', md: 'block' }, fontSize: fontSizes.sm, color: 'text.secondary', fontWeight: 600 }}>
                    {p.fixedCostShare ? brl.format(p.fixedCostShare) : '—'}
                  </Typography>
                </Tooltip>

                {/* Custo total */}
                <Typography sx={{ display: { xs: 'none', md: 'block' }, fontSize: fontSizes.sm, fontWeight: 800, color: 'error.main' }}>
                  {p.totalCost != null ? brl.format(p.totalCost) : '—'}
                </Typography>

                {/* Valor */}
                <Typography sx={{ display: { xs: 'none', md: 'block' }, fontSize: fontSizes.md, fontWeight: 800 }}>
                  {brl.format(Number(p.price))}
                </Typography>

                {/* Margem */}
                <Box sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'flex-start' }}>
                  <Box
                    component="span"
                    sx={{
                      fontSize: fontSizes.xs,
                      fontWeight: 800,
                      px: 1,
                      py: 0.4,
                      borderRadius: '8px',
                      color: marginTone,
                      bgcolor: alpha(marginTone, 0.14),
                    }}
                  >
                    {margin == null ? '—' : `${margin.toFixed(0)}%`}
                  </Box>
                </Box>

                {/* Ações */}
                <Stack direction="row" spacing={0.25} justifyContent="flex-end">
                  {canEdit && (
                    <Tooltip title="Editar">
                      <IconButton
                        size="small"
                        aria-label={`Editar ${p.name}`}
                        onClick={() => {
                          setEditing(p);
                          setFormOpen(true);
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {canDelete && (
                    <Tooltip title="Excluir">
                      <IconButton
                        size="small"
                        aria-label={`Excluir ${p.name}`}
                        onClick={() => handleDelete(p)}
                        sx={{ color: 'error.main' }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </Box>
            );
          })
        )}
        </Box>

        {/* Paginação */}
        {!isLoading && filtered.length > 0 && (
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ px: 2.75, py: 1.75, borderTop: 1, borderColor: 'divider' }}
          >
            <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', fontWeight: 600 }}>
              {current * PAGE_SIZE + 1}–{Math.min((current + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
            </Typography>
            <Stack direction="row" spacing={0.75}>
              <IconButton
                size="small"
                aria-label="Página anterior"
                disabled={current === 0}
                onClick={() => setPage((v) => Math.max(0, v - 1))}
                sx={{ border: 1, borderColor: 'divider', borderRadius: '9px' }}
              >
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                aria-label="Próxima página"
                disabled={current >= pageCount - 1}
                onClick={() => setPage((v) => Math.min(pageCount - 1, v + 1))}
                sx={{ border: 1, borderColor: 'divider', borderRadius: '9px' }}
              >
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>
        )}
      </Card>

      <ProcedureFormDialog open={formOpen} onClose={() => setFormOpen(false)} procedure={editing} />
    </Box>
  );
}
