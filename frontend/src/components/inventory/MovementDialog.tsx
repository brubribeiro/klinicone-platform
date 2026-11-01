import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
  type SxProps,
  type Theme,
} from '@mui/material';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { inventoryApi, MovementType } from '../../api/inventory';
import { useAppToast } from '../../contexts/AppToastContext';
import { getApiErrorMessage } from '../../utils/apiError';
import {
  DialogHeader,
  dialogActionsBorderSx,
  dialogContentScrollSx,
  dialogFormLayoutSx,
  formDialogPaperSx,
} from '../DialogCloseButton';
import { LabeledField } from '../LabeledField';
import { MoneyField } from '../MoneyField';
import { dateOnlyToApiIso } from '../../utils/dateOnly';
import { fontSizes } from '../../theme/fontSizes';
import { availabilityShortcutToggleSx } from '../availability/AvailabilityShortcutToggles';
import type { InventoryItem } from '../../types';

interface MovementDialogProps {
  open: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  /** Quando `item` é nulo, permite escolher o produto na própria modal. */
  items?: InventoryItem[];
}

interface FormValues {
  type: MovementType;
  quantity: number;
  totalPrice: number | '';
  reason: string;
  expiresAt: string;
}

const empty: FormValues = { type: 'IN', quantity: 1, totalPrice: '', reason: '', expiresAt: '' };

const DIALOG_MAX_WIDTH = 600;

const FIELD_STACK_GAP = 1.5;

const FIELD_HELPER_SX = {
  '& .MuiFormHelperText-root': {
    fontSize: fontSizes['2xs'],
    lineHeight: 1.35,
    mt: 0.75,
    mx: 0,
  },
} as const;

