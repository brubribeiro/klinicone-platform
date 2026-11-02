import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import HandymanOutlinedIcon from '@mui/icons-material/HandymanOutlined';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { equipmentApi, EquipmentPayload } from '../../api/equipment';
import { useAppToast } from '../../contexts/AppToastContext';
import { getApiErrorMessage } from '../../utils/apiError';
import {
  DialogHeader,
  dialogActionsBorderSx,
  dialogFormLayoutSx,
  formDialogPaperSx,
} from '../DialogCloseButton';
import { FieldAdornment } from '../FieldAdornment';
import { LabeledField } from '../LabeledField';
import { MoneyField } from '../MoneyField';
import { dateInputValueFromApi, dateOnlyToApiIso } from '../../utils/dateOnly';
import type { Equipment } from '../../types';
import { fontSizes } from '../../theme/fontSizes';

interface Props {
  open: boolean;
  onClose: () => void;
  equipment?: Equipment | null;
}

type FormValues = {
  name: string;
  brand: string;
  model: string;
  serialNumber: string;
  purchaseDate: string;
  purchaseValue: number | '';
  maintenanceValue: number | '';
  maintenanceIntervalMonths: number | '';
  maintenanceNotifyDaysBefore: number | '';
  lastMaintenanceAt: string;
  scheduledMaintenanceAt: string;
  notes: string;
  active: boolean;
};

const empty: FormValues = {
  name: '',
  brand: '',
  model: '',
  serialNumber: '',
  purchaseDate: '',
  purchaseValue: '',
  maintenanceValue: '',
  maintenanceIntervalMonths: '',
  maintenanceNotifyDaysBefore: '',
  lastMaintenanceAt: '',
  scheduledMaintenanceAt: '',
  notes: '',
  active: true,
};

const DIALOG_MAX_WIDTH = 640;

const FORM_STACK_GAP = 1.5;

const TWO_COLUMNS_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
  gap: FORM_STACK_GAP,
} as const;

const NAME_STATUS_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' },
  gap: FORM_STACK_GAP,
  alignItems: 'start',
} as const;

const THREE_COLUMNS_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
  gap: FORM_STACK_GAP,
} as const;

function SectionLabel({ children }: { children: string }) {
  return (
    <Typography
      sx={{
        fontSize: fontSizes.xs,
        fontWeight: 800,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'text.disabled',
      }}
    >
      {children}
    </Typography>
  );
}

function Hint({ children }: { children: string }) {
  return (
    <Typography sx={{ display: 'block', fontSize: fontSizes['2xs'], color: 'text.secondary', lineHeight: 1.35, mt: -0.5, whiteSpace: { sm: 'nowrap' } }}>
      {children}
    </Typography>
  );
}

