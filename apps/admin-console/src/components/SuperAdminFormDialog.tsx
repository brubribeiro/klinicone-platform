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
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
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

const DIALOG_MAX_WIDTH = 520;

interface FormValues {
  name: string;
  email: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Adicionar super-admin por e-mail (cria puro ou promove usuário de clínica). */
export function SuperAdminFormDialog({ open, onClose }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const toast = useAppToast();

  const { control, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { name: '', email: '' },
  });

  useEffect(() => {
    if (open) reset({ name: '', email: '' });
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      adminApi.createSuperAdmin({ name: values.name.trim(), email: values.email.trim().toLowerCase() }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'super-admins'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      toast.success(
        created.hasClinic
          ? `“${created.email}” promovido a super-admin (login dual).`
          : `Super-admin “${created.email}” criado.`,
      );
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
          icon={<AdminPanelSettingsOutlinedIcon fontSize="small" />}
          title="Adicionar super-admin"
          subtitle="Se o e-mail já for de uma clínica, só ganha acesso ao /admin (login dual)"
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
            <FormSection title="Dados">
              <Stack spacing={1.75}>
                <Controller
                  name="name"
                  control={control}
                  rules={{ validate: (v) => !!v.trim() || 'Informe o nome' }}
                  render={({ field, fieldState }) => (
                    <LabeledField label="Nome" required>
                      <TextField
                        {...field}
                        fullWidth
                        autoFocus
                        placeholder="Ex.: Bruna Ribeiro"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                        inputProps={{ maxLength: 120, 'aria-label': 'Nome' }}
                      />
                    </LabeledField>
                  )}
                />
                <Controller
                  name="email"
                  control={control}
                  rules={{
                    validate: (v) => {
                      const email = v.trim().toLowerCase();
                      if (!email) return 'Informe o e-mail';
                      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'E-mail inválido';
                      return true;
                    },
                  }}
                  render={({ field, fieldState }) => (
                    <LabeledField label="E-mail (Google)" required>
                      <TextField
                        {...field}
                        fullWidth
                        type="email"
                        placeholder="voce@exemplo.com"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message ?? 'Login só via Google com este e-mail'}
                        inputProps={{ maxLength: 255, 'aria-label': 'E-mail' }}
                      />
                    </LabeledField>
                  )}
                />
              </Stack>
            </FormSection>

            {mutation.error && (
              <Alert severity="error" variant="outlined">
                {getApiErrorMessage(mutation.error, 'Não foi possível adicionar o super-admin.')}
              </Alert>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ ...dialogActionsBorderSx, flexShrink: 0 }}>
          <Button onClick={onClose} type="button" disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            {mutation.isPending ? 'Salvando…' : 'Adicionar'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
