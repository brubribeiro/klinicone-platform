import { useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import { useForm, Controller, type Control } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';

import { promotionsApi, CreatePromotionPayload } from '../../api/promotions';
import { useAppToast } from '../../contexts/AppToastContext';
import { getApiErrorMessage } from '../../utils/apiError';
import { DialogHeader, dialogActionsBorderSx, dialogPaperSx } from '../DialogCloseButton';
import { FieldAdornment } from '../FieldAdornment';
import { MoneyField } from '../MoneyField';
import { LabeledField } from '../LabeledField';
import { dateInputValueFromApi, dateOnlyToApiIso } from '../../utils/dateOnly';
import { proceduresApi } from '../../api/procedures';
import { packagesApi } from '../../api/packages';
import type { Promotion, Procedure, Package } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: Promotion | null;
  initialCommemorativeDate?: string;
}

type DiscountType = 'PERCENTAGE' | 'FIXED' | 'COMBO';
type ApplicableTo = 'ALL' | 'PROCEDURES' | 'PACKAGES';

interface FormValues {
  name: string;
  description: string;
  commemorativeDate: string;
  startAt: string;
  endAt: string;
  discountType: DiscountType;
  discountValue: number | '';
  applicableTo: ApplicableTo;
  procedureIds: string[];
  packageIds: string[];
  active: boolean;
}

const COMMEMORATIVE_OPTIONS = [
  'Dia Internacional da Mulher',
  'Outono',
  'Dia das Mães',
  'Dia dos Namorados',
  'Inverno',
  'Dia dos Pais',
  'Dia Internacional da Beleza',
  'Dia do Cliente',
  'Primavera',
  'Black Friday',
  'Verão',
  'Natal',
];

const DIALOG_MAX_WIDTH = 640;

function PromotionActiveToggle({ control, fullWidth = false }: { control: Control<FormValues>; fullWidth?: boolean }) {
  return (
    <Controller
      name="active"
      control={control}
      render={({ field }) => (
        <ToggleButtonGroup
          exclusive
          size="small"
          color="primary"
          fullWidth={fullWidth}
          value={field.value ? 'active' : 'inactive'}
          onChange={(_, val) => {
            if (val === 'active') field.onChange(true);
            if (val === 'inactive') field.onChange(false);
          }}
        >
          <ToggleButton value="active" sx={{ px: fullWidth ? 2 : 1.75 }}>
            Ativa
          </ToggleButton>
          <ToggleButton value="inactive" sx={{ px: fullWidth ? 2 : 1.75 }}>
            Inativa
          </ToggleButton>
        </ToggleButtonGroup>
      )}
    />
  );
}

