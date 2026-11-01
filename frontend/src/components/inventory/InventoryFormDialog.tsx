import { useEffect } from 'react';
import {
  Alert,
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
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { inventoryApi, InventoryItemPayload } from '../../api/inventory';
import { useAppToast } from '../../contexts/AppToastContext';
import { getApiErrorMessage } from '../../utils/apiError';
import { FormSection } from '../FormSection';
import {
  DialogHeader,
  dialogActionsBorderSx,
  dialogFormLayoutSx,
  formDialogPaperSx,
} from '../DialogCloseButton';
import { fontSizes } from '../../theme/fontSizes';
import { FieldAdornment } from '../FieldAdornment';
import { LabeledField } from '../LabeledField';
import { MoneyField } from '../MoneyField';
import type { InventoryItem } from '../../types';
import { usePlatformCatalog } from '../../hooks/usePlatformCatalog';

interface InventoryFormDialogProps {
  open: boolean;
  onClose: () => void;
  item?: InventoryItem | null;
}

interface FormValues {
  name: string;
  sku: string;
  description: string;
  minQuantity: number;
  unit: string;
  costPrice: number;
  expiryNotifyDaysBefore: string;
}

const empty: FormValues = {
  name: '',
  sku: '',
  description: '',
  minQuantity: 0,
  unit: '',
  costPrice: 0,
  expiryNotifyDaysBefore: '',
};

const DIALOG_MAX_WIDTH = 860;
const FORM_STACK_GAP = 1.5;

const TWO_COLUMNS_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
  gap: FORM_STACK_GAP,
} as const;

const COMPACT_SECTION_SX = {
  p: { xs: 1.5, sm: 1.75 },
  alignSelf: 'flex-start',
  width: '100%',
} as const;

const COMPACT_ALERT_SX = {
  py: 0.5,
  px: 1.25,
  alignItems: 'flex-start',
  '& .MuiAlert-icon': { py: 0.35, mr: 1 },
  '& .MuiAlert-message': {
    fontSize: fontSizes['2xs'],
    lineHeight: 1.35,
    py: 0.25,
  },
} as const;

