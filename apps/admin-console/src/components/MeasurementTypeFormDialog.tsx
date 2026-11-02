import { useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Stack,
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MonitorWeightOutlinedIcon from '@mui/icons-material/MonitorWeightOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../api/admin';
import { useAppToast } from '../../../../frontend/src/contexts/AppToastContext';
import { getApiErrorMessage } from '../../../../frontend/src/utils/apiError';
import {
  DialogHeader,
  dialogActionsBorderSx,
  dialogPaperSx,
} from '../../../../frontend/src/components/DialogCloseButton';
import { FormSection } from '../../../../frontend/src/components/FormSection';
import { LabeledField } from '../../../../frontend/src/components/LabeledField';
import type { MeasurementType } from '../../../../frontend/src/types';

const DIALOG_MAX_WIDTH = 520;

interface FormValues {
  name: string;
  unit: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  editing: MeasurementType | null;
}

/** Criar ou editar tipo de medida corporal (peso e altura não passam por aqui). */
export function MeasurementTypeFormDialog({ open, onClose, editing }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const isEdit = !!editing;

  const { control, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { name: '', unit: 'cm' },
  });

  useEffect(() => {
    if (open) reset({ name: editing?.name ?? '', unit: editing?.unit ?? 'cm' });
  }, [open, editing, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = { name: values.name.trim(), unit: values.unit.trim() };
      return editing ? adminApi.updateMeasurementType(editing.id, payload) : adminApi.createMeasurementType(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'measurement-types'],
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      queryClient.invalidateQueries({ queryKey: ['measurement-types'] });
      toast.success(isEdit ? 'Medida atualizada.' : 'Medida criada.');
      onClose();
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          ...dialogPaperSx(isMobile),
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          ...(isMobile ? { height: '100%', maxHeight: '100dvh' } : { maxWidth: DIALOG_MAX_WIDTH, overflow: 'hidden' }),
        },
      }}
    >
      <Box
        component="form"
        noValidate
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
        sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
      >
        <DialogHeader
          onClose={onClose}
          isMobile={isMobile}
          icon={isEdit ? <EditOutlinedIcon fontSize="small" /> : <MonitorWeightOutlinedIcon fontSize="small" />}
          title={isEdit ? 'Editar medida' : 'Nova medida'}
          subtitle="Aparece no card “Medidas corporais” de todas as clínicas"
        />
        <DialogContent
          sx={{
            px: { xs: 2, sm: 3 },
            pb: { xs: 2, sm: 2.5 },
            flex: 1,
            overflow: 'auto',
            bgcolor: 'background.default',
            '&.MuiDialogContent-root': { pt: { xs: 2.75, sm: 3 } },
          }}
        >
          <Stack spacing={2.25}>
            <FormSection title="Dados da medida">
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.75}>
                <Controller
                  name="name"
                  control={control}
                  rules={{ validate: (v) => !!v.trim() || 'Informe o nome' }}
                  render={({ field, fieldState }) => (
                    <Box sx={{ flex: 2 }}>
                      <LabeledField label="Nome" required>
                        <TextField
                          {...field}
                          fullWidth
                          autoFocus
                          placeholder="Ex.: Coxa"
                          error={!!fieldState.error}
                          helperText={fieldState.error?.message}
                          inputProps={{ maxLength: 60, 'aria-label': 'Nome' }}
                        />
                      </LabeledField>
                    </Box>
                  )}
                />
                <Controller
                  name="unit"
                  control={control}
                  rules={{ validate: (v) => !!v.trim() || 'Informe a unidade' }}
                  render={({ field, fieldState }) => (
                    <Box sx={{ flex: 1 }}>
                      <LabeledField label="Unidade" required>
                        <TextField
                          {...field}
                          fullWidth
                          placeholder="cm"
                          error={!!fieldState.error}
                          helperText={fieldState.error?.message}
                          inputProps={{
                            maxLength: 12,
                            'aria-label': 'Unidade',
                          }}
                        />
                      </LabeledField>
                    </Box>
                  )}
                />
              </Stack>
            </FormSection>

            {mutation.error && (
              <Alert severity="error" variant="outlined">
                {getApiErrorMessage(mutation.error, 'Não foi possível salvar a medida.')}
              </Alert>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ ...dialogActionsBorderSx, flexShrink: 0 }}>
          <Button onClick={onClose} type="button" disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            {mutation.isPending ? 'Salvando…' : isEdit ? 'Salvar' : 'Criar'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