export function EquipmentFormDialog({ open, onClose, equipment }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const { control, handleSubmit, reset, watch } = useForm<FormValues>({ defaultValues: empty });
  const isActive = watch('active');

  useEffect(() => {
    if (!open) return;
    reset(
      equipment
        ? {
            name: equipment.name,
            brand: equipment.brand ?? '',
            model: equipment.model ?? '',
            serialNumber: equipment.serialNumber ?? '',
            purchaseDate: dateInputValueFromApi(equipment.purchaseDate),
            purchaseValue: equipment.purchaseValue ?? '',
            maintenanceValue: equipment.maintenanceValue ?? '',
            maintenanceIntervalMonths: equipment.maintenanceIntervalMonths ?? '',
            maintenanceNotifyDaysBefore: equipment.maintenanceNotifyDaysBefore ?? '',
            lastMaintenanceAt: dateInputValueFromApi(equipment.lastMaintenanceAt),
            scheduledMaintenanceAt: dateInputValueFromApi(equipment.scheduledMaintenanceAt),
            notes: equipment.notes ?? '',
            active: equipment.active,
          }
        : empty,
    );
  }, [open, equipment, reset]);

  const mutation = useMutation({
    mutationFn: (v: FormValues) => {
      const payload: EquipmentPayload = {
        name: v.name.trim(),
        ...(v.brand.trim() ? { brand: v.brand.trim() } : {}),
        ...(v.model.trim() ? { model: v.model.trim() } : {}),
        ...(v.serialNumber.trim() ? { serialNumber: v.serialNumber.trim() } : {}),
        ...(v.purchaseDate ? { purchaseDate: dateOnlyToApiIso(v.purchaseDate) } : {}),
        ...(v.purchaseValue !== '' ? { purchaseValue: Number(v.purchaseValue) } : {}),
        ...(v.maintenanceValue !== '' ? { maintenanceValue: Number(v.maintenanceValue) } : {}),
        ...(v.maintenanceIntervalMonths
          ? { maintenanceIntervalMonths: Number(v.maintenanceIntervalMonths) }
          : {}),
        ...(v.maintenanceNotifyDaysBefore !== ''
          ? { maintenanceNotifyDaysBefore: Number(v.maintenanceNotifyDaysBefore) }
          : {}),
        ...(v.lastMaintenanceAt
          ? { lastMaintenanceAt: dateOnlyToApiIso(v.lastMaintenanceAt) }
          : {}),
        ...(v.scheduledMaintenanceAt
          ? { scheduledMaintenanceAt: dateOnlyToApiIso(v.scheduledMaintenanceAt) }
          : { scheduledMaintenanceAt: undefined }),
        ...(v.notes.trim() ? { notes: v.notes.trim() } : {}),
        active: v.active,
      };
      return equipment ? equipmentApi.update(equipment.id, payload) : equipmentApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      toast.success(equipment ? 'Equipamento atualizado.' : 'Equipamento criado.');
      onClose();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Não foi possível salvar o equipamento.'));
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
          height: 'min(90dvh, 740px)',
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
          title={equipment ? 'Editar equipamento' : 'Novo equipamento'}
          subtitle={
            equipment
              ? `${equipment.name}${equipment.serialNumber ? ` · ${equipment.serialNumber}` : ''}`
              : 'Dados, aquisição e manutenção'
          }
          icon={
            equipment ? (
              <EditOutlinedIcon fontSize="small" />
            ) : (
              <HandymanOutlinedIcon fontSize="small" />
            )
          }
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
                  <LabeledField label="Nome do equipamento" required>
                    <TextField
                      {...field}
                      fullWidth
                      autoFocus={!equipment}
                      placeholder="Ex.: Laser CO2 Fracionado"
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
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
                      helperText={!isActive ? 'Oculto nas listagens do dia a dia.' : undefined}
                    >
                      <MenuItem value="active">Operacional</MenuItem>
                      <MenuItem value="inactive">Inativo</MenuItem>
                    </TextField>
                  </LabeledField>
                )}
              />
            </Box>

            <Box sx={THREE_COLUMNS_SX}>
              <Controller
                name="brand"
                control={control}
                render={({ field }) => (
                  <LabeledField label="Marca">
                    <TextField {...field} fullWidth placeholder="Ex.: Lumenis" />
                  </LabeledField>
                )}
              />
              <Controller
                name="model"
                control={control}
                render={({ field }) => (
                  <LabeledField label="Modelo">
                    <TextField {...field} fullWidth placeholder="Ex.: UltraPulse" />
                  </LabeledField>
                )}
              />
              <Controller
                name="serialNumber"
                control={control}
                render={({ field }) => (
                  <LabeledField label="Nº de série">
                    <TextField {...field} fullWidth placeholder="Ex.: EQ-0042" />
                  </LabeledField>
                )}
              />
            </Box>

            <SectionLabel>Aquisição</SectionLabel>
            <Box sx={TWO_COLUMNS_SX}>
              <Controller
                name="purchaseDate"
                control={control}
                render={({ field }) => (
                  <LabeledField label="Data de aquisição">
                    <TextField {...field} fullWidth type="date" />
                  </LabeledField>
                )}
              />
              <Controller
                name="purchaseValue"
                control={control}
                render={({ field }) => (
                  <LabeledField label="Valor da máquina">
                    <MoneyField {...field} fullWidth />
                  </LabeledField>
                )}
              />
            </Box>

            <SectionLabel>Manutenção</SectionLabel>
            <Box sx={TWO_COLUMNS_SX}>
              <Controller
                name="lastMaintenanceAt"
                control={control}
                render={({ field }) => (
                  <LabeledField label="Última manutenção">
                    <TextField {...field} fullWidth type="date" />
                  </LabeledField>
                )}
              />
              <Controller
                name="scheduledMaintenanceAt"
                control={control}
                render={({ field }) => (
                  <LabeledField label="Próxima (agendada)">
                    <TextField {...field} fullWidth type="date" />
                  </LabeledField>
                )}
              />
            </Box>

            <Box sx={THREE_COLUMNS_SX}>
              <Controller
                name="maintenanceIntervalMonths"
                control={control}
                render={({ field }) => (
                  <LabeledField label="Periodicidade">
                    <TextField
                      {...field}
                      type="number"
                      fullWidth
                      InputProps={{ endAdornment: <FieldAdornment>meses</FieldAdornment> }}
                      inputProps={{ inputMode: 'numeric', min: 1 }}
                    />
                  </LabeledField>
                )}
              />
              <Controller
                name="maintenanceNotifyDaysBefore"
                control={control}
                render={({ field }) => (
                  <LabeledField label="Notificar antes">
                    <TextField
                      {...field}
                      type="number"
                      fullWidth
                      InputProps={{ endAdornment: <FieldAdornment>dias</FieldAdornment> }}
                      inputProps={{ inputMode: 'numeric', min: 0 }}
                    />
                  </LabeledField>
                )}
              />
              <Controller
                name="maintenanceValue"
                control={control}
                render={({ field }) => (
                  <LabeledField label="Valor da manutenção">
                    <MoneyField {...field} fullWidth />
                  </LabeledField>
                )}
              />
            </Box>
            <Hint>Manutenção agendada gera despesa; a periodicidade calcula a próxima data.</Hint>

            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <LabeledField label="Observações">
                  <TextField
                    {...field}
                    fullWidth
                    multiline
                    minRows={1}
                    maxRows={4}
                    placeholder="Fornecedor de assistência, contrato, notas de uso..."
                  />
                </LabeledField>
              )}
            />

            {mutation.isError && (
              <Alert severity="error" variant="outlined">
                {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data
                  ?.message ?? 'Erro ao salvar equipamento'}
              </Alert>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ ...dialogActionsBorderSx, flexShrink: 0 }}>
          <Button onClick={onClose} type="button" disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            {mutation.isPending ? 'Salvando…' : equipment ? 'Salvar' : 'Criar equipamento'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
