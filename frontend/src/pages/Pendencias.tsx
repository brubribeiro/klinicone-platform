import { useMemo, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';

import { pendenciasApi } from '../api/pendencias';
import { usersApi } from '../api/users';
import { PendingRulesDialog } from '../components/pendencias/PendingRulesDialog';
import { PendingTaskDialog } from '../components/pendencias/PendingTaskDialog';
import {
  CATEGORY_META,
  CATEGORY_OPTIONS,
  GROUP_META,
  GROUP_ORDER,
  PendIcon,
  RESOLVED_META,
  categoryColor,
  donutPaths,
  isManual,
  itemIcon,
  pendTone,
  type PendIconName,
} from '../components/pendencias/pendenciasUtils';
import { useAppToast } from '../contexts/AppToastContext';
import { usePermissions } from '../contexts/usePermissions';
import type { PendingCategory, PendingGroup, PendingItem, PendingList } from '../types';
import { fontSizes } from '../theme/fontSizes';
import { clickableProps } from '../utils/a11y';
import { getApiErrorMessage } from '../utils/apiError';
import { downloadCsv } from '../utils/csv';

type View = PendingGroup | 'ALL' | 'RESOLVED';

const PANEL_SX = {
  borderRadius: '18px',
  border: 1,
  borderColor: 'divider',
  boxShadow: '0 1px 2px rgba(16,40,37,0.04), 0 8px 24px -18px rgba(16,40,37,0.25)',
} as const;

const TOOLBAR_SELECT_SX = {
  flex: '0 1 auto',
  minWidth: 150,
  maxWidth: 220,
  ml: { sm: 'auto' },
  '& .MuiOutlinedInput-root': {
    height: 40,
    borderRadius: '11px',
    fontSize: fontSizes.sm,
    fontWeight: 600,
    bgcolor: 'background.paper',
  },
} as const;

const TOOLBAR_BUTTON_SX = {
  height: 40,
  px: 1.9,
  borderRadius: '11px',
  border: 1,
  borderColor: 'divider',
  bgcolor: 'background.paper',
  color: 'text.primary',
  fontSize: fontSizes.sm,
  fontWeight: 700,
  whiteSpace: 'nowrap',
  flexShrink: 0,
  '&:hover': { bgcolor: 'grey.50', borderColor: 'divider' },
} as const;

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export function Pendencias() {
  const theme = useTheme();
  const groupTone = (g: PendingGroup) => pendTone(theme, GROUP_META[g].tone);
  const resolvedTone = pendTone(theme, RESOLVED_META.tone);
  const primaryTone = pendTone(theme, 'primary');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const { has } = usePermissions();
  const canCreate = has('pendencias:create');
  const canEdit = has('pendencias:edit');
  const canDelete = has('pendencias:delete');

  const [view, setView] = useState<View>('URGENT');
  const [category, setCategory] = useState<PendingCategory | ''>('');
  const [taskDialog, setTaskDialog] = useState<{ open: boolean; editing: PendingItem | null }>({ open: false, editing: null });
  const [rulesOpen, setRulesOpen] = useState(false);
  const [assignMenu, setAssignMenu] = useState<{ anchor: HTMLElement; item: PendingItem } | null>(null);

  const listKey = ['pendencias', 'list'];
  const { data, isLoading } = useQuery({
    queryKey: listKey,
    queryFn: pendenciasApi.list,
    placeholderData: keepPreviousData,
  });
  const items = useMemo(() => data?.items ?? [], [data]);

  const { data: resolved = [], isPending: resolvedLoading } = useQuery({
    queryKey: ['pendencias', 'resolved'],
    queryFn: pendenciasApi.listResolved,
    enabled: view === 'RESOLVED',
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users', 'active'],
    queryFn: () => usersApi.listActive(),
    enabled: !!assignMenu,
    staleTime: 5 * 60_000,
  });

  const patchList = (fn: (prev: PendingList) => PendingList) =>
    queryClient.setQueryData<PendingList>(listKey, (prev) => (prev ? fn(prev) : prev));

  const resolveMutation = useMutation({
    mutationFn: (item: PendingItem) => pendenciasApi.resolve(item.key),
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<PendingList>(listKey);
      patchList((prev) => ({
        ...prev,
        items: prev.items.filter((i) => i.key !== item.key),
        resolvedCount: prev.resolvedCount + 1,
      }));
      return { previous };
    },
    onSuccess: () => toast.success('Pendência resolvida.'),
    onError: (err, _item, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(listKey, ctx.previous);
      toast.error(getApiErrorMessage(err, 'Não foi possível resolver a pendência.'));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['pendencias'] }),
  });

  const assignMutation = useMutation({
    mutationFn: ({ item, user }: { item: PendingItem; user: { id: string; name: string } | null }) =>
      pendenciasApi.assign(item.key, user?.id ?? null),
    onMutate: async ({ item, user }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<PendingList>(listKey);
      patchList((prev) => ({
        ...prev,
        items: prev.items.map((i) => (i.key === item.key ? { ...i, assignee: user } : i)),
      }));
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(listKey, ctx.previous);
      toast.error(getApiErrorMessage(err, 'Não foi possível alterar o responsável.'));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: listKey }),
  });

  const reopenMutation = useMutation({
    mutationFn: (id: string) => pendenciasApi.reopen(id),
    onSuccess: () => {
      toast.success('Pendência reaberta.');
      queryClient.invalidateQueries({ queryKey: ['pendencias'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível reabrir a pendência.')),
  });

  const filtered = category ? items.filter((i) => i.category === category) : items;
  const countBy = (list: PendingItem[], g: PendingGroup) => list.filter((i) => i.group === g).length;

  const focus = [...items.filter((i) => i.group === 'OVERDUE'), ...items.filter((i) => i.group === 'URGENT')].slice(0, 3);

  const byCategory = useMemo(() => {
    const counts = new Map<PendingCategory, number>();
    for (const i of items) counts.set(i.category, (counts.get(i.category) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, n]) => ({ key, n, label: CATEGORY_META[key].label, color: categoryColor(theme, key) }));
  }, [items, theme]);
  const donut = donutPaths(byCategory);

  const stats: {
    view: View;
    label: string;
    n: number;
    color: string;
    text: string;
    bg: string;
    border: string;
    icon: PendIconName;
  }[] = [
    ...GROUP_ORDER.map((g) => ({
      view: g as View,
      label: GROUP_META[g].label,
      n: countBy(items, g),
      color: groupTone(g).main,
      text: groupTone(g).text,
      bg: groupTone(g).statBg,
      border: groupTone(g).border,
      icon: GROUP_META[g].icon,
    })),
    {
      view: 'RESOLVED',
      label: RESOLVED_META.label,
      n: data?.resolvedCount ?? 0,
      color: resolvedTone.main,
      text: resolvedTone.text,
      bg: resolvedTone.statBg,
      border: resolvedTone.border,
      icon: 'check',
    },
  ];

  const openDetails = (item: PendingItem) => {
    if (item.link) navigate(item.link);
    else if (isManual(item) && canEdit) setTaskDialog({ open: true, editing: item });
  };

  const exportReport = () => {
    const ok = downloadCsv(
      `pendencias-${dayjs().format('YYYY-MM-DD')}.csv`,
      items.map((i) => ({
        Situação: GROUP_META[i.group].chipLabel,
        Pendência: i.title,
        Categoria: CATEGORY_META[i.category].label,
        Detalhe: i.subtitle,
        Prazo: i.dueDate ? dayjs(i.dueDate).format('DD/MM/YYYY') : '',
        Responsável: i.assignee?.name ?? '',
        Origem: i.rule ? 'Regra' : 'Manual',
      })),
      ['Situação', 'Pendência', 'Categoria', 'Detalhe', 'Prazo', 'Responsável', 'Origem'],
    );
    if (!ok) toast.info('Nenhuma pendência para exportar.');
  };

  const quickActions = [
    ...(canCreate
      ? [{ label: 'Nova pendência', icon: 'plus' as const, onClick: () => setTaskDialog({ open: true, editing: null }) }]
      : []),
    { label: 'Ver todas as pendências', icon: 'list' as const, onClick: () => setView('ALL') },
    { label: 'Relatório de pendências', icon: 'chart' as const, onClick: exportReport },
  ];

  const groupsToShow: PendingGroup[] = view === 'ALL' ? GROUP_ORDER : view === 'RESOLVED' ? [] : [view];

  const renderRow = (item: PendingItem) => {
    const meta = GROUP_META[item.group];
    const tone = groupTone(item.group);
    const canOpen = !!item.link || (isManual(item) && canEdit);
    return (
      <Box
        key={item.key}
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          columnGap: 1.75,
          rowGap: 1.5,
          px: 2.5,
          py: 1.75,
          borderBottom: 1,
          borderColor: 'divider',
          '&:last-of-type': { borderBottom: 0 },
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '11px',
            bgcolor: 'grey.50',
            color: 'text.secondary',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <PendIcon name={itemIcon(item)} />
        </Box>
        <Box sx={{ flex: '1 1 200px', minWidth: 0, lineHeight: 1.35 }}>
          <Typography sx={{ fontSize: fontSizes.md, fontWeight: 700, lineHeight: 1.35 }}>{item.title}</Typography>
          <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', fontWeight: 600, mt: '1px' }}>
            {CATEGORY_META[item.category].label}
            {item.subtitle ? ` · ${item.subtitle}` : ''}
          </Typography>
          <Typography sx={{ fontSize: fontSizes['2xs'], color: 'text.secondary', fontWeight: 600, mt: '1px' }}>
            {item.deadlineLabel}
          </Typography>
        </Box>
        <Box
          component={canEdit ? 'button' : 'div'}
          type={canEdit ? 'button' : undefined}
          onClick={canEdit ? (e: MouseEvent<HTMLElement>) => setAssignMenu({ anchor: e.currentTarget, item }) : undefined}
          title={canEdit ? 'Alterar responsável' : undefined}
          sx={{
            flex: '0 0 auto',
            lineHeight: 1.3,
            textAlign: 'left',
            border: 0,
            bgcolor: 'transparent',
            font: 'inherit',
            p: 0.5,
            m: -0.5,
            borderRadius: '8px',
            cursor: canEdit ? 'pointer' : 'default',
            '&:hover': canEdit ? { bgcolor: 'grey.50' } : undefined,
          }}
        >
          <Typography component="span" sx={{ display: 'block', fontSize: fontSizes['3xs'], fontWeight: 700, color: 'text.disabled' }}>
            Responsável
          </Typography>
          <Typography
            component="span"
            sx={{ display: 'block', fontSize: fontSizes.sm, fontWeight: 800, color: item.assignee ? 'text.primary' : 'text.disabled' }}
          >
            {item.assignee?.name ?? 'Definir'}
          </Typography>
        </Box>
        <Box
          component="span"
          sx={{
            fontSize: fontSizes['3xs'],
            fontWeight: 800,
            px: 1.4,
            py: 0.6,
            borderRadius: '8px',
            bgcolor: tone.chipBg,
            color: tone.text,
            border: 1,
            borderColor: tone.border,
            whiteSpace: 'nowrap',
          }}
        >
          {meta.chipLabel}
        </Box>
        {canEdit && (
          <Tooltip title="Marcar como resolvida">
            <IconButton
              aria-label={`Marcar ${item.title} como resolvida`}
              onClick={() => resolveMutation.mutate(item)}
              sx={{
                width: 32,
                height: 32,
                borderRadius: '9px',
                border: 1,
                borderColor: 'divider',
                color: 'text.disabled',
                '&:hover': { color: resolvedTone.text, borderColor: resolvedTone.main, bgcolor: resolvedTone.tint },
              }}
            >
              <CheckIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
        )}
        {canOpen && (
          <Button
            variant="contained"
            onClick={() => openDetails(item)}
            sx={{
              height: 32,
              px: 1.9,
              borderRadius: '9px',
              fontSize: fontSizes.xs,
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            Ver detalhes
          </Button>
        )}
      </Box>
    );
  };

  const renderGroup = (g: PendingGroup) => {
    const meta = GROUP_META[g];
    const tone = groupTone(g);
    const list = filtered.filter((i) => i.group === g);
    return (
      <Card key={g} sx={{ ...PANEL_SX, overflow: 'hidden' }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1.5}
          sx={{ px: 2.5, py: 1.9, bgcolor: tone.tint, borderBottom: 1, borderColor: 'divider' }}
        >
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ color: tone.text }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4.5M12 15.8v.1" />
            </svg>
            <Typography sx={{ fontSize: fontSizes.xl, fontWeight: 800, color: tone.text }}>{meta.label}</Typography>
          </Stack>
          <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 700, color: tone.text }}>
            {plural(list.length, 'pendência', 'pendências')}
          </Typography>
        </Stack>
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={74} sx={{ mx: 2.5 }} />)
        ) : list.length === 0 ? (
          <Typography sx={{ py: 4.25, px: 2.5, textAlign: 'center', fontSize: fontSizes.md, color: 'text.disabled', fontWeight: 600 }}>
            Nenhuma pendência nesta categoria.
          </Typography>
        ) : (
          list.map(renderRow)
        )}
      </Card>
    );
  };

  const resolvedList = category ? resolved.filter((t) => t.category === category) : resolved;

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.25, alignItems: 'flex-start' }}>
      {/* Coluna principal */}
      <Stack spacing={2} sx={{ flex: '1 1 380px', minWidth: 0 }}>
        {/* Foco de hoje */}
        <Card sx={{ ...PANEL_SX, display: 'flex', flexWrap: 'wrap', gap: 2.25, alignItems: 'center', px: 2.75, py: 2.5 }}>
          <Stack direction="row" alignItems="center" spacing={1.6} sx={{ flex: '1 1 220px', minWidth: 0 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '13px',
                bgcolor: primaryTone.tint,
                color: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <PendIcon name="flame" size={21} strokeWidth={1.8} />
            </Box>
            <Box sx={{ lineHeight: 1.3, minWidth: 0 }}>
              <Typography sx={{ fontSize: fontSizes.lg, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase' }}>
                Foco de hoje
              </Typography>
              <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary' }}>
                {isLoading
                  ? 'Carregando…'
                  : focus.length === 0
                    ? 'Nada urgente ou atrasado por agora.'
                    : `${plural(focus.length, 'tarefa precisa', 'tarefas precisam')} da sua atenção hoje.`}
              </Typography>
            </Box>
          </Stack>
          {focus.length > 0 && (
            <Stack spacing="2px" sx={{ flex: '1 1 300px', minWidth: 0 }}>
              {focus.map((item, idx) => (
                <Stack
                  key={item.key}
                  direction="row"
                  alignItems="center"
                  spacing={1.4}
                  {...clickableProps(() => openDetails(item))}
                  sx={{ py: 0.9, minWidth: 0, cursor: item.link || isManual(item) ? 'pointer' : 'default' }}
                >
                  <Box
                    sx={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      bgcolor: 'grey.100',
                      color: 'text.secondary',
                      fontSize: fontSizes['3xs'],
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </Box>
                  <Typography sx={{ flex: 1, minWidth: 0, fontSize: fontSizes.sm, fontWeight: 600 }}>{item.title}</Typography>
                  <Box
                    component="span"
                    sx={{
                      fontSize: fontSizes['3xs'],
                      fontWeight: 800,
                      px: 1.1,
                      py: 0.5,
                      borderRadius: '7px',
                      bgcolor: groupTone(item.group).chipBg,
                      color: groupTone(item.group).text,
                      border: 1,
                      borderColor: groupTone(item.group).border,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {GROUP_META[item.group].chipLabel}
                  </Box>
                </Stack>
              ))}
            </Stack>
          )}
        </Card>

        {/* Resumo */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1.75 }}>
          {stats.map((s) => (
            <Box
              key={s.label}
              role="button"
              tabIndex={0}
              onClick={() => setView(s.view)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setView(s.view)}
              sx={{
                bgcolor: s.bg,
                border: 1,
                borderColor: view === s.view ? s.color : s.border,
                borderRadius: '16px',
                px: 2.25,
                py: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 1.6,
                cursor: 'pointer',
                minWidth: 0,
                transition: 'border-color .15s',
              }}
            >
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: '12px',
                  bgcolor: s.color,
                  color: 'common.white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <PendIcon name={s.icon} size={18} strokeWidth={2.2} />
              </Box>
              <Stack spacing="3px" sx={{ minWidth: 0, lineHeight: 1.15 }}>
                {isLoading ? (
                  <Skeleton width={36} height={28} />
                ) : (
                  <Typography sx={{ fontSize: 26, fontWeight: 800, color: s.text, lineHeight: 1.05 }}>{s.n}</Typography>
                )}
                <Typography sx={{ fontSize: fontSizes.xs, fontWeight: 800, color: s.text, letterSpacing: '.02em' }}>
                  {s.label}
                </Typography>
              </Stack>
            </Box>
          ))}
        </Box>

        {/* Abas + filtro + regras */}
        <Stack direction="row" flexWrap="wrap" alignItems="center" gap={1.25}>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {GROUP_ORDER.map((g) => {
              const meta = GROUP_META[g];
              const tone = groupTone(g);
              const active = view === g;
              return (
                <Box
                  key={g}
                  role="tab"
                  aria-selected={active}
                  tabIndex={0}
                  onClick={() => setView(g)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setView(g)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.9,
                    px: 1.75,
                    py: 1.4,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    border: 1,
                    borderColor: active ? tone.main : 'divider',
                    bgcolor: active ? tone.tint : 'background.paper',
                    color: active ? tone.text : 'text.secondary',
                    fontSize: fontSizes.md,
                    fontWeight: 800,
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                  }}
                >
                  {meta.label}
                  <Box
                    component="span"
                    sx={{
                      fontSize: fontSizes['3xs'],
                      fontWeight: 800,
                      px: 1,
                      py: 0.25,
                      borderRadius: '7px',
                      bgcolor: active ? tone.chipBg : 'grey.100',
                      color: active ? tone.text : 'text.disabled',
                    }}
                  >
                    {countBy(filtered, g)}
                  </Box>
                </Box>
              );
            })}
          </Stack>
          <TextField
            select
            size="small"
            value={category}
            onChange={(e) => setCategory(e.target.value as PendingCategory | '')}
            sx={TOOLBAR_SELECT_SX}
            inputProps={{ 'aria-label': 'Categoria' }}
            SelectProps={{ displayEmpty: true }}
          >
            <MenuItem value="">Todos</MenuItem>
            {CATEGORY_OPTIONS.map((c) => (
              <MenuItem key={c.value} value={c.value}>
                {c.label}
              </MenuItem>
            ))}
          </TextField>
          <Button startIcon={<SettingsOutlinedIcon sx={{ fontSize: '16px !important' }} />} onClick={() => setRulesOpen(true)} sx={TOOLBAR_BUTTON_SX}>
            Regras · {data?.activeRules ?? '–'}
          </Button>
        </Stack>

        {groupsToShow.map(renderGroup)}

        {view === 'RESOLVED' && (
          <Card sx={{ ...PANEL_SX, overflow: 'hidden' }}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              spacing={1.5}
              sx={{ px: 2.5, py: 1.9, bgcolor: resolvedTone.tint, borderBottom: 1, borderColor: 'divider' }}
            >
              <Stack direction="row" alignItems="center" spacing={1.25} sx={{ color: resolvedTone.text }}>
                <PendIcon name="check" size={18} strokeWidth={2} />
                <Typography sx={{ fontSize: fontSizes.xl, fontWeight: 800, color: resolvedTone.text }}>
                  Resolvidas nos últimos 30 dias
                </Typography>
              </Stack>
              <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 700, color: resolvedTone.text }}>
                {plural(resolvedList.length, 'pendência', 'pendências')}
              </Typography>
            </Stack>
            {resolvedLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={64} sx={{ mx: 2.5 }} />)
            ) : resolvedList.length === 0 ? (
              <Typography sx={{ py: 4.25, px: 2.5, textAlign: 'center', fontSize: fontSizes.md, color: 'text.disabled', fontWeight: 600 }}>
                Nenhuma pendência resolvida nesta categoria.
              </Typography>
            ) : (
              resolvedList.map((t) => (
                <Stack
                  key={t.id}
                  direction="row"
                  flexWrap="wrap"
                  alignItems="center"
                  gap={1.75}
                  sx={{ px: 2.5, py: 1.6, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '11px',
                      bgcolor: resolvedTone.tint,
                      color: resolvedTone.text,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <PendIcon name={CATEGORY_META[t.category].icon} />
                  </Box>
                  <Box sx={{ flex: '1 1 200px', minWidth: 0, lineHeight: 1.35 }}>
                    <Typography sx={{ fontSize: fontSizes.md, fontWeight: 700, color: 'text.secondary', textDecoration: 'line-through' }}>
                      {t.title}
                    </Typography>
                    <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', fontWeight: 600 }}>
                      {CATEGORY_META[t.category].label} · Resolvida em {dayjs(t.resolvedAt).format('DD/MM/YYYY [às] HH:mm')}
                      {t.resolvedByName ? ` por ${t.resolvedByName}` : ''}
                    </Typography>
                  </Box>
                  {canEdit && (
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={reopenMutation.isPending}
                      onClick={() => reopenMutation.mutate(t.id)}
                      sx={{ height: 32, borderRadius: '9px', fontSize: fontSizes.xs, fontWeight: 700 }}
                    >
                      Reabrir
                    </Button>
                  )}
                </Stack>
              ))
            )}
          </Card>
        )}
      </Stack>

      {/* Coluna lateral */}
      <Stack spacing={2} sx={{ flex: '1 1 260px', minWidth: 0, maxWidth: { md: 340 } }}>
        <Card sx={{ ...PANEL_SX, p: 2.5 }}>
          <Typography sx={{ fontSize: fontSizes.md, fontWeight: 800, mb: 1.75 }}>Pendências por categoria</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', position: 'relative', mb: 2 }}>
            <svg width="128" height="128" viewBox="0 0 128 128" role="img" aria-label="Pendências por categoria">
              {donut.length === 0 ? (
                <circle cx="64" cy="64" r="45" fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth={18} />
              ) : (
                donut.map((d, i) => <path key={i} d={d.d} fill={d.color} />)
              )}
            </svg>
            <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', lineHeight: 1.15 }}>
              <Typography sx={{ fontSize: 24, fontWeight: 800, lineHeight: 1.15 }}>{items.length}</Typography>
              <Typography sx={{ fontSize: fontSizes['3xs'], color: 'text.disabled', fontWeight: 600 }}>total</Typography>
            </Box>
          </Box>
          <Stack spacing={1.1}>
            {byCategory.length === 0 && !isLoading && (
              <Typography sx={{ fontSize: fontSizes.sm, color: 'text.disabled', textAlign: 'center' }}>Nenhuma pendência aberta.</Typography>
            )}
            {byCategory.map((c) => (
              <Stack
                key={c.key}
                direction="row"
                alignItems="center"
                spacing={1.1}
                {...clickableProps(() => setCategory(category === c.key ? '' : c.key))}
                aria-pressed={category === c.key}
                sx={{ minWidth: 0, cursor: 'pointer', opacity: category && category !== c.key ? 0.5 : 1 }}
              >
                <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: c.color, flexShrink: 0 }} />
                <Typography sx={{ flex: 1, minWidth: 0, fontSize: fontSizes.sm, color: 'text.secondary', fontWeight: 600 }}>{c.label}</Typography>
                <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 800 }}>{c.n}</Typography>
              </Stack>
            ))}
          </Stack>
        </Card>

        <Card sx={{ ...PANEL_SX, p: 2.5 }}>
          <Typography sx={{ fontSize: fontSizes.md, fontWeight: 800, mb: 1.75 }}>Ações rápidas</Typography>
          <Stack spacing={0.75}>
            {quickActions.map((q) => (
              <Stack
                key={q.label}
                direction="row"
                alignItems="center"
                spacing={1.5}
                role="button"
                tabIndex={0}
                onClick={q.onClick}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && q.onClick()}
                sx={{ py: 1.1, px: 0.5, cursor: 'pointer', minWidth: 0, borderRadius: '10px', '&:hover': { bgcolor: 'grey.50' } }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    bgcolor: 'grey.50',
                    color: 'text.secondary',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <PendIcon name={q.icon} size={16} strokeWidth={1.9} />
                </Box>
                <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 700 }}>{q.label}</Typography>
              </Stack>
            ))}
          </Stack>
        </Card>
      </Stack>

      <Menu
        anchorEl={assignMenu?.anchor}
        open={!!assignMenu}
        onClose={() => setAssignMenu(null)}
        slotProps={{ paper: { sx: { maxHeight: 320, minWidth: 200, borderRadius: '12px' } } }}
      >
        <MenuItem
          onClick={() => {
            if (assignMenu) assignMutation.mutate({ item: assignMenu.item, user: null });
            setAssignMenu(null);
          }}
        >
          <ListItemText primary="Sem responsável" primaryTypographyProps={{ fontStyle: 'italic', fontSize: fontSizes.sm }} />
        </MenuItem>
        {users.map((u) => (
          <MenuItem
            key={u.id}
            selected={assignMenu?.item.assignee?.id === u.id}
            onClick={() => {
              if (assignMenu) assignMutation.mutate({ item: assignMenu.item, user: { id: u.id, name: u.name } });
              setAssignMenu(null);
            }}
          >
            <ListItemText primary={u.name} primaryTypographyProps={{ fontSize: fontSizes.sm }} />
          </MenuItem>
        ))}
      </Menu>

      <PendingTaskDialog
        open={taskDialog.open}
        editing={taskDialog.editing}
        canDelete={canDelete}
        onClose={() => setTaskDialog({ open: false, editing: null })}
      />
      <PendingRulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} canEdit={canEdit} />
    </Box>
  );
}
