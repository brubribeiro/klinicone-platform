import { useEffect, useMemo, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import FitnessCenterOutlinedIcon from '@mui/icons-material/FitnessCenterOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { patientsApi } from '../../api/patients';
import { useAppToast } from '../../contexts/AppToastContext';
import { getApiErrorMessage } from '../../utils/apiError';
import { DialogHeader, dialogActionsBorderSx } from '../DialogCloseButton';
import { FieldAdornment } from '../FieldAdornment';
import { FormSection } from '../FormSection';
import { LabeledField } from '../LabeledField';
import { useAnamnesisQuestions } from '../../hooks/useAnamnesisQuestions';
import {
  MEASUREMENTS_SECTION,
  anamnesisSections,
  calcIMC,
  createEmptyAnamnesis,
  imcClassificacao,
  imcColor,
  mergeAnamnesis,
  type AnamnesisFieldDef,
  type AnamnesisFormValue,
} from './anamnesisFields';
import { fontSizes } from '../../theme/fontSizes';

interface AnamnesisFormDialogProps {
  open: boolean;
  onClose: () => void;
  patientId: string | null;
}

type FormValues = Record<string, AnamnesisFormValue>;

const fieldLabel = (f: AnamnesisFieldDef) => (f.required ? `${f.label} *` : f.label);

const DIALOG_WIDTH = 920;
const DIALOG_HEIGHT_DESKTOP = 820;

const FIELD_SX = {} as const;

const ANAMNESIS_SWITCH_ROW_SX = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 1.5,
  px: 1.5,
  minHeight: 44,
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: '11px',
  bgcolor: 'grey.50',
} as const;

