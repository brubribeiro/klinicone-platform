import { useState } from 'react';
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
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { goalsApi, type GoalScope } from '../api/goals';
import { AuroraIcon } from '../components/AuroraIcon';
import { GoalFormDialog } from '../components/goals/GoalFormDialog';
import {
  LIST_HEADER_PAPER_SELECT_SX,
  LIST_HEADER_PRIMARY_ACTION_SX,
  ListCardHeader,
} from '../components/ListCardHeader';
import {
  clampProgress,
  formatGoalPeriod,
  formatGoalValue,
  goalStatus,
  goalSummary,
  metricOption,
} from '../components/goals/goalUtils';
import { usePermissions } from '../contexts/usePermissions';
import type { Goal } from '../types';
import { StatCard } from '../components/StatCard';
import { fontSizes } from '../theme/fontSizes';
import { clickableProps } from '../utils/a11y';

const CARD_GRID_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fill, minmax(360px, 1fr))' },
  gap: 2.25,
} as const;

const SCOPE_OPTIONS: { value: GoalScope; label: string }[] = [
  { value: 'current', label: 'Em andamento' },
  { value: 'upcoming', label: 'Próximas' },
  { value: 'past', label: 'Encerradas' },
  { value: 'all', label: 'Todas' },
];

export function Goals() {
  const theme = useTheme();
  const { has } = usePermissions();
  const canCreate = has('goals:create');
  const canEdit = has('goals:edit');
  const canDelete = has('goals:delete');
  const [scope, setScope] = useState<GoalScope>('current');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals', 'list', scope],
    queryFn: () => goalsApi.list({ scope }),
    placeholderData: keepPreviousData,
  });

  const summary = goalSummary(goals);
  const summaryCards = [
    { label: scope === 'current' ? 'Metas ativas' : 'Metas', value: String(summary.total), color: 'text.primary' },
    { label: 'Atingidas', value: String(summary.reached), color: 'success.main' },
    { label: 'Progresso médio', value: `${summary.average}%`, color: 'primary.main' },
  ];

  const openEdit = (goal: Goal) => {
    setEditing(goal);
    setFormOpen(true);
  };

  const scopeLabel = SCOPE_OPTIONS.find((o) => o.value === scope)?.label ?? 'Metas';

  return (
    <Stack spacing={2.25}>
      <Box data-tour="goals-summary" sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: { xs: 1, sm: 1.75 } }}>
        {summaryCards.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} color={s.color} loading={isLoading} />
        ))}
      </Box>

      <Card data-tour="goals-list" sx={{ borderRadius: '18px', overflow: 'hidden' }}>
        <ListCardHeader
          breakpoint="md"
          nowrapFrom="md"
          title={
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: fontSizes.xl, fontWeight: 700 }}>{scopeLabel}</Typography>
              <Typography sx={{ fontSize: fontSizes.xs, color: 'text.disabled', fontWeight: 600 }}>
                {isLoading
                  ? 'Carregando…'
                  : `${goals.length} ${goals.length === 1 ? 'meta' : 'metas'}`}
              </Typography>
            </Box>
          }
        >
          <TextField
            select
            size="small"
            value={scope}
            onChange={(e) => setScope(e.target.value as GoalScope)}
            sx={LIST_HEADER_PAPER_SELECT_SX}
            inputProps={{ 'aria-label': 'Filtrar metas por período' }}
          >
            {SCOPE_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          {canCreate && (
            <Button data-tour="goals-new"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              sx={LIST_HEADER_PRIMARY_ACTION_SX}
            >
              Nova meta
            </Button>
          )}
        </ListCardHeader>

        {isLoading ? (
          <Box sx={{ ...CARD_GRID_SX, p: { xs: 2, sm: 2.25 } }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={176} sx={{ borderRadius: '18px' }} />
            ))}
          </Box>
        ) : goals.length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <Box sx={{ color: 'text.disabled', mb: 1 }}>
              <AuroraIcon name="metas" size={46} strokeWidth={1.4} />
            </Box>
            <Typography sx={{ fontWeight: 700 }}>
              {scope === 'current' ? 'Nenhuma meta em andamento' : 'Nenhuma meta encontrada'}
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: fontSizes.md, mt: 0.5 }}>
              Defina objetivos de faturamento, pacientes, procedimentos e outros indicadores para acompanhar o progresso.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ ...CARD_GRID_SX, p: { xs: 2, sm: 2.25 } }}>
          {goals.map((g) => {
            const option = metricOption(g.metric);
            const status = goalStatus(g.progress);
            const tone = status.tone(theme, g.color);
            const done = status.key === 'DONE';
            return (
              <Card
                key={g.id}
                {...(canEdit && clickableProps(() => openEdit(g)))}
                sx={{
                  p: { xs: 2.25, sm: 2.5 },
                  borderRadius: '18px',
                  border: 1,
                  borderColor: 'divider',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.9,
                  cursor: canEdit ? 'pointer' : 'default',
                  transition: 'box-shadow .15s, border-color .15s',
                  '&:hover': { boxShadow: '0 12px 30px -20px rgba(16,40,37,0.45)', borderColor: alpha(g.color, 0.5) },
                }}
              >
                <Stack direction="row" alignItems="flex-start" spacing={1.6}>
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: '12px',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: alpha(g.color, 0.1),
                      color: g.color,
                    }}
                  >
                    <AuroraIcon name={option.icon} size={21} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
                    <Typography noWrap title={g.name} sx={{ fontSize: fontSizes.lg, fontWeight: 800 }}>
                      {g.name}
                    </Typography>
                    <Typography noWrap sx={{ fontSize: fontSizes.xs, color: 'text.secondary', fontWeight: 600 }}>
                      {formatGoalPeriod(g.periodStart, g.periodType)}
                      {g.metric === 'MANUAL' ? ' · manual' : ''}
                    </Typography>
                  </Box>
                  <Box
                    component="span"
                    sx={{
                      flexShrink: 0,
                      fontSize: fontSizes['2xs'],
                      fontWeight: 700,
                      px: 1.25,
                      py: 0.5,
                      borderRadius: '8px',
                      whiteSpace: 'nowrap',
                      bgcolor: done ? alpha(theme.palette.success.main, 0.12) : alpha(tone, 0.1),
                      color: done ? 'success.dark' : tone,
                    }}
                  >
                    {status.label}
                  </Box>
                  {canEdit && (
                    <Tooltip title="Editar meta">
                      <IconButton
                        aria-label={`Editar meta ${g.name}`}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          openEdit(g);
                        }}
                        sx={{
                          width: 30,
                          height: 30,
                          borderRadius: '9px',
                          border: 1,
                          borderColor: 'divider',
                          bgcolor: 'grey.50',
                          color: 'text.disabled',
                          flexShrink: 0,
                          '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
                        }}
                      >
                        <EditIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>

                <Stack direction="row" alignItems="baseline" spacing={1} sx={{ minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: fontSizes['4xl'], fontWeight: 800, letterSpacing: '-0.6px' }}>
                    {formatGoalValue(g.currentValue, g.format)}
                  </Typography>
                  <Typography noWrap sx={{ fontSize: fontSizes.sm, color: 'text.disabled', fontWeight: 600 }}>
                    / {formatGoalValue(g.target, g.format)}
                  </Typography>
                </Stack>

                <Box>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.9 }}>
                    <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', fontWeight: 600 }}>Progresso</Typography>
                    <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 800, color: tone }}>
                      {Math.round(g.progress)}%
                    </Typography>
                  </Stack>
                  <Box sx={{ height: 9, borderRadius: 8, bgcolor: 'grey.100', overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', width: `${clampProgress(g.progress)}%`, borderRadius: 8, bgcolor: g.color }} />
                  </Box>
                </Box>
              </Card>
            );
          })}
          </Box>
        )}
      </Card>

      <GoalFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        editing={editing}
        canDelete={canDelete}
      />
    </Stack>
  );
}
