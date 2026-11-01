import { useEffect, useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PaymentIcon from '@mui/icons-material/Payment';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { paymentMethodsApi, CreatePaymentMethodPayload } from '../../api/paymentMethods';
import { useAppToast } from '../../contexts/AppToastContext';
import { getApiErrorMessage } from '../../utils/apiError';
import { DialogHeader, dialogActionsBorderSx, dialogFormLayoutSx, formDialogPaperSx } from '../DialogCloseButton';
import { FieldAdornment } from '../FieldAdornment';
import { LabeledField } from '../LabeledField';
import type { PaymentMethodEntry, PaymentMethodKind } from '../../types';
import { fontSizes } from '../../theme/fontSizes';
import { PAYMENT_METHOD_KIND_OPTIONS, settlementDaysLabel } from '../../utils/paymentMethodMeta';

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: PaymentMethodEntry | null;
}

interface FormValues {
  name: string;
  kind: PaymentMethodKind;
  settlementDays: number | '';
  feePercent: number | '';
  active: boolean;
}

const DIALOG_MAX_WIDTH = 600;
const FORM_STACK_GAP = 1.5;

const NAME_STATUS_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' },
  gap: FORM_STACK_GAP,
} as const;

const TWO_COLUMNS_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
  gap: FORM_STACK_GAP,
} as const;

