import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';

import { patientsApi } from '../../api/patients';
import { useAppDialog } from '../../contexts/AppDialogContext';
import { useAppToast } from '../../contexts/AppToastContext';
import { fontSizes } from '../../theme/fontSizes';
import type { Appointment, PatientMeasurement } from '../../types';
import { getApiErrorMessage } from '../../utils/apiError';
import { PANEL_SX } from '../skincare/skincareUi';
import { imcClassificacao, imcColor } from './anamnesisFields';
import { CHART_METRICS, formatMeasure, withImc, type ChartMetric } from './measurementFields';
import { PatientMeasurementDialog } from './PatientMeasurementDialog';

interface Props {
  patient: { id: string; name: string; appointments?: Appointment[] };
  canEdit: boolean;
}

const HEAD_CELL_SX = {
  fontSize: fontSizes.xs,
  fontWeight: 700,
  color: 'text.secondary',
  whiteSpace: 'nowrap',
  py: 1,
  px: 1,
} as const;

const CELL_SX = { fontSize: fontSizes.sm, whiteSpace: 'nowrap', py: 1.1, px: 1 } as const;

const TABLE_COLUMNS = [
  { key: 'weightKg', label: 'Peso (kg)' },
  { key: 'heightCm', label: 'Altura (cm)' },
  { key: 'imc', label: 'IMC' },
  { key: 'waistCm', label: 'Cintura' },
  { key: 'abdomenCm', label: 'Abdômen' },
  { key: 'hipCm', label: 'Quadril' },
] as const;

