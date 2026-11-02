import { useEffect, useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

import { goalsApi, type CreateGoalPayload } from '../../api/goals';
import { useAppDialog } from '../../contexts/AppDialogContext';
import { useAppToast } from '../../contexts/AppToastContext';
import { getApiErrorMessage } from '../../utils/apiError';
import { AuroraIcon } from '../AuroraIcon';
import {
  DialogHeader,
  dialogActionsBorderSx,
  dialogFormLayoutSx,
  formDialogPaperSx,
} from '../DialogCloseButton';
import { FormSection } from '../FormSection';
import { LabeledField } from '../LabeledField';
import type { Goal, GoalFormat, GoalMetric, GoalPeriodType } from '../../types';
import { fontSizes } from '../../theme/fontSizes';
import {
  GOAL_COLORS,
  GOAL_FORMAT_OPTIONS,
  GOAL_METRICS,
  GOAL_PERIOD_OPTIONS,
  clampProgress,
  formatGoalPeriod,
  formatGoalValue,
  goalStatus,
  metricOption,
} from './goalUtils';

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: Goal | null;
  canDelete?: boolean;
}

interface FormValues {
  metric: GoalMetric;
  name: string;
  format: GoalFormat;
  target: number | '';
  manualValue: number | '';
  periodType: GoalPeriodType;
  year: number;
  /** Mês (0–11) ou trimestre (0–3), conforme o tipo de período. */
  part: number;
  color: string;
}

const DIALOG_MAX_WIDTH = 880;

const COMPACT_SECTION_SX = {
  p: { xs: 1.5, sm: 1.75 },
  alignSelf: 'flex-start',
  width: '100%',
  height: 'fit-content',
  '& > .MuiStack-root:first-of-type': { mb: 1.25 },
} as const;

const PERIOD_GRID_SX = (periodType: GoalPeriodType) =>
  ({
    display: 'grid',
    gap: 1.75,
    gridTemplateColumns:
      periodType === 'YEAR'
        ? { xs: '1fr', sm: '1fr minmax(120px, 160px)' }
        : { xs: '1fr', sm: 'minmax(0, 1fr) minmax(140px, 1.3fr) minmax(100px, 0.8fr)' },
  }) as const;

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => {
  const m = dayjs().locale('pt-br').month(i).format('MMMM');
  return m.charAt(0).toUpperCase() + m.slice(1);
});
const QUARTER_LABELS = ['1º trimestre', '2º trimestre', '3º trimestre', '4º trimestre'];

function toPeriodStart(type: GoalPeriodType, year: number, part: number) {
  const month = type === 'YEAR' ? 0 : type === 'QUARTER' ? part * 3 : part;
  return `${year}-${String(month + 1).padStart(2, '0')}-01`;
}

function partFor(type: GoalPeriodType, date: dayjs.Dayjs) {
  if (type === 'QUARTER') return Math.floor(date.month() / 3);
  if (type === 'YEAR') return 0;
  return date.month();
}

function defaultValues(): FormValues {
  const now = dayjs();
  return {
    metric: 'REVENUE',
    name: metricOption('REVENUE').defaultName,
    format: 'CURRENCY',
    target: '',
    manualValue: '',
    periodType: 'MONTH',
    year: now.year(),
    part: now.month(),
    color: GOAL_COLORS[0],
  };
}