function Hint({ children }: { children: string }) {
  return (
    <Typography sx={{ display: 'block', fontSize: fontSizes['2xs'], color: 'text.secondary', lineHeight: 1.35 }}>
      {children}
    </Typography>
  );
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function PaymentMethodFormDialog({ open, onClose, editing }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const toast = useAppToast();

  const { control, handleSubmit, reset, watch } = useForm<FormValues>({
    defaultValues: { name: '', kind: 'OTHER', settlementDays: 0, feePercent: '', active: true },
  });

  const watchedFee = watch('feePercent');
  const watchedSettlement = watch('settlementDays');
  const isActive = watch('active');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      reset({
        name: editing.name,
        kind: editing.kind ?? 'OTHER',
        settlementDays: editing.settlementDays ?? 0,
        feePercent: Number(editing.feePercent),
        active: editing.active,
      });
    } else {
      reset({ name: '', kind: 'OTHER', settlementDays: 0, feePercent: '', active: true });
    }
  }, [open, editing, reset]);

  const createMutation = useMutation({
    mutationFn: (payload: CreatePaymentMethodPayload) => paymentMethodsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      toast.success('Forma de pagamento criada.');
      onClose();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Não foi possível criar a forma de pagamento.'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreatePaymentMethodPayload> }) =>
      paymentMethodsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      toast.success('Forma de pagamento atualizada.');
      onClose();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Não foi possível atualizar a forma de pagamento.'));
    },
  });

  const onSubmit = (values: FormValues) => {
    const payload: CreatePaymentMethodPayload = {
      name: values.name.trim(),
      kind: values.kind,
      settlementDays: values.settlementDays === '' ? 0 : Number(values.settlementDays),
      feePercent: values.feePercent === '' ? 0 : Number(values.feePercent),
      active: values.active,
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  const feePreview = useMemo(() => {
    const fee = watchedFee === '' ? 0 : Number(watchedFee);
    if (Number.isNaN(fee) || fee < 0 || fee > 100) return null;

    const amount = 100;
    return {
      fee,
      feeLabel: `${fee.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`,
      amount,
      net: amount * (1 - fee / 100),
    };
  }, [watchedFee]);

  const usageCount = editing?._count?.financialEntries ?? 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: formDialogPaperSx(isMobile, { maxWidth: DIALOG_MAX_WIDTH, height: 'auto', maxHeight: '88dvh' }),
      }}
    >
      <Box
        component="form"
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        sx={dialogFormLayoutSx(isMobile)}
      >
        <DialogHeader
          onClose={onClose}
          isMobile={isMobile}
          title={editing ? 'Editar forma de pagamento' : 'Nova forma de pagamento'}
          subtitle={
            editing
              ? `${editing.name}${usageCount > 0 ? ` · ${usageCount} lançamento(s)` : ''}`
              : 'Nome, taxa da maquininha e disponibilidade no financeiro'
          }
          icon={editing ? <EditOutlinedIcon fontSize="small" /> : <PaymentIcon fontSize="small" />}
        />

        <DialogContent
          sx={{
            px: { xs: 2, sm: 3 },
            pb: { xs: 2, sm: 2.5 },
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            bgcolor: 'background.paper',
            '&.MuiDialogContent-root': { pt: { xs: 2.75, sm: 3 } },
          }}
        >
          <Stack spacing={FORM_STACK_GAP}>
            <Box sx={NAME_STATUS_SX}>
              <Controller
                name="name"
                control={control}
                rules={{ required: 'Nome é obrigatório' }}
                render={({ field, fieldState }) => (
                  <LabeledField label="Nome da forma de pagamento" required>
                    <TextField
                      {...field}
                      placeholder="Ex.: Crédito à vista"
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      fullWidth
                      autoFocus={!editing}
                    />
                    {!fieldState.error && <Hint>Como aparece na seleção de pagamentos</Hint>}
                  </LabeledField>
                )}
              />
              <Controller
                name="active"
                control={control}
                render={({ field }) => (
                  <LabeledField label="Status">
                    <TextField
                      select
                      fullWidth
                      value={field.value ? 'active' : 'inactive'}
                      onChange={(e) => field.onChange(e.target.value === 'active')}
                    >
                      <MenuItem value="active">Ativa</MenuItem>
                      <MenuItem value="inactive">Inativa</MenuItem>
                    </TextField>
                    <Hint>{isActive ? 'Disponível nos lançamentos' : 'Oculta nos lançamentos'}</Hint>
                  </LabeledField>
                )}
              />
            </Box>

            <Box sx={TWO_COLUMNS_SX}>
              <Controller
                name="kind"
                control={control}
                render={({ field }) => (
                  <LabeledField label="Tipo">
                    <TextField {...field} select fullWidth>
                      {PAYMENT_METHOD_KIND_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Hint>Débito/crédito habilitam bandeira e NSU nos lançamentos</Hint>
                  </LabeledField>
                )}
              />
              <Controller
                name="settlementDays"
                control={control}
                rules={{
                  min: { value: 0, message: 'Não pode ser negativo' },
                  max: { value: 365, message: 'Máximo 365 dias' },
                }}
                render={({ field, fieldState }) => (
                  <LabeledField label="Prazo de recebimento (dias)">
                    <TextField
                      {...field}
                      type="number"
                      fullWidth
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      inputProps={{ min: 0, max: 365, step: 1 }}
                    />
                    {!fieldState.error && (
                      <Hint>
                        {settlementDaysLabel(
                          watchedSettlement === '' ? 0 : Number(watchedSettlement),
                        )}
                      </Hint>
                    )}
                  </LabeledField>
                )}
              />
            </Box>

            <Box sx={TWO_COLUMNS_SX}>
              <Controller
                name="feePercent"
                control={control}
                rules={{
                  min: { value: 0, message: 'Não pode ser negativo' },
                  max: { value: 100, message: 'Máximo 100%' },
                }}
                render={({ field, fieldState }) => (
                  <LabeledField label="Taxa da maquininha">
                    <TextField
                      {...field}
                      type="number"
                      placeholder="0"
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      fullWidth
                      inputProps={{ inputMode: 'decimal', step: 0.01, min: 0, max: 100 }}
                      InputProps={{
                        endAdornment: <FieldAdornment>%</FieldAdornment>,
                      }}
                    />
                    {!fieldState.error && <Hint>Descontada dos lançamentos financeiros</Hint>}
                  </LabeledField>
                )}
              />

              {feePreview && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    gap: 1.5,
                    px: 1.75,
                    py: 1.25,
                    borderRadius: '12px',
                    border: 1,
                    borderColor: 'divider',
                    bgcolor: 'grey.50',
                    alignSelf: 'flex-end',
                  }}
                >
                  <Box sx={{ lineHeight: 1 }}>
                    <Typography
                      sx={{
                        fontSize: fontSizes['4xl'],
                        fontWeight: 800,
                        letterSpacing: '-0.5px',
                        lineHeight: 1,
                        color: feePreview.fee === 0 ? 'success.main' : 'text.primary',
                      }}
                    >
                      {feePreview.feeLabel}
                    </Typography>
                    <Typography sx={{ fontSize: fontSizes['2xs'], color: 'text.secondary', fontWeight: 600, mt: 0.6 }}>
                      taxa
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right', lineHeight: 1.2 }}>
                    <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 700 }}>
                      {brl.format(feePreview.net)}
                    </Typography>
                    <Typography sx={{ fontSize: fontSizes['2xs'], color: 'text.secondary', fontWeight: 600 }}>
                      líquido a cada {brl.format(feePreview.amount)}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          </Stack>

          {mutationError && (
            <Alert severity="error" variant="outlined" sx={{ mt: 1.5 }}>
              {(mutationError as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                'Erro ao salvar forma de pagamento'}
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ ...dialogActionsBorderSx, flexShrink: 0 }}>
          <Button onClick={onClose} type="button" disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? 'Salvando…' : editing ? 'Salvar' : 'Criar forma de pagamento'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