function SummaryTile({ label, value, hint, hintColor }: { label: string; value: string; hint?: string; hintColor?: string }) {
  return (
    <Box sx={{ flex: 1, minWidth: 140, p: 1.5, borderRadius: '12px', border: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
      <Typography sx={{ fontSize: fontSizes.xs, fontWeight: 700, color: 'text.secondary' }}>{label}</Typography>
      <Typography sx={{ fontSize: fontSizes.xl, fontWeight: 800, letterSpacing: '-0.01em', mt: 0.25 }}>{value}</Typography>
      {hint && (
        <Typography sx={{ fontSize: fontSizes.xs, fontWeight: 600, color: hintColor ?? 'text.secondary', mt: 0.25 }}>
          {hint}
        </Typography>
      )}
    </Box>
  );
}

/** Card "Medidas corporais" da ficha: evolução de peso, IMC e circunferências por data. */
export function PatientMeasurementsCard({ patient, canEdit }: Props) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const { confirm } = useAppDialog();
  const [dialog, setDialog] = useState<{ open: boolean; editing: PatientMeasurement | null }>({
    open: false,
    editing: null,
  });
  const [metric, setMetric] = useState<ChartMetric>('weightKg');

  const { data: measurements = [], isLoading } = useQuery({
    queryKey: ['patient-measurements', patient.id],
    queryFn: () => patientsApi.listMeasurements(patient.id),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => patientsApi.removeMeasurement(patient.id, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-measurements', patient.id] });
      queryClient.invalidateQueries({ queryKey: ['patient', patient.id] });
      toast.success('Medição excluída.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível excluir a medição.')),
  });

  // API devolve do mais recente para o mais antigo
  const chronological = useMemo(() => withImc([...measurements].reverse()), [measurements]);
  const rows = useMemo(() => [...chronological].reverse(), [chronological]);

  const availableMetrics = CHART_METRICS.filter((m) => chronological.some((r) => r[m.key] != null));
  const activeMetric = availableMetrics.find((m) => m.key === metric) ?? availableMetrics[0];
  const chartData = activeMetric
    ? chronological
        .filter((r) => r[activeMetric.key] != null)
        .map((r) => ({ t: dayjs(r.measuredAt).valueOf(), value: r[activeMetric.key] as number }))
    : [];

  const weights = chronological.filter((r) => r.weightKg != null);
  const firstWeight = weights[0];
  const lastWeight = weights[weights.length - 1];
  const weightDelta =
    firstWeight && lastWeight && firstWeight !== lastWeight
      ? Math.round(((lastWeight.weightKg as number) - (firstWeight.weightKg as number)) * 100) / 100
      : null;
  const lastImc = [...chronological].reverse().find((r) => r.imc != null)?.imc ?? null;

  const handleDelete = async (m: PatientMeasurement) => {
    const ok = await confirm({
      title: 'Excluir medição',
      message: `Excluir as medidas de ${dayjs(m.measuredAt).format('DD/MM/YYYY')}?`,
      confirmLabel: 'Excluir',
      confirmColor: 'error',
    });
    if (ok) removeMutation.mutate(m.id);
  };

  return (
    <Box sx={{ ...PANEL_SX, overflow: 'hidden' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          flexWrap: 'wrap',
          px: { xs: 2, sm: 2.75 },
          py: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box>
          <Typography component="h3" sx={{ fontSize: fontSizes.xl, fontWeight: 700 }}>
            Medidas corporais
          </Typography>
          <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', fontWeight: 600 }}>
            {measurements.length === 0
              ? 'Evolução de peso, IMC e circunferências'
              : `${measurements.length} ${measurements.length === 1 ? 'registro' : 'registros'}`}
          </Typography>
        </Box>
        {canEdit && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialog({ open: true, editing: null })}
            sx={{ height: 36, px: 1.75, borderRadius: '10px', fontSize: fontSizes.xs, fontWeight: 700 }}
          >
            Registrar medidas
          </Button>
        )}
      </Box>

      {isLoading ? (
        <Box sx={{ px: 2.75, py: 2 }}>
          <Skeleton width="60%" />
          <Skeleton width="40%" />
        </Box>
      ) : measurements.length === 0 ? (
        <Typography sx={{ px: { xs: 2, sm: 2.75 }, py: 2.25, fontSize: fontSizes.xs, color: 'text.secondary', fontWeight: 600 }}>
          Nenhuma medida registrada. Peso e altura salvos na anamnese também entram neste histórico.
        </Typography>
      ) : (
        <Stack spacing={2} sx={{ px: { xs: 2, sm: 2.75 }, py: 2 }}>
          <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap">
            <SummaryTile
              label="Peso atual"
              value={formatMeasure(lastWeight?.weightKg, 'kg')}
              hint={
                weightDelta != null
                  ? `${weightDelta > 0 ? '+' : ''}${formatMeasure(weightDelta, 'kg')} desde ${dayjs(firstWeight.measuredAt).format('DD/MM/YYYY')}`
                  : undefined
              }
            />
            <SummaryTile
              label="IMC atual"
              value={formatMeasure(lastImc)}
              hint={lastImc != null ? imcClassificacao(lastImc) : 'informe peso e altura'}
              hintColor={lastImc != null ? imcColor(lastImc) : undefined}
            />
            <SummaryTile
              label="Última medição"
              value={dayjs(rows[0].measuredAt).format('DD/MM/YYYY')}
              hint={rows[0].appointment?.procedure?.name ?? (rows[0].appointment ? 'Consulta' : undefined)}
            />
          </Stack>

          {activeMetric && (
            <Box>
              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mb: 1.25 }} role="group" aria-label="Métrica do gráfico">
                {availableMetrics.map((m) => (
                  <Chip
                    key={m.key}
                    label={m.label}
                    size="small"
                    clickable
                    color={m.key === activeMetric.key ? 'primary' : 'default'}
                    variant={m.key === activeMetric.key ? 'filled' : 'outlined'}
                    onClick={() => setMetric(m.key)}
                    aria-pressed={m.key === activeMetric.key}
                    sx={{ fontWeight: 700 }}
                  />
                ))}
              </Stack>
              {chartData.length < 2 ? (
                <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', fontWeight: 600, py: 1 }}>
                  Registre ao menos duas medições de {activeMetric.label.toLowerCase()} para ver a evolução.
                </Typography>
              ) : (
                <Box sx={{ height: 220 }} aria-label={`Evolução de ${activeMetric.label}`} role="img">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                      <CartesianGrid vertical={false} stroke={theme.palette.divider} />
                      <XAxis
                        dataKey="t"
                        type="number"
                        scale="time"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={(t: number) => dayjs(t).format('DD/MM/YY')}
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        tickLine={false}
                        axisLine={{ stroke: theme.palette.divider }}
                        minTickGap={24}
                        padding={{ left: 12, right: 12 }}
                      />
                      <YAxis
                        domain={['auto', 'auto']}
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        tickLine={false}
                        axisLine={false}
                        width={48}
                        tickFormatter={(v: number) => formatMeasure(v)}
                      />
                      <ChartTooltip
                        cursor={{ stroke: theme.palette.divider }}
                        labelFormatter={(t: number) => dayjs(t).format('DD/MM/YYYY')}
                        formatter={(v: number) => [formatMeasure(v, activeMetric.unit), activeMetric.label]}
                        contentStyle={{
                          borderRadius: 10,
                          border: `1px solid ${theme.palette.divider}`,
                          background: theme.palette.background.paper,
                          fontSize: 12,
                        }}
                        labelStyle={{ color: theme.palette.text.secondary, fontWeight: 700 }}
                        itemStyle={{ color: theme.palette.text.primary }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={theme.palette.primary.main}
                        strokeWidth={2}
                        dot={{ r: 4, fill: theme.palette.primary.main, stroke: theme.palette.background.paper, strokeWidth: 2 }}
                        activeDot={{ r: 5, stroke: theme.palette.background.paper, strokeWidth: 2 }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </Box>
          )}

          <Box sx={{ overflowX: 'auto', mx: { xs: -2, sm: -2.75 } }}>
            <Table size="small" aria-label="Histórico de medidas">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...HEAD_CELL_SX, pl: { xs: 2, sm: 2.75 } }}>Data</TableCell>
                  {TABLE_COLUMNS.map((c) => (
                    <TableCell key={c.key} sx={HEAD_CELL_SX} align="right">
                      {c.label}
                    </TableCell>
                  ))}
                  {canEdit && <TableCell sx={{ ...HEAD_CELL_SX, pr: { xs: 1, sm: 1.5 } }} aria-label="Ações" />}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ ...CELL_SX, pl: { xs: 2, sm: 2.75 } }}>
                      <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 700 }}>
                        {dayjs(r.measuredAt).format('DD/MM/YYYY')}
                      </Typography>
                      {(r.appointment || r.notes) && (
                        <Typography
                          sx={{ fontSize: fontSizes.xs, color: 'text.secondary', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}
                          title={r.notes ?? undefined}
                        >
                          {r.appointment ? (r.appointment.procedure?.name ?? 'Consulta') : r.notes}
                        </Typography>
                      )}
                    </TableCell>
                    {TABLE_COLUMNS.map((c) => (
                      <TableCell
                        key={c.key}
                        sx={c.key === 'imc' && r.imc != null ? { ...CELL_SX, fontWeight: 700, color: imcColor(r.imc) } : CELL_SX}
                        align="right"
                      >
                        {formatMeasure(r[c.key])}
                      </TableCell>
                    ))}
                    {canEdit && (
                      <TableCell sx={{ ...CELL_SX, pr: { xs: 1, sm: 1.5 } }} align="right">
                        <Tooltip title="Editar">
                          <IconButton size="small" aria-label="Editar medição" onClick={() => setDialog({ open: true, editing: r })}>
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Excluir">
                          <IconButton
                            size="small"
                            aria-label="Excluir medição"
                            onClick={() => handleDelete(r)}
                            disabled={removeMutation.isPending}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Typography sx={{ px: { xs: 2, sm: 2.75 }, pt: 1, fontSize: fontSizes.xs, color: 'text.secondary' }}>
              Cintura, abdômen e quadril em cm.
            </Typography>
          </Box>
        </Stack>
      )}

      {canEdit && (
        <PatientMeasurementDialog
          open={dialog.open}
          onClose={() => setDialog({ open: false, editing: null })}
          patientId={patient.id}
          patientName={patient.name}
          appointments={patient.appointments ?? []}
          editing={dialog.editing}
        />
      )}
    </Box>
  );
}
