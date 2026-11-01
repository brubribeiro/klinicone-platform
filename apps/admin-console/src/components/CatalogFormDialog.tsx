import { useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  MenuItem,
  Stack,
  TextField,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../api/admin';
import { useAppToast } from '../../../../frontend/src/contexts/AppToastContext';
import {
  CATALOG_DOCUMENT_COLORS,
  FALLBACK_MESSAGE_TRIGGERS,
  normalizeCatalogHexColor,
  PLATFORM_CATALOG_KIND_LABELS,
  PLATFORM_CATALOG_KINDS,
} from '../../../../frontend/src/features/platformCatalog';
import { getApiErrorMessage } from '../../../../frontend/src/utils/apiError';
import { DialogHeader, dialogActionsBorderSx, dialogPaperSx } from '../../../../frontend/src/components/DialogCloseButton';
import { AuroraIcon } from '../../../../frontend/src/components/AuroraIcon';
import { FormSection } from '../../../../frontend/src/components/FormSection';
import { LabeledField } from '../../../../frontend/src/components/LabeledField';
import { fontSizes } from '../../../../frontend/src/theme/fontSizes';
import type { PlatformCatalogItem, PlatformCatalogKind } from '../../../../frontend/src/types';

const DIALOG_MAX_WIDTH = 640;
const META_SECTION_MIN_HEIGHT = 132;

interface FormValues {
  kind: PlatformCatalogKind;
  value: string;
  label: string;
  sortOrder: string;
  color: string;
  defaultTrigger: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  editing: PlatformCatalogItem | null;
  defaultKind: PlatformCatalogKind;
}

function metaFromForm(kind: PlatformCatalogKind, values: FormValues): Record<string, unknown> | null {
  if (kind === 'document_category' && values.color.trim()) {
    return { color: normalizeCatalogHexColor(values.color) };
  }
  if (kind === 'message_category' && values.defaultTrigger.trim()) {
    return { defaultTrigger: values.defaultTrigger.trim() };
  }
  return null;
}

function isValidHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value.trim());
}

