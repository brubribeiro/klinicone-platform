import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MonitorWeightOutlinedIcon from '@mui/icons-material/MonitorWeightOutlined';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';

import { patientsApi, type PatientMeasurementPayload } from '../../api/patients';
import { useAppToast } from '../../contexts/AppToastContext';
import type { Appointment, MeasurementType, PatientMeasurement } from '../../types';
import { getApiErrorMessage } from '../../utils/apiError';
import { fontSizes } from '../../theme/fontSizes';
import { DialogHeader, dialogActionsBorderSx, formDialogPaperSx } from '../DialogCloseButton';
import { FieldAdornment } from '../FieldAdornment';
import { FormSection } from '../FormSection';
import { LabeledField } from '../LabeledField';
import { calcIMC, imcClassificacao, imcColor } from './anamnesisFields';
import { measureColumns, measureValue, type MeasureColumn } from './measurementFields';

interface Props {
  open: boolean;
  onClose: () => void;
  patientId: string;
  patientName?: string;
  appointments: Appointment[];
  editing?: PatientMeasurement | null;
  /** Tipos ativos do catálogo */
  types: MeasurementType[];
}

interface FormValues {
  measuredAt: string;
  appointmentId: string;
  notes: string;
  /** Por id da coluna (peso/altura: weightKg/heightCm) */
  measures: Record<string, string>;
}

const DIALOG_MAX_WIDTH = 640;

function toFormValues(columns: MeasureColumn[], m?: PatientMeasurement | null): FormValues {
  const measures: Record<string, string> = {};
  for (const c of columns) {
    const value = m ? measureValue(m, c) : null;
    measures[c.id] = value == null ? '' : String(value);
  }
  return {
    measuredAt: dayjs(m?.measuredAt).format('YYYY-MM-DD'),
    appointmentId: m?.appointmentId ?? '',
    notes: m?.notes ?? '',
    measures,
  };
}

const parseMeasure = (value: string | undefined) => {
  const n = parseFloat(value ?? '');
  return Number.isFinite(n) && n > 0 ? n : null;
};

function toPayload(values: FormValues, columns: MeasureColumn[], appointments: Appointment[]): PatientMeasurementPayload {
  const appt = appointments.find((a) => a.id === values.appointmentId);
  // Mesmo dia do agendamento: mantém o horário dele; senão, meio-dia local evita trocar de dia pelo fuso
  const measuredAt =
    appt && dayjs(appt.startAt).format('YYYY-MM-DD') === values.measuredAt
      ? appt.startAt
      : dayjs(`${values.measuredAt}T12:00:00`).toISOString();
  const payload: PatientMeasurementPayload = {
    measuredAt,
    appointmentId: values.appointmentId || null,
    notes: values.notes.trim() || null,
    values: [],
  };
  for (const c of columns) {
    const value = parseMeasure(values.measures[c.id]);
    if (c.key) payload[c.key] = value;
    else payload.values!.push({ typeId: c.id, value });
  }
  return payload;
}

