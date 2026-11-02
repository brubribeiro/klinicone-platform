import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  IconButton,
  Skeleton,
  Stack,
  Switch,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { recurringExpensesApi, type HourlyCostSettings } from '../../api/recurring-expenses';
import { useAppToast } from '../../contexts/AppToastContext';
import { fontSizes } from '../../theme/fontSizes';
import { brl } from '../../utils/money';
import { ROW_ACTION_BUTTON_SX } from '../RowActionButton';

const hours = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

const HOURLY_COST_COLLAPSED_KEY = 'mila.recurring-expenses.hourly-cost-collapsed';

function readHourlyCostCollapsedPref(): boolean {
  try {
    const stored = localStorage.getItem(HOURLY_COST_COLLAPSED_KEY);
    if (stored === '1') return true;
    if (stored === '0') return false;
  } catch {
    /* ignore */
  }
  return true;
}

const HOURLY_COST_ALERT_SX = {
  py: 0.75,
  px: 1.5,
  alignItems: 'center',
  '& .MuiAlert-icon': { py: 0, mr: 1.25, alignItems: 'center' },
  '& .MuiAlert-message': {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 0.5,
    py: 0,
    fontSize: fontSizes.sm,
    lineHeight: 1.35,
  },
} as const;

const CELL_LABEL_SX = {
  fontSize: fontSizes['2xs'],
  fontWeight: 700,
  color: 'text.disabled',
  textTransform: 'uppercase',
  letterSpacing: '.4px',
  mb: 1.25,
} as const;

interface HourlyCostCardProps {
  /** Despesas fixas ativas do cadastro (soma mensal). */
  activeFixedMonthly: number;
  /** Despesas variáveis ativas do cadastro (soma mensal). */
  activeVariableMonthly: number;
}

/**
 * Card "Custo por hora operacional": usa a preferência global `hourly_cost.include_variable`
 * (o switch) e mostra a base de cálculo; pode ser minimizado.
 */