/** Criar ou editar item do catálogo global da plataforma. */
export function CatalogFormDialog({ open, onClose, editing, defaultKind }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const isEdit = !!editing;

  const { control, handleSubmit, reset, watch } = useForm<FormValues>({
    defaultValues: {
      kind: defaultKind,
      value: '',
      label: '',
      sortOrder: '0',
      color: CATALOG_DOCUMENT_COLORS[0],
      defaultTrigger: '',
    },
  });
  const kind = watch('kind');
  const colorValue = watch('color');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const meta = (editing.meta ?? {}) as Record<string, unknown>;
      const color =
        typeof meta.color === 'string' && meta.color.trim()
          ? normalizeCatalogHexColor(meta.color)
          : CATALOG_DOCUMENT_COLORS[0];
      reset({
        kind: editing.kind,
        value: editing.value,
        label: editing.label,
        sortOrder: String(editing.sortOrder),
        color,
        defaultTrigger: typeof meta.defaultTrigger === 'string' ? meta.defaultTrigger : '',
      });
    } else {
      reset({
        kind: defaultKind,
        value: '',
        label: '',
        sortOrder: '0',
        color: CATALOG_DOCUMENT_COLORS[0],
        defaultTrigger: '',
      });
    }
  }, [open, editing, defaultKind, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const sortOrder = Number(values.sortOrder) || 0;
      const meta = metaFromForm(values.kind, values);
      if (editing) {
        return adminApi.updateCatalogItem(editing.id, {
          value: values.value.trim(),
          label: values.label.trim(),
          sortOrder,
          meta,
        });
      }
      return adminApi.createCatalogItem({
        kind: values.kind,
        value: values.value.trim(),
        label: values.label.trim(),
        sortOrder,
        meta,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'catalogs'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      queryClient.invalidateQueries({ queryKey: ['catalogs'] });
      toast.success(isEdit ? 'Item atualizado.' : 'Item criado.');
      onClose();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível salvar o item.')),
  });

  const previewColor = isValidHexColor(colorValue) ? normalizeCatalogHexColor(colorValue) : undefined;

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
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
        sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, ...(isMobile ? { height: '100%' } : {}) }}
      >
        <DialogHeader
          onClose={onClose}
          isMobile={isMobile}
          icon={isEdit ? <EditOutlinedIcon fontSize="small" /> : <CategoryOutlinedIcon fontSize="small" />}
          title={isEdit ? 'Editar item' : 'Novo item'}
          subtitle="Catálogo global — todas as clínicas usam os mesmos valores"
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
          <Stack spacing={2.25}>
            <FormSection title="Dados do item">
              <Stack spacing={1.75}>
                <Controller
                  name="kind"
                  control={control}
                  render={({ field }) => (
                    <LabeledField label="Tipo">
                      <TextField {...field} select fullWidth disabled={isEdit} inputProps={{ 'aria-label': 'Tipo' }}>
                        {PLATFORM_CATALOG_KINDS.map((k) => (
                          <MenuItem key={k} value={k}>
                            {PLATFORM_CATALOG_KIND_LABELS[k]}
                          </MenuItem>
                        ))}
                      </TextField>
                    </LabeledField>
                  )}
                />
                <Controller
                  name="value"
                  control={control}
                  rules={{ required: 'Informe o valor' }}
                  render={({ field, fieldState }) => (
                    <LabeledField label="Valor / código" required>
                      <TextField
                        {...field}
                        fullWidth
                        autoFocus={!isEdit}
                        placeholder={
                          kind === 'procedure_category'
                            ? 'Ex.: Facial'
                            : kind === 'skincare_tag'
                              ? 'Ex.: retinoide'
                              : 'Ex.: contrato'
                        }
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message ?? 'Persistido nas entidades da clínica'}
                        inputProps={{ 'aria-label': 'Valor / código' }}
                      />
                    </LabeledField>
                  )}
                />
                <Controller
                  name="label"
                  control={control}
                  rules={{ required: 'Informe o rótulo' }}
                  render={({ field, fieldState }) => (
                    <LabeledField label="Rótulo" required>
                      <TextField
                        {...field}
                        fullWidth
                        placeholder="Ex.: Contrato"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                        inputProps={{ 'aria-label': 'Rótulo' }}
                      />
                    </LabeledField>
                  )}
                />
                <Controller
                  name="sortOrder"
                  control={control}
                  render={({ field }) => (
                    <LabeledField label="Ordem">
                      <TextField
                        {...field}
                        type="number"
                        fullWidth
                        inputProps={{ min: 0, step: 1, 'aria-label': 'Ordem' }}
                      />
                    </LabeledField>
                  )}
                />
              </Stack>
            </FormSection>

            <FormSection
              title="Opções do tipo"
              subtitle={
                kind === 'document_category'
                  ? 'Cor usada nos badges de documento'
                  : kind === 'message_category'
                    ? 'Sugestão ao enviar WhatsApp'
                    : 'Sem campos extras para este tipo'
              }
              sx={{ minHeight: META_SECTION_MIN_HEIGHT }}
            >
              {kind === 'document_category' && (
                <Controller
                  name="color"
                  control={control}
                  rules={{
                    validate: (v) => !v.trim() || isValidHexColor(v) || 'Use #RRGGBB (ex.: #15998B)',
                  }}
                  render={({ field, fieldState }) => (
                    <LabeledField label="Cor">
                      <Stack spacing={1.25}>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap role="radiogroup" aria-label="Cor sugerida">
                          {CATALOG_DOCUMENT_COLORS.map((c) => {
                            const selected = field.value.toUpperCase() === c;
                            return (
                              <ButtonBase
                                key={c}
                                role="radio"
                                aria-checked={selected}
                                aria-label={c}
                                onClick={() => field.onChange(c)}
                                sx={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: '10px',
                                  bgcolor: c,
                                  boxShadow: selected ? `0 0 0 3px ${alpha(c, 0.28)}` : 'none',
                                  transition: 'box-shadow .15s',
                                }}
                              >
                                {selected && (
                                  <Box sx={{ color: '#fff', display: 'flex' }}>
                                    <AuroraIcon name="check" size={15} strokeWidth={2.4} />
                                  </Box>
                                )}
                              </ButtonBase>
                            );
                          })}
                        </Stack>
                        <Stack direction="row" spacing={1.25} alignItems="flex-start">
                          <TextField
                            {...field}
                            size="small"
                            placeholder="#15998B"
                            error={!!fieldState.error}
                            helperText={fieldState.error?.message ?? 'Ou informe outro hex'}
                            sx={{ flex: 1 }}
                            inputProps={{ 'aria-label': 'Cor personalizada' }}
                            onBlur={(e) => {
                              field.onBlur();
                              const n = normalizeCatalogHexColor(e.target.value);
                              if (isValidHexColor(n)) field.onChange(n);
                            }}
                          />
                          <Box
                            aria-hidden
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: '12px',
                              flexShrink: 0,
                              border: '1px solid',
                              borderColor: 'divider',
                              bgcolor: previewColor ?? 'grey.100',
                              boxShadow: previewColor ? `inset 0 0 0 1px ${alpha(previewColor, 0.2)}` : undefined,
                            }}
                          />
                        </Stack>
                      </Stack>
                    </LabeledField>
                  )}
                />
              )}

              {kind === 'message_category' && (
                <Controller
                  name="defaultTrigger"
                  control={control}
                  render={({ field }) => (
                    <LabeledField label="Gatilho padrão">
                      <TextField
                        {...field}
                        select
                        fullWidth
                        SelectProps={{ displayEmpty: true }}
                        inputProps={{ 'aria-label': 'Gatilho padrão' }}
                        helperText="Opcional — preenche a sugestão ao usar modelos de mensagem"
                      >
                        <MenuItem value="">Nenhum</MenuItem>
                        {FALLBACK_MESSAGE_TRIGGERS.map((t) => (
                          <MenuItem key={t.value} value={t.value}>
                            {t.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </LabeledField>
                  )}
                />
              )}

              {kind !== 'document_category' && kind !== 'message_category' && (
                <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary' }}>
                  Este tipo só usa valor, rótulo e ordem.
                </Typography>
              )}
            </FormSection>

            {mutation.error && (
              <Alert severity="error" variant="outlined">
                {getApiErrorMessage(mutation.error, 'Não foi possível salvar o item.')}
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
