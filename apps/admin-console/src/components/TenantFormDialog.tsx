import { useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../api/admin';
import { useAppToast } from '../../../../frontend/src/contexts/AppToastContext';
import { getApiErrorMessage } from '../../../../frontend/src/utils/apiError';
import { DialogHeader, dialogActionsBorderSx, dialogPaperSx } from '../../../../frontend/src/components/DialogCloseButton';
import { FormSection } from '../../../../frontend/src/components/FormSection';
import { LabeledField } from '../../../../frontend/src/components/LabeledField';
import { PlanSelect } from './PlanSelect';
import { CatalogSelectChip, FeatureModuleChipGrid } from './FeatureModuleChips';
import { CLINIC_SPECIALTIES, CLINIC_SPECIALTY_LABELS } from '../../../../frontend/src/features/clinicSpecialties';
import { fontSizes } from '../../../../frontend/src/theme/fontSizes';
import {
  buildTenantProfilePayload,
  emptyTenantProfileForm,
  tenantProfileFormFromTenant,
  type TenantProfileFormValues,
} from './tenantFormUtils';
import type { AdminTenant } from '../../../../frontend/src/types';

const DIALOG_MAX_WIDTH = 820;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CNPJ_PATTERN = /^(\d{14}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})$/;

type FormValues = TenantProfileFormValues & {
  name: string;
  slug: string;
  adminName: string;
  adminEmail: string;
  planId: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  /** null = nova clínica */
  editing: AdminTenant | null;
}