export function GoalFormDialog({ open, onClose, editing, canDelete }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const { confirm } = useAppDialog();

  const { control, handleSubmit, reset, watch, setValue, getValues } = useForm<FormValues>({
    defaultValues: defaultValues(),
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const start = dayjs(editing.periodStart);
      reset({
        metric: editing.metric,
        name: editing.name,
        format: editing.format,
        target: editing.target,
        manualValue: editing.manualValue ?? '',
        periodType: editing.periodType,
        year: start.year(),
        part: partFor(editing.periodType, start),
        color: editing.color,
      });
    } else {
      reset(defaultValues());
    }
  }, [open, editing, reset]);

  const [metric, format, periodType, year, part, color, target, manualValue] = watch([
    'metric',
    'format',
    'periodType',
    'year',
    'part',
    'color',
    'target',
    'manualValue',
  ]);
  const option = metricOption(metric);
  const isManual = metric === 'MANUAL';
  const periodStart = toPeriodStart(periodType, year, part);

  const { data: preview, isFetching: previewLoading } = useQuery({
    queryKey: ['goals', 'preview', metric, periodType, periodStart],
    queryFn: () => goalsApi.preview({ metric, periodType, periodStart }),
    enabled: open && !isManual,
    staleTime: 60_000,
  });

  const currentValue = isManual
    ? manualValue === ''
      ? 0
      : Number(manualValue)
    : (preview?.currentValue ?? (editing?.metric === metric ? editing.currentValue : 0));

  const yearOptions = useMemo(() => {
    const base = dayjs().year();
    const years = new Set([base - 1, base, base + 1, base + 2, year]);
    return [...years].sort((a, b) => a - b);
  }, [year]);

  const handleMetricChange = (next: GoalMetric) => {
    const prevOption = metricOption(getValues('metric'));
    const nextOption = metricOption(next);
    setValue('metric', next);
    // Métricas automáticas têm formato fixo; ao voltar para manual, número é o padrão mais neutro.
    setValue('format', nextOption.format ?? 'NUMBER');
    // Troca o nome só se ainda for o sugerido pelo indicador anterior.
    const currentName = getValues('name').trim();
    if (!currentName || currentName === prevOption.defaultName) {
      setValue('name', nextOption.defaultName);
    }
  };

  const handlePeriodTypeChange = (next: GoalPeriodType) => {
    const current = dayjs(toPeriodStart(getValues('periodType'), getValues('year'), getValues('part')));
    setValue('periodType', next);
    setValue('part', partFor(next, current));
  };

  const onSaved = (message: string) => {
    queryClient.invalidateQueries({ queryKey: ['goals'] });
    toast.success(message);
    onClose();
  };

  const createMutation = useMutation({
    mutationFn: (payload: CreateGoalPayload) => goalsApi.create(payload),
    onSuccess: () => onSaved('Meta criada.'),
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível criar a meta.')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreateGoalPayload }) => goalsApi.update(id, payload),
    onSuccess: () => onSaved('Meta atualizada.'),
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível atualizar a meta.')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => goalsApi.remove(id),
    onSuccess: () => onSaved('Meta excluída.'),
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível excluir a meta.')),
  });

  const onSubmit = (values: FormValues) => {
    const payload: CreateGoalPayload = {
      name: values.name.trim(),
      metric: values.metric,
      format: values.format,
      target: Number(values.target),
      periodType: values.periodType,
      periodStart: toPeriodStart(values.periodType, values.year, values.part),
      color: values.color,
      ...(values.metric === 'MANUAL'
        ? { manualValue: values.manualValue === '' ? 0 : Number(values.manualValue) }
        : {}),
    };
    if (editing) updateMutation.mutate({ id: editing.id, payload });
    else createMutation.mutate(payload);
  };

  const handleDelete = async () => {
    if (!editing) return;
    const ok = await confirm({
      title: 'Excluir meta',
      message: `Excluir a meta "${editing.name}"?`,
      confirmLabel: 'Excluir',
      confirmColor: 'error',
    });
    if (ok) deleteMutation.mutate(editing.id);
  };

  const saving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  const targetNumber = target === '' ? 0 : Number(target);
  const progress = targetNumber > 0 ? (currentValue / targetNumber) * 100 : 0;
  const status = goalStatus(progress);
  const tone = status.tone(theme, color);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: formDialogPaperSx(isMobile, {
          maxWidth: DIALOG_MAX_WIDTH,
          height: 'min(86dvh, 680px)',
        }),
      }}
    >
      <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={dialogFormLayoutSx(isMobile)}>
        <DialogHeader
          onClose={onClose}
          isMobile={isMobile}
          title={editing ? 'Editar meta' : 'Nova meta'}
          subtitle={
            editing
              ? `${editing.name} · ${formatGoalPeriod(editing.periodStart, editing.periodType)}`
              : 'Indicador, objetivo e período de acompanhamento'
          }
          icon={editing ? <EditOutlinedIcon fontSize="small" /> : <AuroraIcon name="metas" size={20} />}
        />

        <DialogContent
          sx={{
            px: { xs: 2, sm: 3 },
            pb: { xs: 2, sm: 2.5 },
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            bgcolor: 'background.default',
            '&.MuiDialogContent-root': { pt: { xs: 2.75, sm: 3 } },
          }}
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.75, alignItems: 'flex-start' }}>
            <FormSection title="Indicador" sx={COMPACT_SECTION_SX}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
                <LabeledField label="O que acompanhar" required>
                  <TextField
                    select
                    fullWidth
                    value={metric}
                    onChange={(e) => handleMetricChange(e.target.value as GoalMetric)}
                    helperText={option.hint}
                  >
                    {GOAL_METRICS.map((m) => (
                      <MenuItem key={m.value} value={m.value}>
                        {m.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </LabeledField>
                <Controller
                  name="name"
                  control={control}
                  rules={{ validate: (v) => !!v.trim() || 'Nome é obrigatório' }}
                  render={({ field, fieldState }) => (
                    <LabeledField label="Nome da meta" required>
                      <TextField
                        {...field}
                        placeholder="Ex.: Faturamento mensal"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                        inputProps={{ maxLength: 80 }}
                        fullWidth
                      />
                    </LabeledField>
                  )}
                />
                <Controller
                  name="format"
                  control={control}
                  render={({ field }) => (
                    <LabeledField label="Formato">
                      <TextField
                        {...field}
                        select
                        fullWidth
                        disabled={!isManual}
                        helperText={isManual ? undefined : 'Definido pelo indicador'}
                      >
                        {GOAL_FORMAT_OPTIONS.map((f) => (
                          <MenuItem key={f.value} value={f.value}>
                            {f.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </LabeledField>
                  )}
                />
              </Box>
            </FormSection>

            <FormSection title="Objetivo e período" sx={COMPACT_SECTION_SX}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
                <Box sx={PERIOD_GRID_SX(periodType)}>
                  <LabeledField label="Período">
                    <TextField
                      select
                      fullWidth
                      value={periodType}
                      onChange={(e) => handlePeriodTypeChange(e.target.value as GoalPeriodType)}
                    >
                      {GOAL_PERIOD_OPTIONS.map((p) => (
                        <MenuItem key={p.value} value={p.value}>
                          {p.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </LabeledField>
                  {periodType !== 'YEAR' && (
                    <Controller
                      name="part"
                      control={control}
                      render={({ field }) => (
                        <LabeledField label={periodType === 'QUARTER' ? 'Trimestre' : 'Mês'}>
                          <TextField
                            {...field}
                            select
                            fullWidth
                            onChange={(e) => field.onChange(Number(e.target.value))}
                            sx={{ '& .MuiSelect-select': { textOverflow: 'clip' } }}
                          >
                            {(periodType === 'QUARTER' ? QUARTER_LABELS : MONTH_LABELS).map((label, i) => (
                              <MenuItem key={label} value={i}>
                                {label}
                              </MenuItem>
                            ))}
                          </TextField>
                        </LabeledField>
                      )}
                    />
                  )}
                  <Controller
                    name="year"
                    control={control}
                    render={({ field }) => (
                      <LabeledField label="Ano">
                        <TextField
                          {...field}
                          select
                          fullWidth
                          onChange={(e) => field.onChange(Number(e.target.value))}
                          SelectProps={{ displayEmpty: false }}
                          sx={{ '& .MuiSelect-select': { minWidth: 0, pr: 3 } }}
                        >
                          {yearOptions.map((y) => (
                            <MenuItem key={y} value={y}>
                              {y}
                            </MenuItem>
                          ))}
                        </TextField>
                      </LabeledField>
                    )}
                  />
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}>
                  {isManual ? (
                    <Controller
                      name="manualValue"
                      control={control}
                      rules={{ min: { value: 0, message: 'Não pode ser negativo' } }}
                      render={({ field, fieldState }) => (
                        <LabeledField label="Valor atual">
                          <TextField
                            {...field}
                            type="number"
                            placeholder="0"
                            error={!!fieldState.error}
                            helperText={fieldState.error?.message}
                            inputProps={{ step: 'any', min: 0 }}
                            fullWidth
                          />
                        </LabeledField>
                      )}
                    />
                  ) : (
                    <LabeledField label="Valor atual">
                      <Box
                        sx={{
                          height: 32,
                          px: 1.5,
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: '10px',
                          border: 1,
                          borderColor: 'divider',
                          bgcolor: 'grey.50',
                          fontSize: fontSizes.sm,
                          fontWeight: 700,
                        }}
                      >
                        {previewLoading && preview === undefined ? (
                          <Skeleton width={70} />
                        ) : (
                          formatGoalValue(currentValue, format)
                        )}
                      </Box>
                      <Typography sx={{ fontSize: fontSizes['2xs'], color: 'text.disabled', mx: 1.75, mt: -0.25 }}>
                        Calculado automaticamente
                      </Typography>
                    </LabeledField>
                  )}
                  <Controller
                    name="target"
                    control={control}
                    rules={{
                      required: 'Informe o objetivo',
                      validate: (v) => Number(v) > 0 || 'Deve ser maior que zero',
                    }}
                    render={({ field, fieldState }) => (
                      <LabeledField label="Objetivo (meta)" required>
                        <TextField
                          {...field}
                          type="number"
                          placeholder="0"
                          error={!!fieldState.error}
                          helperText={fieldState.error?.message}
                          inputProps={{ step: 'any', min: 0 }}
                          fullWidth
                        />
                      </LabeledField>
                    )}
                  />
                </Box>
                <LabeledField label="Cor">
                  <Stack direction="row" spacing={1}>
                    {GOAL_COLORS.map((c) => (
                      <Box
                        key={c}
                        component="button"
                        type="button"
                        aria-label={`Cor ${c}`}
                        onClick={() => setValue('color', c)}
                        sx={{
                          width: 30,
                          height: 30,
                          borderRadius: '9px',
                          border: 'none',
                          cursor: 'pointer',
                          bgcolor: c,
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: (t) => (color === c ? `0 0 0 2px ${t.palette.background.paper}, 0 0 0 4px ${c}` : 'none'),
                        }}
                      >
                        {color === c && <CheckIcon sx={{ fontSize: 16 }} />}
                      </Box>
                    ))}
                  </Stack>
                </LabeledField>
              </Box>
            </FormSection>
          </Box>

          {/* Prévia do card */}
          <Box
            sx={{
              mt: 2.25,
              p: 2,
              borderRadius: '14px',
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.25 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  bgcolor: alpha(color, 0.1),
                  color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AuroraIcon name={option.icon} size={19} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: fontSizes.md, fontWeight: 800 }}>
                  {formatGoalValue(currentValue, format)}
                  <Box component="span" sx={{ color: 'text.disabled', fontWeight: 600, fontSize: fontSizes.sm }}>
                    {` / ${formatGoalValue(targetNumber, format)}`}
                  </Box>
                </Typography>
                <Typography sx={{ fontSize: fontSizes['2xs'], color: 'text.disabled', fontWeight: 600 }}>
                  {formatGoalPeriod(periodStart, periodType)}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 800, color: tone }}>
                {Math.round(progress)}% · {status.label}
              </Typography>
            </Stack>
            <Box sx={{ height: 9, borderRadius: 8, bgcolor: 'grey.100', overflow: 'hidden' }}>
              <Box sx={{ height: '100%', width: `${clampProgress(progress)}%`, borderRadius: 8, bgcolor: color, transition: 'width .3s' }} />
            </Box>
          </Box>

          {mutationError && (
            <Alert severity="error" variant="outlined" sx={{ mt: 2.25 }}>
              {getApiErrorMessage(mutationError, 'Erro ao salvar meta')}
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ ...dialogActionsBorderSx, flexShrink: 0 }}>
          {editing && canDelete && (
            <Button
              type="button"
              color="error"
              startIcon={<DeleteOutlineIcon />}
              onClick={handleDelete}
              disabled={saving}
              sx={{ mr: 'auto' }}
            >
              Excluir
            </Button>
          )}
          <Button onClick={onClose} type="button" disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? 'Salvando…' : editing ? 'Salvar' : 'Criar meta'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