export function PatientMeasurementDialog({ open, onClose, patientId, patientName, appointments, editing, types }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const toast = useAppToast();

  // Ao editar, aparecem também medidas desativadas que essa medição já tinha
  const columns = useMemo(() => measureColumns(types, editing ? [editing] : []), [types, editing]);

  const { control, handleSubmit, reset, watch, setValue } = useForm<FormValues>({
    defaultValues: toFormValues(columns),
  });

  useEffect(() => {
    if (open) reset(toFormValues(columns, editing));
  }, [open, editing, columns, reset]);

  const mutation = useMutation({
    mutationFn: (payload: PatientMeasurementPayload) =>
      editing
        ? patientsApi.updateMeasurement(patientId, editing.id, payload)
        : patientsApi.createMeasurement(patientId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-measurements', patientId] });
      // Peso/altura mais recentes são copiados para a anamnese
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      toast.success(editing ? 'Medidas atualizadas.' : 'Medidas registradas.');
      onClose();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível salvar as medidas.')),
  });

  const measures = watch('measures') ?? {};
  const imc = calcIMC(measures.weightKg, measures.heightCm);
  const hasMeasure = columns.some((c) => parseMeasure(measures[c.id]) != null);

  const submit = handleSubmit((values) => {
    if (!hasMeasure) return;
    mutation.mutate(toPayload(values, columns, appointments));
  });

  const sortedAppointments = [...appointments].sort((a, b) => b.startAt.localeCompare(a.startAt));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullScreen={isMobile}
      sx={{ zIndex: (t) => t.zIndex.modal + 2 }}
      PaperProps={{ sx: formDialogPaperSx(isMobile, { maxWidth: DIALOG_MAX_WIDTH, height: 'auto' }) }}
    >
      <Box
        component="form"
        noValidate
        onSubmit={submit}
        sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
      >
        <DialogHeader
          onClose={onClose}
          isMobile={isMobile}
          title={editing ? 'Editar medidas' : 'Registrar medidas'}
          subtitle={patientName}
          icon={<MonitorWeightOutlinedIcon fontSize="small" />}
        />

        <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 2.5, sm: 3 }, pb: { xs: 2, sm: 2.5 }, flex: 1, overflow: 'auto' }}>
          <Stack spacing={2} sx={{ mt: { xs: 1, sm: 1.5 } }}>
            <FormSection title="Quando">
              <Grid container spacing={1.75}>
                <Grid item xs={12} sm={5}>
                  <Controller
                    name="measuredAt"
                    control={control}
                    rules={{ required: true }}
                    render={({ field, fieldState }) => (
                      <LabeledField label="Data">
                        <TextField {...field} type="date" fullWidth size="small" error={!!fieldState.error} />
                      </LabeledField>
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={7}>
                  <Controller
                    name="appointmentId"
                    control={control}
                    render={({ field }) => (
                      <LabeledField label="Consulta (opcional)">
                        <TextField
                          {...field}
                          select
                          fullWidth
                          size="small"
                          onChange={(e) => {
                            field.onChange(e.target.value);
                            const appt = appointments.find((a) => a.id === e.target.value);
                            if (appt) setValue('measuredAt', dayjs(appt.startAt).format('YYYY-MM-DD'));
                          }}
                          SelectProps={{
                            displayEmpty: true,
                            MenuProps: { sx: { zIndex: (t) => t.zIndex.modal + 3 } },
                          }}
                        >
                          <MenuItem value="">
                            <em>Sem vínculo</em>
                          </MenuItem>
                          {sortedAppointments.map((a) => (
                            <MenuItem key={a.id} value={a.id}>
                              {dayjs(a.startAt).format('DD/MM/YYYY')} · {a.procedure?.name ?? 'Atendimento'}
                            </MenuItem>
                          ))}
                        </TextField>
                      </LabeledField>
                    )}
                  />
                </Grid>
              </Grid>
            </FormSection>

            <FormSection title="Medidas">
              <Grid container spacing={1.75}>
                {columns.map((f) => (
                  <Grid item xs={6} sm={4} key={f.id}>
                    <Controller
                      name={`measures.${f.id}`}
                      control={control}
                      render={({ field }) => (
                        <LabeledField label={f.active ? f.label : `${f.label} (desativada)`}>
                          <TextField
                            {...field}
                            value={field.value ?? ''}
                            fullWidth
                            size="small"
                            placeholder="0"
                            inputProps={{ inputMode: 'decimal', 'aria-label': `${f.label} (${f.unit})` }}
                            InputProps={{ endAdornment: <FieldAdornment>{f.unit}</FieldAdornment> }}
                            onChange={(e) => field.onChange(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))}
                          />
                        </LabeledField>
                      )}
                    />
                  </Grid>
                ))}
              </Grid>
              <Typography sx={{ mt: 1.25, fontSize: fontSizes.xs, color: 'text.secondary' }}>
                IMC:{' '}
                {imc != null ? (
                  <Box component="span" sx={{ fontWeight: 800, color: imcColor(imc) }}>
                    {imc} · {imcClassificacao(imc)}
                  </Box>
                ) : (
                  <Box component="span" sx={{ color: 'text.disabled' }}>
                    informe peso e altura
                  </Box>
                )}
              </Typography>
            </FormSection>

            <FormSection title="Observações">
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    size="small"
                    multiline
                    minRows={2}
                    placeholder="Ex.: medido em jejum, após 4ª sessão..."
                    inputProps={{ maxLength: 500, 'aria-label': 'Observações' }}
                  />
                )}
              />
            </FormSection>
          </Stack>
        </DialogContent>

        <DialogActions sx={dialogActionsBorderSx}>
          <Button
            onClick={onClose}
            type="button"
            variant="outlined"
            disabled={mutation.isPending}
            sx={{
              bgcolor: 'background.paper',
              borderColor: 'divider',
              color: 'text.secondary',
              '&:hover': { bgcolor: 'grey.50', borderColor: 'divider' },
            }}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={mutation.isPending || !hasMeasure}
            sx={{ boxShadow: (t) => `0 6px 16px -6px ${t.palette.primary.main}` }}
          >
            {mutation.isPending ? 'Salvando…' : 'Salvar medidas'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
