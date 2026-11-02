import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  Switch,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';

import { urlPage, useUrlState } from '../hooks/useUrlState';
import { getPromotionStatusKey, isPromotionActive } from '../utils/listFilters';
import { promotionsApi } from '../api/promotions';
import { PromotionFormDialog } from '../components/promotions/PromotionFormDialog';
import { useAppDialog } from '../contexts/AppDialogContext';
import { useAppToast } from '../contexts/AppToastContext';
import { getApiErrorMessage } from '../utils/apiError';
import { usePermissions } from '../contexts/usePermissions';
import type { Promotion } from '../types';
import { fontSizes } from '../theme/fontSizes';

const PAGE_SIZE = 8;

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE: { label: 'Ativa', color: '#0E7C7B', bg: alpha('#15998B', 0.14) },
  FUTURE: { label: 'Agendada', color: '#2F6FA0', bg: alpha('#5BA8DE', 0.16) },
  EXPIRED: { label: 'Encerrada', color: '#6B6B6B', bg: alpha('#8B8680', 0.16) },
  INACTIVE: { label: 'Inativa', color: '#6B6B6B', bg: alpha('#8B8680', 0.16) },
};

function discountBadge(promo: Promotion): { label: string; color: string } {
  if (promo.discountType === 'PERCENTAGE') {
    return { label: `−${Number(promo.discountValue)}%`, color: '#15998B' };
  }
  const v = Number(promo.discountValue);
  if (promo.discountType === 'COMBO') {
    return { label: v > 0 ? `Combo R$ ${Number.isInteger(v) ? v : v.toFixed(2)}` : 'Combo', color: '#8B8680' };
  }
  return { label: `R$ ${Number.isInteger(v) ? v : v.toFixed(2)}`, color: '#9B7BD4' };
}

function formatRange(startAt: string, endAt: string) {
  const s = dayjs(startAt);
  const e = dayjs(endAt);
  if (!s.isValid() || !e.isValid()) return '—';
  return `${s.format('DD MMM')} – ${e.format('DD MMM')}`;
}