export function AnamnesisFormDialog({ open, onClose, patientId }: AnamnesisFormDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const toast = useAppToast();

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => patientsApi.findOne(patientId!),
    enabled: open && !!patientId,
  });

  const { data: questions, isLoading: questionsLoading } = useAnamnesisQuestions('GENERAL', open);
  const sections = useMemo(() => anamnesisSections(questions ?? []), [questions]);

  const { control, handleSubmit, reset, watch } = useForm<FormValues>({
    defaultValues: createEmptyAnamnesis(),
  });

  useEffect(() => {
    if (!open || !questions) return;
    if (patient) {
      // Respostas de perguntas desativadas ou movidas seguem no objeto e voltam intactas ao salvar.
      reset(mergeAnamnesis(patient.anamnesis, sections));
    } else if (!patientId) {
      reset(createEmptyAnamnesis(sections));
    }
  }, [open, patient, patientId, questions, sections, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => patientsApi.updateAnamnesis(patientId!, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      // Peso/altura alterados viram um registro no histórico de medidas
      queryClient.invalidateQueries({ queryKey: ['patient-measurements', patientId] });
      toast.success('Anamnese salva.');
      onClose();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Não foi possível salvar a anamnese.'));
    },
  });

  const pesoVal = watch('peso');
  const alturaVal = watch('altura');
  const imcVal = calcIMC(pesoVal, alturaVal);

  const submit = handleSubmit((values) => mutation.mutate(values));

  const renderField = (fieldDef: AnamnesisFieldDef) => {
    if (fieldDef.type === 'boolean') {
      return (
        <Grid item xs={12} sm={6} key={fieldDef.key}>
          <Controller
            name={fieldDef.key}
            control={control}
            render={({ field }) => (
              <Box sx={ANAMNESIS_SWITCH_ROW_SX}>
                <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 600, lineHeight: 1.35 }}>
                  {fieldLabel(fieldDef)}
                </Typography>
                <Switch
                  checked={!!field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  size="small"
                />
              </Box>
            )}
          />
        </Grid>
      );
    }

    const gridSm = fieldDef.fullWidth ? 12 : 6;

    if (fieldDef.type === 'number') {
      return (
        <Grid item xs={6} sm={6} key={fieldDef.key}>
          <Controller
            name={fieldDef.key}
            control={control}
            render={({ field }) => (
              <LabeledField label={fieldLabel(fieldDef)}>
                <TextField
                  {...field}
                  fullWidth
                  size="small"
                  placeholder="0"
                  inputProps={{ inputMode: 'decimal' }}
                  InputProps={
                    fieldDef.suffix
                      ? {
                          endAdornment: <FieldAdornment>{fieldDef.suffix}</FieldAdornment>,
                        }
                      : undefined
                  }
                  value={field.value === '' || field.value == null ? '' : field.value}
                  onChange={(e) =>
                    field.onChange(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))
                  }
                  sx={FIELD_SX}
                />
              </LabeledField>
            )}
          />
        </Grid>
      );
    }

    if (fieldDef.type === 'multiselect') {
      return (
        <Grid item xs={12} sm={gridSm} key={fieldDef.key}>
          <Controller
            name={fieldDef.key}
            control={control}
            render={({ field }) => (
              <LabeledField label={fieldLabel(fieldDef)}>
                <TextField
                  {...field}
                  select
                  fullWidth
                  size="small"
                  value={Array.isArray(field.value) ? field.value : []}
                  SelectProps={{
                    multiple: true,
                    displayEmpty: true,
                    MenuProps: { sx: { zIndex: (t) => t.zIndex.modal + 3 } },
                    renderValue: (val) =>
                      (val as string[]).length ? (
                        (val as string[]).join(', ')
                      ) : (
                        <Typography component="span" variant="body2" sx={{ color: 'text.disabled' }}>
                          Não informado
                        </Typography>
                      ),
                  }}
                  sx={FIELD_SX}
                >
                  {fieldDef.options!.map((opt) => (
                    <MenuItem key={opt} value={opt}>
                      {opt}
                    </MenuItem>
                  ))}
                </TextField>
              </LabeledField>
            )}
          />
        </Grid>
      );
    }

    if (fieldDef.type === 'select') {
      return (
        <Grid item xs={12} sm={gridSm} key={fieldDef.key}>
          <Controller
            name={fieldDef.key}
            control={control}
            render={({ field }) => (
              <LabeledField label={fieldLabel(fieldDef)}>
                <TextField
                  {...field}
                  select
                  fullWidth
                  size="small"
                  value={(field.value as string) ?? ''}
                  SelectProps={{
                    displayEmpty: true,
                    MenuProps: { sx: { zIndex: (t) => t.zIndex.modal + 3 } },
                    renderValue: (val) =>
                      val ? (
                        String(val)
                      ) : (
                        <Typography component="span" variant="body2" sx={{ color: 'text.disabled' }}>
                          Não informado
                        </Typography>
                      ),
                  }}
                  sx={FIELD_SX}
                >
                  <MenuItem value="">
                    <em>Não informado</em>
                  </MenuItem>
                  {fieldDef.options!.map((opt) => (
                    <MenuItem key={opt} value={opt}>
                      {opt}
                    </MenuItem>
                  ))}
                </TextField>
              </LabeledField>
            )}
          />
        </Grid>
      );
    }

    const multiline = fieldDef.fullWidth;

    return (
      <Grid item xs={12} sm={gridSm} key={fieldDef.key}>
        <Controller
          name={fieldDef.key}
          control={control}
          render={({ field }) => (
            <LabeledField label={fieldLabel(fieldDef)}>
              <TextField
                {...field}
                fullWidth
                size="small"
                multiline={multiline}
                minRows={multiline ? 2 : undefined}
                placeholder={fieldDef.placeholder}
                value={(field.value as string) ?? ''}
                sx={FIELD_SX}
              />
            </LabeledField>
          )}
        />
      </Grid>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      fullScreen={isMobile}
      sx={{ zIndex: (t) => t.zIndex.modal + 2 }}
      PaperProps={{
        sx: {
          width: isMobile ? '100%' : DIALOG_WIDTH,
          maxWidth: '100%',
          borderRadius: isMobile ? 0 : '20px',
          overflow: 'hidden',
          ...(isMobile
            ? { height: '100%', maxHeight: '100dvh' }
            : { height: DIALOG_HEIGHT_DESKTOP, maxHeight: '94dvh' }),
        },
      }}
    >
      <Box
        component="form"
        noValidate
        onSubmit={submit}
        sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
      >
        <DialogHeader
          onClose={onClose}
          isMobile={isMobile}
          title="Anamnese"
          subtitle={patient?.name ?? 'Carregando paciente…'}
          subtitleWrap
          icon={<AssignmentOutlinedIcon fontSize="small" />}
        />

        <DialogContent
          dividers={false}
          sx={{
            px: { xs: 2, sm: 3 },
            pt: { xs: 2.5, sm: 3 },
            pb: { xs: 2, sm: 3 },
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            bgcolor: 'background.paper',
          }}
        >
          {(isLoading && !patient) || questionsLoading ? (
            <Box display="flex" justifyContent="center" py={8}>
              <CircularProgress />
            </Box>
          ) : (
              <Stack spacing={2} sx={{ mt: { xs: 1, sm: 1.5 } }}>
                {sections.map((section) => {
                  const inputs = section.fields.filter((f) => f.type !== 'boolean');
                  const toggles = section.fields.filter((f) => f.type === 'boolean');
                  return (
                    <FormSection key={section.title} title={section.title}>
                      {inputs.length > 0 && (
                        <Grid container spacing={1.75} alignItems="flex-start">
                          {inputs.map(renderField)}
                        </Grid>
                      )}
                      {section.title === MEASUREMENTS_SECTION && (
                        <Typography sx={{ mt: 1.25, fontSize: fontSizes.xs, color: 'text.secondary' }}>
                          IMC:{' '}
                          {imcVal != null ? (
                            <Box component="span" sx={{ fontWeight: 800, color: imcColor(imcVal) }}>
                              {imcVal} · {imcClassificacao(imcVal)}
                            </Box>
                          ) : (
                            <Box component="span" sx={{ color: 'text.disabled' }}>
                              informe peso e altura
                            </Box>
                          )}
                        </Typography>
                      )}
                      {toggles.length > 0 && (
                        <Grid container spacing={1.75} sx={{ mt: inputs.length > 0 ? 1.75 : 0 }}>
                          {toggles.map(renderField)}
                        </Grid>
                      )}
                    </FormSection>
                  );
                })}
              </Stack>
          )}

          {mutation.isError && (
            <Alert severity="error" variant="outlined" sx={{ mt: 2 }}>
              {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data
                ?.message ?? 'Erro ao salvar anamnese'}
            </Alert>
          )}
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
            disabled={mutation.isPending || isLoading || !patient || !questions}
            sx={{ boxShadow: (t) => `0 6px 16px -6px ${t.palette.primary.main}` }}
          >
            {mutation.isPending ? 'Salvando…' : 'Salvar anamnese'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