const MOVEMENT_TYPE_TOGGLE_SX: SxProps<Theme> = [
  availabilityShortcutToggleSx,
  {
    width: '100%',
    '& .MuiToggleButtonGroup-grouped': { flex: 1, py: 0.85 },
  },
];

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function MovementDialog({ open, onClose, item: fixedItem, items }: MovementDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const { control, handleSubmit, reset, watch } = useForm<FormValues>({ defaultValues: empty });
  const [pickedItem, setPickedItem] = useState<InventoryItem | null>(null);
  const item = fixedItem ?? pickedItem;
  const showPicker = !fixedItem && !!items;

  useEffect(() => {
    if (open) setPickedItem(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const defaultQty = 1;
    const cost = item?.costPrice != null ? Number(item.costPrice) : 0;
    reset({
      ...empty,
      totalPrice: cost > 0 ? Math.round(cost * defaultQty * 100) / 100 : '',
    });
  }, [open, item, reset]);

  const type = watch('type');
  const quantity = Number(watch('quantity')) || 0;
  const totalPrice = Number(watch('totalPrice')) || 0;
  const calculatedUnitPrice = type === 'IN' && quantity > 0 && totalPrice > 0 ? totalPrice / quantity : 0;
  const currentQty = Number(item?.quantity ?? 0);

  const newQuantity = !item
    ? 0
    : type === 'IN'
      ? currentQty + quantity
      : type === 'OUT'
        ? currentQty - quantity
        : quantity;

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      inventoryApi.createMovement(item!.id, {
        type: values.type,
        quantity: Number(values.quantity),
        ...(values.reason ? { reason: values.reason } : {}),
        ...(values.expiresAt
          ? { expiresAt: dateOnlyToApiIso(values.expiresAt) }
          : {}),
        ...(values.type === 'IN' && values.totalPrice !== ''
          ? { totalPrice: Number(values.totalPrice) }
          : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
      toast.success('Movimentação registrada.');
      onClose();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Não foi possível registrar a movimentação.'));
    },
  });

  if (!item && !showPicker) return null;

  const quantityHint =
    type === 'ADJUSTMENT'
      ? `O estoque ficará com ${quantity} unidades`
      : `Quantidade resultante: ${newQuantity}`;

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
          height: 'auto',
          maxHeight: '88dvh',
        }),
      }}
    >
      <Box
        component="form"
        noValidate
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
        sx={dialogFormLayoutSx(isMobile)}
      >
        <DialogHeader
          onClose={onClose}
          isMobile={isMobile}
          title="Movimentar estoque"
          subtitle={
            item
              ? `${item.name} · estoque atual: ${item.quantity}${item.unit ? ` ${item.unit}` : ''}`
              : 'Escolha o produto e registre entrada, saída ou ajuste de quantidade'
          }
          subtitleWrap
          sx={{ pb: { xs: 2, sm: 2.25 } }}
          icon={<SwapHorizOutlinedIcon fontSize="small" />}
        />
        <DialogContent
          sx={{
            ...dialogContentScrollSx,
            px: { xs: 2, sm: 3 },
            pb: { xs: 2, sm: 2.5 },
            '&.MuiDialogContent-root': { pt: { xs: 2, sm: 2.25 } },
          }}
        >
          <Stack spacing={FIELD_STACK_GAP}>
            {showPicker && (
              <LabeledField label="Produto" required>
                <Autocomplete
                  options={items}
                  getOptionLabel={(o) => (o.sku ? `${o.name} (${o.sku})` : o.name)}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  value={pickedItem}
                  onChange={(_, v) => setPickedItem(v)}
                  noOptionsText="Nenhum produto"
                  renderInput={(params) => (
                    <TextField {...params} required autoFocus inputProps={{ ...params.inputProps, 'aria-label': 'Produto' }} />
                  )}
                />
              </LabeledField>
            )}

            <LabeledField label="Tipo">
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <ToggleButtonGroup
                    {...field}
                    exclusive
                    fullWidth
                    size="small"
                    onChange={(_, val) => val && field.onChange(val)}
                    sx={MOVEMENT_TYPE_TOGGLE_SX}
                  >
                    <ToggleButton value="IN">Entrada</ToggleButton>
                    <ToggleButton value="OUT">Saída</ToggleButton>
                    <ToggleButton value="ADJUSTMENT">Ajuste</ToggleButton>
                  </ToggleButtonGroup>
                )}
              />
            </LabeledField>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: FIELD_STACK_GAP, alignItems: 'start' }}>
              <LabeledField label={type === 'ADJUSTMENT' ? 'Nova quantidade total' : 'Quantidade'} required>
                <Controller
                  name="quantity"
                  control={control}
                  rules={{
                    required: 'Informe a quantidade',
                    min: { value: 1, message: 'A quantidade mínima é 1' },
                  }}
                  render={({ field, fieldState }) => (
                    <Box>
                      <TextField
                        {...field}
                        type="number"
                        fullWidth
                        required
                        autoFocus={!showPicker}
                        inputProps={{ inputMode: 'numeric', min: 1, 'aria-label': 'Quantidade' }}
                        error={!!fieldState.error || newQuantity < 0}
                        sx={FIELD_HELPER_SX}
                      />
                      <Typography
                        sx={{
                          mt: 0.75,
                          fontSize: fontSizes['2xs'],
                          color: fieldState.error || newQuantity < 0 ? 'error.main' : 'text.secondary',
                          lineHeight: 1.35,
                        }}
                      >
                        {fieldState.error?.message ?? quantityHint}
                      </Typography>
                    </Box>
                  )}
                />
              </LabeledField>

              <LabeledField label="Motivo">
                <TextField
                  {...control.register('reason')}
                  fullWidth
                  placeholder={
                    type === 'IN'
                      ? 'Compra, devolução...'
                      : type === 'OUT'
                        ? 'Uso em procedimento, perda...'
                        : 'Inventário, correção...'
                  }
                  inputProps={{ 'aria-label': 'Motivo' }}
                />
              </LabeledField>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: FIELD_STACK_GAP,
              }}
            >
              {type === 'IN' ? (
                <>
                  <LabeledField label="Valor total da compra" required>
                    <Controller
                      name="totalPrice"
                      control={control}
                      rules={{
                        required: 'Valor total é obrigatório para entradas',
                        min: { value: 0.01, message: 'Informe um valor maior que zero' },
                      }}
                      render={({ field, fieldState }) => (
                        <Box>
                          <MoneyField
                            {...field}
                            fullWidth
                            required
                            error={!!fieldState.error}
                            inputProps={{ 'aria-label': 'Valor total da compra' }}
                            sx={FIELD_HELPER_SX}
                          />
                          <Typography
                            sx={{
                              mt: 0.75,
                              fontSize: fontSizes['2xs'],
                              color: fieldState.error ? 'error.main' : 'text.secondary',
                              lineHeight: 1.35,
                            }}
                          >
                            {fieldState.error?.message ??
                              (calculatedUnitPrice > 0
                                ? `Custo unitário: ${brl.format(calculatedUnitPrice)} · gera despesa no financeiro`
                                : 'Gera uma despesa no financeiro ao confirmar')}
                          </Typography>
                        </Box>
                      )}
                    />
                  </LabeledField>
                  <LabeledField label="Validade do lote" required>
                    <Controller
                      name="expiresAt"
                      control={control}
                      rules={{ required: 'Data de validade é obrigatória para entradas' }}
                      render={({ field, fieldState }) => (
                        <Box>
                          <TextField
                            {...field}
                            type="date"
                            fullWidth
                            required
                            InputLabelProps={{ shrink: true }}
                            error={!!fieldState.error}
                            inputProps={{ 'aria-label': 'Data de validade do lote' }}
                            sx={FIELD_HELPER_SX}
                          />
                          <Typography
                            sx={{
                              mt: 0.75,
                              fontSize: fontSizes['2xs'],
                              color: fieldState.error ? 'error.main' : 'text.secondary',
                              lineHeight: 1.35,
                            }}
                          >
                            {fieldState.error?.message ??
                              'Cada entrada pode ter validade própria'}
                          </Typography>
                        </Box>
                      )}
                    />
                  </LabeledField>
                </>
              ) : null}
            </Box>

            {newQuantity < 0 && (
              <Alert severity="error" sx={{ py: 0.75, '& .MuiAlert-message': { fontSize: fontSizes.sm } }}>
                Estoque insuficiente para essa saída.
              </Alert>
            )}
            {mutation.isError && (
              <Alert severity="error" sx={{ py: 0.75, '& .MuiAlert-message': { fontSize: fontSizes.sm } }}>
                {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                  'Erro ao registrar movimento'}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ ...dialogActionsBorderSx, flexShrink: 0 }}>
          <Button onClick={onClose} type="button" disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={
              mutation.isPending ||
              !item ||
              newQuantity < 0 ||
              (type === 'IN' && totalPrice <= 0)
            }
          >
            {mutation.isPending ? 'Salvando…' : 'Confirmar'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