export function Promotions() {
  const queryClient = useQueryClient();
  const { confirm } = useAppDialog();
  const toast = useAppToast();
  const { has } = usePermissions();
  const canCreate = has('promotions:create');
  const canEdit = has('promotions:edit');
  const canDelete = has('promotions:delete');

  const [search, setSearch] = useUrlState('busca', '');
  const [page, setPage] = useUrlState('pagina', 0, urlPage);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [initialCommemorativeDate, setInitialCommemorativeDate] = useState<string | undefined>();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const data = searchParams.get('data');
    if (data && canCreate) {
      setInitialCommemorativeDate(data);
      setEditing(null);
      setFormOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, canCreate, setSearchParams]);

  const { data: promotions = [], isLoading } = useQuery({
    queryKey: ['promotions'],
    queryFn: () => promotionsApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => promotionsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      toast.success('Promoção excluída.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível excluir a promoção.')),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => promotionsApi.update(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promotions'] }),
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível atualizar o status.')),
  });

  const activeCount = useMemo(() => promotions.filter(isPromotionActive).length, [promotions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return promotions;
    return promotions.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        (p.commemorativeDate ?? '').toLowerCase().includes(q),
    );
  }, [promotions, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const rows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const handleEdit = (p: Promotion) => {
    setEditing(p);
    setInitialCommemorativeDate(undefined);
    setFormOpen(true);
  };

  const handleDelete = async (p: Promotion) => {
    const ok = await confirm({
      title: 'Excluir promoção',
      message: `Excluir a promoção "${p.name}"?`,
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
          {isLoading ? (
            <Skeleton width={260} />
          ) : (
            <>
              <Box component="span" sx={{ color: 'text.primary', fontWeight: 800 }}>
                {promotions.length}
              </Box>{' '}
              {promotions.length === 1 ? 'campanha' : 'campanhas'}
              {'  ·  '}
              <Box component="span" sx={{ color: 'text.primary', fontWeight: 800 }}>
                {activeCount}
              </Box>{' '}
              {activeCount === 1 ? 'ativa no momento' : 'ativas no momento'}
            </>
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
              placeholder="Buscar campanha..."
              inputProps={{ 'aria-label': 'Buscar campanha' }}
              sx={{ fontSize: fontSizes.sm, flex: 1 }}
            />
          </Stack>
          {canCreate && (
            <Button data-tour="promotions-new"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditing(null);
                setInitialCommemorativeDate(undefined);
                setFormOpen(true);
              }}
              sx={{ flexShrink: 0, whiteSpace: 'nowrap', height: 38, px: 2.25, borderRadius: '12px', boxShadow: (t) => `0 6px 16px -6px ${t.palette.primary.main}` }}
            >
              Nova promoção
            </Button>
          )}
        </Stack>
      </Stack>

      {/* Cards */}
      {isLoading ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)', xl: 'repeat(4, 1fr)' },
            gap: 2,
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={170} sx={{ borderRadius: '18px' }} />
          ))}
        </Box>
      ) : filtered.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center', borderRadius: '18px' }}>
          <LocalOfferOutlinedIcon sx={{ fontSize: 46, color: 'text.disabled', mb: 1 }} />
          <Typography sx={{ fontWeight: 700 }}>
            {promotions.length === 0 ? 'Nenhuma promoção cadastrada' : 'Nenhuma promoção encontrada'}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: fontSizes.md, mt: 0.5 }}>
            {promotions.length === 0
              ? 'Crie campanhas e descontos sazonais para atrair pacientes.'
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
            const badge = discountBadge(p);
            const status = STATUS_META[getPromotionStatusKey(p)];
            const uses = p._count?.appointments ?? 0;
            return (
              <Card
                key={p.id}
                sx={{
                  p: 2.25,
                  borderRadius: '18px',
                  border: 1,
                  borderColor: 'divider',
                  boxShadow: '0 1px 2px rgba(16,40,37,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'box-shadow .15s, border-color .15s',
                  '&:hover': { boxShadow: '0 12px 30px -20px rgba(16,40,37,0.45)', borderColor: alpha(badge.color, 0.5) },
                }}
              >
                {/* Top: badge de desconto + status + switch */}
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                  <Chip
                    label={badge.label}
                    sx={{
                      height: 30,
                      fontSize: fontSizes.md,
                      fontWeight: 800,
                      borderRadius: '10px',
                      bgcolor: alpha(badge.color, 0.14),
                      color: badge.color === '#8B8680' ? 'text.secondary' : badge.color,
                    }}
                  />
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    {status && (
                      <Chip
                        label={status.label}
                        size="small"
                        sx={{ height: 22, fontSize: fontSizes['2xs'], fontWeight: 700, bgcolor: status.bg, color: status.color }}
                      />
                    )}
                    {canEdit && (
                      <Tooltip title={p.active ? 'Desativar' : 'Ativar'}>
                        <Switch
                          size="small"
                          checked={p.active}
                          inputProps={{ 'aria-label': `${p.active ? 'Desativar' : 'Ativar'} ${p.name}` }}
                          onChange={() => toggleActiveMutation.mutate({ id: p.id, active: !p.active })}
                        />
                      </Tooltip>
                    )}
                  </Stack>
                </Stack>

                {/* Nome + descrição */}
                <Box sx={{ mt: 1.75, minWidth: 0 }}>
                  <Typography sx={{ fontSize: fontSizes.xl, fontWeight: 800, lineHeight: 1.25 }} noWrap title={p.name}>
                    {p.name}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: fontSizes.sm,
                      color: 'text.secondary',
                      mt: 0.25,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      minHeight: 34,
                    }}
                  >
                    {p.description || p.commemorativeDate || '—'}
                  </Typography>
                </Box>

                <Divider sx={{ my: 1.75 }} />

                {/* Vigência/usos + ações */}
                <Stack direction="row" alignItems="flex-end" justifyContent="space-between" spacing={1} sx={{ mt: 'auto' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
                      <CalendarTodayOutlinedIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                      <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary' }} noWrap>
                        {formatRange(p.startAt, p.endAt)}
                      </Typography>
                    </Stack>
                    <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 800, mt: 0.25 }}>
                      {uses} {uses === 1 ? 'uso' : 'usos'}
                    </Typography>
                  </Box>
                  {(canEdit || canDelete) && (
                    <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0 }}>
                      {canEdit && (
                        <Tooltip title="Editar">
                          <IconButton
                            aria-label={`Editar ${p.name}`}
                            onClick={() => handleEdit(p)}
                            sx={{ width: 34, height: 34, borderRadius: '10px', border: 1, borderColor: 'divider', color: 'text.secondary' }}
                          >
                            <EditIcon sx={{ fontSize: 17 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canDelete && (
                        <Tooltip title="Excluir">
                          <IconButton
                            aria-label={`Excluir ${p.name}`}
                            onClick={() => handleDelete(p)}
                            sx={{
                              width: 34,
                              height: 34,
                              borderRadius: '10px',
                              border: 1,
                              borderColor: (t) => alpha(t.palette.error.main, 0.35),
                              bgcolor: (t) => alpha(t.palette.error.main, 0.06),
                              color: 'error.main',
                              '&:hover': { bgcolor: (t) => alpha(t.palette.error.main, 0.12) },
                            }}
                          >
                            <DeleteIcon sx={{ fontSize: 17 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  )}
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
            Mostrando {current * PAGE_SIZE + 1}–{Math.min((current + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
          </Typography>
          {pageCount > 1 && (
            <Stack direction="row" spacing={1}>
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

      <PromotionFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          setInitialCommemorativeDate(undefined);
        }}
        editing={editing}
        initialCommemorativeDate={initialCommemorativeDate}
      />
    </Box>
  );
}