export function InventoryFormDialog({ open, onClose, item }: InventoryFormDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const unitOptions = usePlatformCatalog('inventory_unit');
  const { control, handleSubmit, reset } = useForm<FormValues>({ defaultValues: empty });

  useEffect(() => {
    if (!open) return;
    if (item) {
      reset({
        name: item.name,
        sku: item.sku ?? '',
        description: item.description ?? '',
        minQuantity: item.minQuantity,
        unit: item.unit ?? '',
        costPrice: Number(item.costPrice ?? 0),
        expiryNotifyDaysBefore: item.expiryNotifyDaysBefore != null ? String(item.expiryNotifyDaysBefore) : '',
      });
    } else {
      reset(empty);
    }
  }, [open, item, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const notify = values.expiryNotifyDaysBefore ? Number(values.expiryNotifyDaysBefore) : null;
      const payload: InventoryItemPayload = {
        name: values.name,
        minQuantity: Number(values.minQuantity),
        ...(values.sku ? { sku: values.sku } : {}),
        ...(values.description ? { description: values.description } : {}),
        ...(values.unit ? { unit: values.unit } : {}),
        ...(values.costPrice ? { costPrice: Number(values.costPrice) } : {}),
        expiryNotifyDaysBefore: notify,
      };
      return item ? inventoryApi.update(item.id, payload) : inventoryApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success(item ? 'Item atualizado.' : 'Item criado.');
      onClose();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Não foi possível salvar o item.'));
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
          title={item ? 'Editar item' : 'Novo item de estoque'}
          subtitle={
            item
              ? `${item.name} · ${item.quantity} ${item.unit ?? 'un'} em estoque`
              : 'Cadastre o produto e configure estoque mínimo e custo'
          }
          icon={
            item ? <EditOutlinedIcon fontSize="small" /> : <Inventory2OutlinedIcon fontSize="small" />
          }
        />

        <DialogContent
          sx={{
            px: { xs: 2, sm: 3 },
            pb: { xs: 2, sm: 2.5 },
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            bgcolor: 'background.default',
            '&.MuiDialogContent-root': { pt: { xs: 2, sm: 2.25 } },
          }}
        >
          <Grid container spacing={FORM_STACK_GAP} alignItems="flex-start">
            <Grid item xs={12} md={6}>
              <FormSection title="Identificação" sx={COMPACT_SECTION_SX}>
                <Stack spacing={FORM_STACK_GAP}>
                  <Controller
                    name="name"
                    control={control}
                    rules={{ required: 'Nome é obrigatório' }}
                    render={({ field, fieldState }) => (
                      <LabeledField label="Nome do produto" required>
                        <TextField
                          {...field}
                          fullWidth
                          autoFocus={!item}
                          error={!!fieldState.error}
                          helperText={fieldState.error?.message}
                        />
                      </LabeledField>
                    )}
                  />
                  <Box sx={TWO_COLUMNS_SX}>
                    <Controller
                      name="sku"
                      control={control}
                      render={({ field }) => (
                        <LabeledField label="SKU / Código">
                          <TextField {...field} fullWidth />
                        </LabeledField>
                      )}
                    />
                    <Controller
                      name="unit"
                      control={control}
                      render={({ field }) => (
                        <LabeledField label="Unidade">
                          <TextField {...field} select fullWidth>
                            <MenuItem value="">
                              <em>Nenhuma</em>
                            </MenuItem>
                            {unitOptions.map((opt) => (
                              <MenuItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </MenuItem>
                            ))}
                          </TextField>
                        </LabeledField>
                      )}
                    />
                  </Box>
                  <Controller
                    name="description"
                    control={control}
                    render={({ field }) => (
                      <LabeledField label="Descrição">
                        <TextField {...field} fullWidth multiline minRows={2} maxRows={4} />
                      </LabeledField>
                    )}
                  />
                </Stack>
              </FormSection>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormSection title="Estoque e custo" sx={COMPACT_SECTION_SX}>
                <Stack spacing={FORM_STACK_GAP}>
                  <Box sx={TWO_COLUMNS_SX}>
                    <Controller
                      name="minQuantity"
                      control={control}
                      render={({ field }) => (
                        <LabeledField label="Estoque mínimo">
                          <TextField
                            {...field}
                            type="number"
                            fullWidth
                            inputProps={{ inputMode: 'numeric', min: 0, step: 1 }}
                          />
                        </LabeledField>
                      )}
                    />
                    <Controller
                      name="costPrice"
                      control={control}
                      render={({ field }) => (
                        <LabeledField label="Custo unitário">
                          <MoneyField {...field} fullWidth />
                        </LabeledField>
                      )}
                    />
                  </Box>

                  <Box>
                    <Controller
                      name="expiryNotifyDaysBefore"
                      control={control}
                      render={({ field }) => (
                        <LabeledField label="Notificar antes da validade">
                          <TextField
                            {...field}
                            type="number"
                            fullWidth
                            inputProps={{ inputMode: 'numeric', min: 1 }}
                            InputProps={{
                              endAdornment: <FieldAdornment>dias</FieldAdornment>,
                            }}
                          />
                        </LabeledField>
                      )}
                    />
                    <Typography sx={{ mt: 0.5, display: 'block', fontSize: fontSizes['2xs'], color: 'text.secondary' }}>
                      Deixe vazio para não receber alertas de validade.
                    </Typography>
                  </Box>
                </Stack>
              </FormSection>
            </Grid>

            <Grid item xs={12}>
              <Alert severity="info" sx={COMPACT_ALERT_SX}>
                {item
                  ? 'Para alterar quantidade ou lote com validade, use a movimentação de entrada.'
                  : 'O estoque inicial é zero. Após criar, registre uma entrada para adicionar quantidade.'}
              </Alert>
            </Grid>

            {mutation.isError && (
              <Grid item xs={12}>
                <Alert severity="error" variant="outlined">
                  {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data
                    ?.message ?? 'Erro ao salvar item'}
                </Alert>
              </Grid>
            )}
          </Grid>
        </DialogContent>

        <DialogActions sx={{ ...dialogActionsBorderSx, flexShrink: 0 }}>
          <Button onClick={onClose} type="button" disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            {mutation.isPending ? 'Salvando…' : item ? 'Salvar' : 'Criar item'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