export function HourlyCostCard({ activeFixedMonthly, activeVariableMonthly }: HourlyCostCardProps) {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const [hourlyCostCollapsed, setHourlyCostCollapsed] = useState(readHourlyCostCollapsedPref);

  const toggleHourlyCostCollapsed = () => {
    setHourlyCostCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(HOURLY_COST_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const { data: hourlyCostSettings } = useQuery({
    queryKey: ['recurring-expenses', 'hourly-cost-settings'],
    queryFn: () => recurringExpensesApi.getHourlyCostSettings(),
  });

  const includeVariable = hourlyCostSettings?.includeVariable ?? false;

  const { data: hourlyCostSummary, isLoading: hourlyCostLoading } = useQuery({
    queryKey: ['recurring-expenses', 'hourly-cost-summary', includeVariable],
    queryFn: () => recurringExpensesApi.getHourlyCostSummary(includeVariable),
    enabled: hourlyCostSettings !== undefined,
    placeholderData: keepPreviousData,
  });

  const updateHourlySettingsMutation = useMutation({
    mutationFn: (value: boolean) => recurringExpensesApi.updateHourlyCostSettings(value),
    onMutate: async (value) => {
      await queryClient.cancelQueries({ queryKey: ['recurring-expenses', 'hourly-cost-settings'] });
      const previousSettings = queryClient.getQueryData<HourlyCostSettings>([
        'recurring-expenses',
        'hourly-cost-settings',
      ]);
      queryClient.setQueryData(['recurring-expenses', 'hourly-cost-settings'], { includeVariable: value });
      await queryClient.prefetchQuery({
        queryKey: ['recurring-expenses', 'hourly-cost-summary', value],
        queryFn: () => recurringExpensesApi.getHourlyCostSummary(value),
      });
      return { previousSettings };
    },
    onError: (_err, _value, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(['recurring-expenses', 'hourly-cost-settings'], context.previousSettings);
      }
      toast.error('Não foi possível atualizar a configuração de custo/hora.');
    },
    onSuccess: (_data, value) => {
      void queryClient.prefetchQuery({
        queryKey: ['recurring-expenses', 'hourly-cost-summary', value],
        queryFn: () => recurringExpensesApi.getHourlyCostSummary(value),
      });
      queryClient.invalidateQueries({ queryKey: ['procedures'] });
    },
  });

  const expensesForHourlyRate = includeVariable
    ? activeFixedMonthly + activeVariableMonthly
    : activeFixedMonthly;

  const hourlyCostTooltip = useMemo(() => {
    if (!hourlyCostSummary) return null;
    const financeDiff = includeVariable
      ? Math.abs(hourlyCostSummary.financeExpensesMonthly - expensesForHourlyRate)
      : Math.abs(hourlyCostSummary.financeExpensesMonthly - activeFixedMonthly);
    const expenseLabel = includeVariable ? 'fixas + variáveis' : 'fixas';

    return (
      <Stack spacing={0.75} sx={{ maxWidth: 300, p: 0.25 }}>
        <Typography variant="caption" display="block">
          Total de despesas {expenseLabel} ativas no cadastro, dividido pela carga horária mensal do
          profissional principal ({hourlyCostSummary.monthlyHours} h).
        </Typography>
        {includeVariable && activeVariableMonthly > 0 && (
          <Typography variant="caption" display="block">
            Composição: fixas {brl.format(activeFixedMonthly)} + variáveis{' '}
            {brl.format(activeVariableMonthly)}.
          </Typography>
        )}
        <Typography variant="caption" display="block">
          Procedimentos usam as despesas lançadas no financeiro do mês atual, não este cadastro.
        </Typography>
        {financeDiff > 0.01 && (
          <Typography variant="caption" display="block">
            Financeiro (mês atual): {brl.format(hourlyCostSummary.financeExpensesMonthly)} em despesas{' '}
            {expenseLabel}.
          </Typography>
        )}
      </Stack>
    );
  }, [
    hourlyCostSummary,
    includeVariable,
    expensesForHourlyRate,
    activeFixedMonthly,
    activeVariableMonthly,
  ]);

  const hourlyCostLabel = hourlyCostSummary ? brl.format(hourlyCostSummary.hourlyCost) : '—';

  return (
    <>
      {hourlyCostLoading && !hourlyCostSummary ? (
        <Skeleton variant="rounded" height={220} sx={{ borderRadius: '18px' }} />
      ) : null}
      {hourlyCostSummary && (
        <Card sx={{ borderRadius: '18px', overflow: 'hidden' }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
            useFlexGap
            gap={1.25}
            sx={{
              px: { xs: 2, sm: '22px' },
              py: '18px',
              borderBottom: hourlyCostCollapsed ? 0 : 1,
              borderColor: 'divider',
            }}
          >
            <Box sx={{ minWidth: 0, lineHeight: 1.3 }}>
              <Stack direction="row" alignItems="center" spacing={0.25}>
                <Typography sx={{ fontSize: fontSizes.xl, fontWeight: 700 }}>
                  Custo por hora operacional
                </Typography>
                {hourlyCostTooltip && (
                  <Tooltip title={hourlyCostTooltip} arrow placement="top-start">
                    <IconButton
                      size="small"
                      aria-label="Detalhes do cálculo de custo por hora"
                      sx={{ color: 'text.disabled' }}
                    >
                      <InfoOutlinedIcon sx={{ fontSize: 17 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
              <Typography sx={{ fontSize: fontSizes.sm, color: 'text.disabled' }}>
                Base de cálculo: {includeVariable ? 'custos fixos + variáveis ativos' : 'apenas custos fixos ativos'}
              </Typography>
            </Box>

            <Stack direction="row" alignItems="center" spacing={2}>
              {hourlyCostCollapsed ? (
                <Stack direction="row" alignItems="baseline" spacing={0.75}>
                  <Typography sx={{ fontSize: fontSizes['3xl'], fontWeight: 800, color: 'primary.dark', letterSpacing: '-.5px' }}>
                    {hourlyCostLabel}
                  </Typography>
                  <Typography sx={{ fontSize: fontSizes.xs, color: 'text.disabled', fontWeight: 600 }}>
                    / hora
                  </Typography>
                </Stack>
              ) : (
                <Tooltip
                  title="Inclui despesas variáveis ativas no custo/hora e no cálculo dos procedimentos."
                  arrow
                  placement="left"
                >
                  <Stack
                    component="label"
                    direction="row"
                    alignItems="center"
                    spacing={0.75}
                    sx={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 600, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                      Incluir custos variáveis
                    </Typography>
                    <Switch
                      size="small"
                      checked={includeVariable}
                      onChange={(e) => updateHourlySettingsMutation.mutate(e.target.checked)}
                      inputProps={{ 'aria-label': 'Incluir despesas variáveis no cálculo' }}
                    />
                  </Stack>
                </Tooltip>
              )}
              <Tooltip title={hourlyCostCollapsed ? 'Expandir' : 'Minimizar'}>
                <IconButton
                  onClick={toggleHourlyCostCollapsed}
                  aria-label={hourlyCostCollapsed ? 'Expandir custo por hora' : 'Minimizar custo por hora'}
                  sx={{ ...ROW_ACTION_BUTTON_SX, width: 34, height: 34, borderRadius: '10px', bgcolor: 'grey.50' }}
                >
                  {hourlyCostCollapsed ? (
                    <KeyboardArrowDownIcon fontSize="small" />
                  ) : (
                    <KeyboardArrowUpIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          {!hourlyCostCollapsed && (
            <>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr 1fr', md: '1.1fr 1fr 1fr 1.2fr' },
                  '& > div': { px: { xs: 2, sm: '22px' }, py: '20px', minWidth: 0 },
                  '& > div:not(:last-of-type)': (t) => ({
                    borderBottom: `1px solid ${t.palette.grey[100]}`,
                    [t.breakpoints.up('md')]: { borderBottom: 0, borderRight: `1px solid ${t.palette.grey[100]}` },
                  }),
                }}
              >
                <Box>
                  <Typography sx={CELL_LABEL_SX}>Carga horária / mês</Typography>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box
                      sx={{
                        height: 46,
                        minWidth: 90,
                        px: 1.75,
                        borderRadius: '11px',
                        border: 1,
                        borderColor: 'divider',
                        bgcolor: 'grey.50',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: fontSizes['2xl'],
                        fontWeight: 800,
                      }}
                    >
                      {hours.format(hourlyCostSummary.monthlyHours)}
                    </Box>
                    <Typography sx={{ fontSize: fontSizes.sm, color: 'text.disabled', fontWeight: 600 }}>
                      horas
                    </Typography>
                  </Stack>
                  <Typography sx={{ fontSize: fontSizes.xs, color: 'text.disabled', mt: 1 }} noWrap>
                    {hourlyCostSummary.primaryProfessional
                      ? `Agenda de ${hourlyCostSummary.primaryProfessional.name}`
                      : 'Sem profissional principal'}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={CELL_LABEL_SX}>Custo fixo / mês</Typography>
                  <Typography sx={{ fontSize: fontSizes['4xl'], fontWeight: 800, letterSpacing: '-.5px' }}>
                    {brl.format(activeFixedMonthly)}
                  </Typography>
                  <Typography sx={{ fontSize: fontSizes.xs, color: 'warning.main', fontWeight: 600, mt: 1 }}>
                    + variável: {brl.format(activeVariableMonthly)}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={CELL_LABEL_SX}>Base de cálculo</Typography>
                  <Typography sx={{ fontSize: fontSizes['4xl'], fontWeight: 800, letterSpacing: '-.5px' }}>
                    {brl.format(hourlyCostSummary.recurringExpensesMonthly)}
                  </Typography>
                  <Typography sx={{ fontSize: fontSizes.xs, color: 'text.disabled', fontWeight: 600, mt: 1 }}>
                    ÷ {hours.format(hourlyCostSummary.monthlyHours)} horas
                  </Typography>
                </Box>
                <Box
                  sx={{
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}
                >
                  <Typography sx={{ ...CELL_LABEL_SX, color: 'primary.main', mb: 0.75 }}>
                    Custo por hora
                  </Typography>
                  <Typography sx={{ fontSize: fontSizes['7xl'], fontWeight: 800, color: 'primary.dark', letterSpacing: '-1px', lineHeight: 1.15 }}>
                    {hourlyCostLabel}
                  </Typography>
                </Box>
              </Box>

              <Stack
                spacing={1.25}
                sx={{ px: { xs: 2, sm: '22px' }, py: '15px', borderTop: 1, borderColor: 'grey.100', bgcolor: 'grey.50' }}
              >
                <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                  <InfoOutlinedIcon sx={{ fontSize: 16, color: 'primary.main', flexShrink: 0 }} />
                  <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary', fontWeight: 600 }}>
                    Procedimentos usam o financeiro do mês atual:{' '}
                    <Box component="b" sx={{ color: 'text.primary' }}>
                      {brl.format(hourlyCostSummary.financeExpensesMonthly)}
                    </Box>{' '}
                    em despesas {includeVariable ? 'fixas + variáveis' : 'fixas'}
                  </Typography>
                </Stack>
                {!hourlyCostSummary.primaryProfessional && (
                  <Alert severity="warning" sx={HOURLY_COST_ALERT_SX}>
                    Nenhum profissional principal cadastrado.
                    <Button component={RouterLink} to="/profissionais" size="small" sx={{ ml: 0.5 }}>
                      Configurar
                    </Button>
                  </Alert>
                )}
                {hourlyCostSummary.primaryProfessional && hourlyCostSummary.monthlyHours <= 0 && (
                  <Alert severity="warning" sx={HOURLY_COST_ALERT_SX}>
                    Sem horários de atendimento na agenda.
                    <Button component={RouterLink} to="/horarios" size="small" sx={{ ml: 0.5 }}>
                      Configurar horários
                    </Button>
                  </Alert>
                )}
              </Stack>
            </>
          )}
        </Card>
      )}
    </>
  );
}