export function PromotionFormDialog({ open, onClose, editing, initialCommemorativeDate }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));
  const queryClient = useQueryClient();
  const toast = useAppToast();

  const { data: procedures = [] } = useQuery<Procedure[]>({
    queryKey: ['procedures'],
    queryFn: () => proceduresApi.list(),
    enabled: open,
  });

  const { data: packages = [] } = useQuery<Package[]>({
    queryKey: ['packages'],
    queryFn: () => packagesApi.list(),
    enabled: open,
  });

  const { control, handleSubmit, reset, watch, setValue, getValues } = useForm<FormValues>({
    defaultValues: {
      name: '',
      description: '',
      commemorativeDate: initialCommemorativeDate ?? '',
      startAt: '',
      endAt: '',
      discountType: 'PERCENTAGE',
      discountValue: '',
      applicableTo: 'ALL',
      procedureIds: [],
      packageIds: [],
      active: true,
    },
  });

  const discountType = watch('discountType');
  const applicableTo = watch('applicableTo');
  const startAt = watch('startAt');
  const procedureIds = watch('procedureIds');
  const packageIds = watch('packageIds');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const hasPackages = (editing.packages?.length ?? 0) > 0;
      const hasProcedures = (editing.procedures?.length ?? 0) > 0;
      reset({
        name: editing.name,
        description: editing.description ?? '',
        commemorativeDate: editing.commemorativeDate ?? '',
        startAt: dateInputValueFromApi(editing.startAt),
        endAt: dateInputValueFromApi(editing.endAt),
        discountType: editing.discountType,
        discountValue: Number(editing.discountValue) > 0 ? Number(editing.discountValue) : '',
        applicableTo: hasPackages ? 'PACKAGES' : hasProcedures ? 'PROCEDURES' : 'ALL',
        procedureIds: editing.procedures?.map((p) => p.procedureId) ?? [],
        packageIds: editing.packages?.map((p) => p.packageId) ?? [],
        active: editing.active,
      });
    } else {
      reset({
        name: '',
        description: '',
        commemorativeDate: initialCommemorativeDate ?? '',
        startAt: '',
        endAt: '',
        discountType: 'PERCENTAGE',
        discountValue: '',
        applicableTo: 'ALL',
        procedureIds: [],
        packageIds: [],
        active: true,
      });
    }
  }, [open, editing, initialCommemorativeDate, reset]);

  const createMutation = useMutation({
    mutationFn: (payload: CreatePromotionPayload) => promotionsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      toast.success('Promoção criada.');
      onClose();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível criar a promoção.')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreatePromotionPayload> }) =>
      promotionsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      toast.success('Promoção atualizada.');
      onClose();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível atualizar a promoção.')),
  });

  const onSubmit = (values: FormValues) => {
    const payload: CreatePromotionPayload = {
      name: values.name,
      description: values.description || undefined,
      commemorativeDate: values.commemorativeDate || undefined,
      startAt: dateOnlyToApiIso(values.startAt),
      endAt: dateOnlyToApiIso(values.endAt),
      discountType: values.discountType,
      discountValue: Number(values.discountValue),
      active: values.active,
      procedureIds: values.applicableTo === 'PROCEDURES' ? values.procedureIds : [],
      packageIds: values.applicableTo === 'PACKAGES' ? values.packageIds : [],
    };
    if (editing) updateMutation.mutate({ id: editing.id, payload });
    else createMutation.mutate(payload);
  };

  const saving = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;
  const isCombo = discountType === 'COMBO';

  const commemorativeKnown =
    !watch('commemorativeDate') || COMMEMORATIVE_OPTIONS.includes(watch('commemorativeDate'));

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
            : { maxWidth: DIALOG_MAX_WIDTH, maxHeight: '94dvh' }),
        },
      }}
    >
      <Box
        component="form"
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
      >
        <DialogHeader
          onClose={onClose}
          isMobile={isMobile}
          title={editing ? 'Editar promoção' : 'Nova promoção'}
          subtitle="Configure uma campanha de desconto"
          subtitleWrap
          icon={editing ? <EditOutlinedIcon fontSize="small" /> : <LocalOfferOutlinedIcon fontSize="small" />}
          trailing={!isCompact ? <PromotionActiveToggle control={control} /> : undefined}
          bottom={
            isCompact ? (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block' }}>
                  Status da promoção
                </Typography>
                <PromotionActiveToggle control={control} fullWidth />
              </Box>
            ) : undefined
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
          <Stack spacing={2.5}>
            {/* Nome */}
            <Controller
              name="name"
              control={control}
              rules={{ required: 'Nome é obrigatório' }}
              render={({ field, fieldState }) => (
                <LabeledField label="Nome da campanha" required>
                  <TextField
                    {...field}
                    fullWidth
                    autoFocus={!editing}
                    placeholder="Ex.: Inverno na Pele"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                </LabeledField>
              )}
            />

            {/* Descrição */}
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <LabeledField label="Descrição">
                  <TextField {...field} fullWidth placeholder="Ex.: 20% OFF em tratamentos faciais" />
                </LabeledField>
              )}
            />

            {/* Tipo de desconto + Valor */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' }, gap: 2 }}>
              <LabeledField label="Tipo de desconto">
                <Controller
                  name="discountType"
                  control={control}
                  render={({ field }) => (
                    <ToggleButtonGroup
                      exclusive
                      fullWidth
                      color="primary"
                      value={field.value}
                      onChange={(_, val) => {
                        if (!val) return;
                        field.onChange(val);
                        // Combo é preço fechado (não percentual) e exige itens específicos
                        if (val === 'COMBO' || field.value === 'COMBO') setValue('discountValue', '');
                        if (val === 'COMBO' && getValues('applicableTo') === 'ALL') {
                          setValue('applicableTo', 'PACKAGES');
                        }
                      }}
                      sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 700 } }}
                    >
                      <ToggleButton value="PERCENTAGE">Percentual</ToggleButton>
                      <ToggleButton value="FIXED">Valor</ToggleButton>
                      <ToggleButton value="COMBO">Combo</ToggleButton>
                    </ToggleButtonGroup>
                  )}
                />
              </LabeledField>

              <LabeledField label={isCombo ? 'Preço do combo' : 'Valor'} required>
                <Controller
                  name="discountValue"
                  control={control}
                  rules={{
                    validate: (v) => {
                      if (v === '' || Number(v) <= 0) {
                        return isCombo ? 'Informe o preço do combo' : 'Informe o valor do desconto';
                      }
                      if (discountType === 'PERCENTAGE' && Number(v) > 100) return 'Máximo 100%';
                      return true;
                    },
                  }}
                  render={({ field, fieldState }) =>
                    isCombo || discountType === 'FIXED' ? (
                      <MoneyField
                        {...field}
                        fullWidth
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                      />
                    ) : (
                      <TextField
                        {...field}
                        type="number"
                        fullWidth
                        placeholder="20"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                        inputProps={{ inputMode: 'decimal', step: 1, min: 0, max: 100 }}
                        InputProps={{ endAdornment: <FieldAdornment>%</FieldAdornment> }}
                      />
                    )
                  }
                />
              </LabeledField>
            </Box>

            {/* Aplicável a */}
            <Controller
              name="applicableTo"
              control={control}
              render={({ field }) => (
                <LabeledField label="Aplicável a">
                  <TextField
                    {...field}
                    select
                    fullWidth
                    helperText={
                      isCombo
                        ? 'Combo: o valor acima é o preço final de cada procedimento ou pacote escolhido.'
                        : field.value === 'PACKAGES'
                          ? 'Desconto aplicado ao vender o pacote; as sessões não recebem desconto de novo.'
                          : 'Vale para atendimentos avulsos. Pacotes só entram com "Pacotes específicos".'
                    }
                  >
                    <MenuItem value="ALL" disabled={isCombo}>
                      Todos os procedimentos
                    </MenuItem>
                    <MenuItem value="PROCEDURES">Procedimentos específicos</MenuItem>
                    <MenuItem value="PACKAGES">Pacotes específicos</MenuItem>
                  </TextField>
                </LabeledField>
              )}
            />

            {/* Multi-select condicional */}
            {applicableTo === 'PROCEDURES' && (
              <LabeledField label="Procedimentos">
                <TextField
                  select
                  fullWidth
                  value={procedureIds}
                  onChange={(e) =>
                    setValue(
                      'procedureIds',
                      typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as unknown as string[]),
                      { shouldDirty: true },
                    )
                  }
                  SelectProps={{
                    multiple: true,
                    displayEmpty: true,
                    renderValue: (selected) => {
                      const ids = selected as string[];
                      if (ids.length === 0) return <Box component="span" sx={{ color: 'text.disabled' }}>Selecione os procedimentos</Box>;
                      return (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {ids.map((id) => (
                            <Chip key={id} size="small" label={procedures.find((p) => p.id === id)?.name ?? '—'} />
                          ))}
                        </Box>
                      );
                    },
                  }}
                >
                  {procedures.filter((p) => p.active || procedureIds.includes(p.id)).map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      <Checkbox size="small" checked={procedureIds.includes(p.id)} sx={{ py: 0, mr: 1 }} />
                      <ListItemText primary={p.name} />
                    </MenuItem>
                  ))}
                </TextField>
              </LabeledField>
            )}

            {applicableTo === 'PACKAGES' && (
              <LabeledField label="Pacotes">
                <TextField
                  select
                  fullWidth
                  value={packageIds}
                  onChange={(e) =>
                    setValue(
                      'packageIds',
                      typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as unknown as string[]),
                      { shouldDirty: true },
                    )
                  }
                  SelectProps={{
                    multiple: true,
                    displayEmpty: true,
                    renderValue: (selected) => {
                      const ids = selected as string[];
                      if (ids.length === 0) return <Box component="span" sx={{ color: 'text.disabled' }}>Selecione os pacotes</Box>;
                      return (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {ids.map((id) => (
                            <Chip key={id} size="small" label={packages.find((p) => p.id === id)?.name ?? '—'} />
                          ))}
                        </Box>
                      );
                    },
                  }}
                >
                  {packages.filter((p) => p.active || packageIds.includes(p.id)).map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      <Checkbox size="small" checked={packageIds.includes(p.id)} sx={{ py: 0, mr: 1 }} />
                      <ListItemText primary={p.name} />
                    </MenuItem>
                  ))}
                </TextField>
              </LabeledField>
            )}

            {/* Data comemorativa */}
            <Controller
              name="commemorativeDate"
              control={control}
              render={({ field }) => (
                <LabeledField label="Data comemorativa">
                  <TextField
                    {...field}
                    select
                    fullWidth
                    SelectProps={{ displayEmpty: true }}
                    helperText="Vincule para acompanhar o desempenho da campanha na data."
                  >
                    <MenuItem value="">Nenhuma</MenuItem>
                    {COMMEMORATIVE_OPTIONS.map((o) => (
                      <MenuItem key={o} value={o}>
                        {o}
                      </MenuItem>
                    ))}
                    {!commemorativeKnown && <MenuItem value={field.value}>{field.value}</MenuItem>}
                  </TextField>
                </LabeledField>
              )}
            />

            {/* Início + Fim */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <Controller
                name="startAt"
                control={control}
                rules={{ required: 'Início é obrigatório' }}
                render={({ field, fieldState }) => (
                  <LabeledField label="Início" required>
                    <TextField
                      {...field}
                      type="date"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  </LabeledField>
                )}
              />
              <Controller
                name="endAt"
                control={control}
                rules={{
                  required: 'Fim é obrigatório',
                  validate: (value) => {
                    if (!startAt || !value) return true;
                    return !dayjs(value).isBefore(dayjs(startAt), 'day') || 'Deve ser igual ou posterior ao início';
                  },
                }}
                render={({ field, fieldState }) => (
                  <LabeledField label="Fim" required>
                    <TextField
                      {...field}
                      type="date"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  </LabeledField>
                )}
              />
            </Box>

            {mutationError && (
              <Alert severity="error" variant="outlined">
                {(mutationError as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                  'Erro ao salvar promoção'}
              </Alert>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ ...dialogActionsBorderSx, flexShrink: 0 }}>
          <Button onClick={onClose} type="button" disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? 'Salvando…' : editing ? 'Salvar' : 'Salvar promoção'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