/** Criar clínica (com o primeiro administrador) ou editar nome/identificador. */
export function TenantFormDialog({ open, onClose, editing }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const toast = useAppToast();

  const { control, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { name: '', slug: '', adminName: '', adminEmail: '', planId: '', ...emptyTenantProfileForm },
  });

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const slug = values.slug.trim() || undefined;
      const profile = buildTenantProfilePayload(values, !!editing);
      if (editing) {
        return adminApi.updateTenant(editing.id, {
          name: values.name.trim(),
          slug,
          planId: values.planId || null,
          ...profile,
        });
      }
      return adminApi.createTenant({
        name: values.name.trim(),
        slug,
        planId: values.planId || undefined,
        adminName: values.adminName.trim(),
        adminEmail: values.adminEmail.trim().toLowerCase(),
        ...profile,
      });
    },
    onSuccess: (tenant) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenants'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] });
      if (editing) queryClient.invalidateQueries({ queryKey: ['admin', 'tenant', editing.id] });
      toast.success(editing ? 'Clínica atualizada.' : `Clínica ${tenant.name} criada.`);
      onClose();
    },
  });

  const saving = saveMutation.isPending;
  const resetMutation = saveMutation.reset;

  useEffect(() => {
    if (!open) return;
    reset({
      name: editing?.name ?? '',
      slug: editing?.slug ?? '',
      adminName: '',
      adminEmail: '',
      planId: editing?.planId ?? '',
      ...tenantProfileFormFromTenant(editing),
    });
    resetMutation();
  }, [open, editing, reset, resetMutation]);

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
          ...(isMobile
            ? { height: '100%', maxHeight: '100dvh' }
            : { maxWidth: DIALOG_MAX_WIDTH, maxHeight: '94dvh', overflow: 'hidden' }),
        },
      }}
    >
      <Box
        component="form"
        noValidate
        onSubmit={handleSubmit((values) => saveMutation.mutate(values))}
        sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, ...(isMobile ? { height: '100%' } : {}) }}
      >
        <DialogHeader
          onClose={onClose}
          isMobile={isMobile}
          title={editing ? 'Editar clínica' : 'Nova clínica'}
          subtitle={editing ? editing.name : 'A clínica já nasce com os grupos padrão e o primeiro administrador'}
          icon={editing ? <EditOutlinedIcon fontSize="small" /> : <StorefrontOutlinedIcon fontSize="small" />}
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
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: editing ? '1fr' : '1fr 1fr' },
              gap: 2.25,
              alignItems: 'stretch',
            }}
          >
            <FormSection title="Clínica" sx={{ height: '100%' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
                <Controller
                  name="name"
                  control={control}
                  rules={{
                    validate: (v) => v.trim().length >= 2 || 'Informe o nome da clínica',
                  }}
                  render={({ field, fieldState }) => (
                    <LabeledField label="Nome da clínica" required>
                      <TextField
                        {...field}
                        placeholder="Ex.: Clínica Bela Pele"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                        fullWidth
                        autoFocus
                      />
                    </LabeledField>
                  )}
                />
                <Controller
                  name="slug"
                  control={control}
                  rules={{
                    validate: (v) =>
                      !v.trim() || SLUG_PATTERN.test(v.trim()) || 'Use só letras minúsculas, números e hífens',
                  }}
                  render={({ field, fieldState }) => (
                    <LabeledField label="Identificador">
                      <TextField
                        {...field}
                        placeholder="clinica-bela-pele"
                        error={!!fieldState.error}
                        helperText={
                          fieldState.error?.message ??
                          (editing ? 'Único na plataforma' : 'Opcional: gerado a partir do nome se vazio')
                        }
                        fullWidth
                      />
                    </LabeledField>
                  )}
                />
                <Controller
                  name="planId"
                  control={control}
                  render={({ field }) => (
                    <LabeledField label="Plano">
                      <PlanSelect
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        inputRef={field.ref}
                        currentPlan={editing?.plan}
                        fullWidth
                        inputProps={{ 'aria-label': 'Plano' }}
                      />
                    </LabeledField>
                  )}
                />
              </Box>
            </FormSection>

            {!editing && (
              <FormSection title="Primeiro administrador" sx={{ height: '100%' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
                  <Controller
                    name="adminName"
                    control={control}
                    rules={{ validate: (v) => v.trim().length >= 2 || 'Informe o nome do administrador' }}
                    render={({ field, fieldState }) => (
                      <LabeledField label="Nome" required>
                        <TextField
                          {...field}
                          placeholder="Ex.: Ana Souza"
                          error={!!fieldState.error}
                          helperText={fieldState.error?.message}
                          fullWidth
                        />
                      </LabeledField>
                    )}
                  />
                  <Controller
                    name="adminEmail"
                    control={control}
                    rules={{ validate: (v) => EMAIL_PATTERN.test(v.trim()) || 'Informe um e-mail válido' }}
                    render={({ field, fieldState }) => (
                      <LabeledField label="E-mail (conta Google)" required>
                        <TextField
                          {...field}
                          type="email"
                          placeholder="ana@clinica.com"
                          error={!!fieldState.error}
                          helperText={fieldState.error?.message ?? 'Entra com o Google deste e-mail, no grupo Administrador'}
                          fullWidth
                          inputProps={{ inputMode: 'email', autoCapitalize: 'none' }}
                        />
                      </LabeledField>
                    )}
                  />
                </Box>
              </FormSection>
            )}

            <FormSection
              title="Especialidades"
              subtitle="Toque para incluir ou remover"
              sx={{ gridColumn: { md: '1 / -1' } }}
            >
              <Controller
                name="specialties"
                control={control}
                render={({ field }) => (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                    <FeatureModuleChipGrid aria-label="Especialidades da clínica">
                      {CLINIC_SPECIALTIES.map((key) => {
                        const selected = field.value.includes(key);
                        return (
                          <CatalogSelectChip
                            key={key}
                            label={CLINIC_SPECIALTY_LABELS[key]}
                            selected={selected}
                            onClick={() => {
                              field.onChange(
                                selected ? field.value.filter((x) => x !== key) : [...field.value, key],
                              );
                            }}
                          />
                        );
                      })}
                    </FeatureModuleChipGrid>
                    <Typography sx={{ fontSize: fontSizes.xs, color: 'text.disabled' }}>
                      {field.value.length
                        ? `${field.value.length} de ${CLINIC_SPECIALTIES.length} selecionadas`
                        : 'Nenhuma especialidade marcada'}
                    </Typography>
                  </Box>
                )}
              />
            </FormSection>

            <FormSection title="Perfil da clínica" sx={{ gridColumn: { md: '1 / -1' } }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 1.75,
                }}
              >
                <Controller
                  name="foundedAt"
                  control={control}
                  render={({ field }) => (
                    <LabeledField label="Data de inauguração">
                      <TextField {...field} type="date" fullWidth InputLabelProps={{ shrink: true }} />
                    </LabeledField>
                  )}
                />
                <Controller
                  name="legalName"
                  control={control}
                  render={({ field }) => (
                    <LabeledField label="Razão social">
                      <TextField {...field} placeholder="Nome jurídico" fullWidth />
                    </LabeledField>
                  )}
                />
                <Controller
                  name="document"
                  control={control}
                  rules={{
                    validate: (v) => {
                      const d = v.replace(/\D/g, '');
                      if (!d) return true;
                      return d.length === 14 || CNPJ_PATTERN.test(v.trim()) || 'CNPJ deve ter 14 dígitos';
                    },
                  }}
                  render={({ field, fieldState }) => (
                    <LabeledField label="CNPJ">
                      <TextField
                        {...field}
                        placeholder="00.000.000/0000-00"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                        fullWidth
                        inputProps={{ inputMode: 'numeric' }}
                      />
                    </LabeledField>
                  )}
                />
                <Controller
                  name="phone"
                  control={control}
                  render={({ field }) => (
                    <LabeledField label="Telefone">
                      <TextField {...field} placeholder="(11) 99999-9999" fullWidth inputProps={{ inputMode: 'tel' }} />
                    </LabeledField>
                  )}
                />
                <Controller
                  name="email"
                  control={control}
                  rules={{
                    validate: (v) => !v.trim() || EMAIL_PATTERN.test(v.trim()) || 'E-mail inválido',
                  }}
                  render={({ field, fieldState }) => (
                    <LabeledField label="E-mail de contato">
                      <TextField
                        {...field}
                        type="email"
                        placeholder="contato@clinica.com"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                        fullWidth
                        inputProps={{ inputMode: 'email', autoCapitalize: 'none' }}
                      />
                    </LabeledField>
                  )}
                />
                <Controller
                  name="city"
                  control={control}
                  render={({ field }) => (
                    <LabeledField label="Cidade">
                      <TextField {...field} placeholder="São Paulo" fullWidth />
                    </LabeledField>
                  )}
                />
                <Controller
                  name="state"
                  control={control}
                  rules={{
                    validate: (v) => !v.trim() || /^[A-Za-z]{2}$/.test(v.trim()) || 'UF com 2 letras',
                  }}
                  render={({ field, fieldState }) => (
                    <LabeledField label="UF">
                      <TextField
                        {...field}
                        placeholder="SP"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                        fullWidth
                        inputProps={{ maxLength: 2, style: { textTransform: 'uppercase' } }}
                      />
                    </LabeledField>
                  )}
                />
                <Box sx={{ gridColumn: { sm: '1 / -1' } }}>
                  <Controller
                    name="notes"
                    control={control}
                    render={({ field }) => (
                      <LabeledField label="Nota interna (super-admin)">
                        <TextField {...field} multiline minRows={2} placeholder="Observações visíveis só no Console da plataforma" fullWidth />
                      </LabeledField>
                    )}
                  />
                </Box>
              </Box>
            </FormSection>
          </Box>

          {saveMutation.error && (
            <Alert severity="error" variant="outlined" sx={{ mt: 2.25 }}>
              {getApiErrorMessage(saveMutation.error, 'Não foi possível salvar a clínica.')}
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ ...dialogActionsBorderSx, flexShrink: 0 }}>
          <Button onClick={onClose} type="button" disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? 'Salvando…' : editing ? 'Salvar' : 'Criar clínica'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
