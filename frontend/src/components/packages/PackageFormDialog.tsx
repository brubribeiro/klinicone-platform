import { useEffect, useMemo } from 'react';
import { useForm, Controller, type Control } from 'react-hook-form';
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
import RedeemOutlinedIcon from '@mui/icons-material/RedeemOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { packagesApi, PackagePayload } from '../../api/packages';
import { proceduresApi } from '../../api/procedures';
import { useAppToast } from '../../contexts/AppToastContext';
import { getApiErrorMessage } from '../../utils/apiError';
import { DialogHeader, dialogActionsBorderSx, dialogFormLayoutSx, formDialogPaperSx } from '../DialogCloseButton';
import { FieldAdornment } from '../FieldAdornment';
import { MoneyField } from '../MoneyField';
import { LabeledField } from '../LabeledField';
import type { Package, PackageHighlight } from '../../types';

interface PackageFormDialogProps {
  open: boolean;
  onClose: () => void;
  pkg?: Package | null;
}

type FormValues = {
  name: string;
  type: 'COMBO' | 'SESSIONS';
  procedureIds: string[];
  sessions: number | string;
  validityDays: number | string;
  totalPrice: number | string;
  highlight: '' | PackageHighlight;
  active: boolean;
};

const empty: FormValues = {
  name: '',
  type: 'COMBO',
  procedureIds: [],
  sessions: 1,
  validityDays: '',
  totalPrice: '',
  highlight: '',
  active: true,
};

const DIALOG_MAX_WIDTH = 640;
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Campo desabilitado (calculado): visual claramente inativo, sem hover — padrão das demais modais. */
const DISABLED_FIELD_SX = {
  '& .MuiOutlinedInput-root.Mui-disabled': {
    bgcolor: 'grey.100',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
  },
  '& .MuiInputBase-input.Mui-disabled': {
    WebkitTextFillColor: (t: import('@mui/material').Theme) => t.palette.text.disabled,
    cursor: 'not-allowed',
  },
  '& .Mui-disabled .MuiInputAdornment-root .MuiTypography-root': {
    color: 'text.disabled',
  },
} as const;

const VALIDITY_OPTIONS = [
  { value: '', label: 'Sem validade' },
  { value: 30, label: '1 mês' },
  { value: 60, label: '2 meses' },
  { value: 90, label: '3 meses' },
  { value: 180, label: '6 meses' },
  { value: 365, label: '12 meses' },
];

function PackageActiveToggle({ control, fullWidth = false }: { control: Control<FormValues>; fullWidth?: boolean }) {
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
            Ativo
          </ToggleButton>
          <ToggleButton value="inactive" sx={{ px: fullWidth ? 2 : 1.75 }}>
            Inativo
          </ToggleButton>
        </ToggleButtonGroup>
      )}
    />
  );
}

export function PackageFormDialog({ open, onClose, pkg }: PackageFormDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const { control, handleSubmit, reset, watch, setValue } = useForm<FormValues>({
    defaultValues: empty,
  });

  const { data: procedures = [] } = useQuery({
    queryKey: ['procedures'],
    queryFn: () => proceduresApi.list(),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    if (pkg) {
      const ids = pkg.items?.map((it) => it.procedureId) ?? [];
      const isSessions = pkg.type === 'SESSIONS';
      reset({
        name: pkg.name,
        type: pkg.type,
        procedureIds: isSessions ? ids.slice(0, 1) : ids,
        sessions: isSessions ? pkg.items?.[0]?.quantity ?? 1 : 1,
        validityDays: pkg.validityDays ?? '',
        totalPrice: pkg.totalPrice ? Number(pkg.totalPrice) : pkg.salePrice ?? '',
        highlight: (pkg.highlight as PackageHighlight) ?? '',
        active: pkg.active,
      });
    } else {
      reset(empty);
    }
  }, [open, pkg, reset]);

  const watchedType = watch('type');
  const watchedIds = watch('procedureIds');
  const watchedSessions = watch('sessions');
  const isSessions = watchedType === 'SESSIONS';

  const selectedProcedures = useMemo(
    () => watchedIds.map((id) => procedures.find((p) => p.id === id)).filter(Boolean),
    [watchedIds, procedures],
  );

  const fullPrice = useMemo(() => {
    if (isSessions) {
      const proc = procedures.find((p) => p.id === watchedIds[0]);
      return proc ? Number(proc.price) * (Number(watchedSessions) || 0) : 0;
    }
    return selectedProcedures.reduce((sum, p) => sum + Number(p!.price), 0);
  }, [isSessions, procedures, watchedIds, watchedSessions, selectedProcedures]);

  const sessionCount = isSessions ? Number(watchedSessions) || 0 : watchedIds.length;

  const handleTypeChange = (val: 'COMBO' | 'SESSIONS') => {
    setValue('type', val);
    if (val === 'SESSIONS' && watchedIds.length > 1) {
      setValue('procedureIds', watchedIds.slice(0, 1));
    }
  };

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const ids = values.procedureIds;
      const items =
        values.type === 'SESSIONS'
          ? ids.slice(0, 1).map((id) => ({ procedureId: id, quantity: Number(values.sessions) || 1, sortOrder: 0 }))
          : ids.map((id, idx) => ({ procedureId: id, quantity: 1, sortOrder: idx }));
      const payload: PackagePayload = {
        name: values.name,
        type: values.type,
        totalPrice: values.totalPrice ? Number(values.totalPrice) : null,
        discountPercent: null,
        validityDays: values.validityDays ? Number(values.validityDays) : null,
        highlight: values.highlight || null,
        active: values.active,
        items,
      };
      return pkg ? packagesApi.update(pkg.id, payload) : packagesApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      toast.success(pkg ? 'Pacote atualizado.' : 'Pacote criado.');
      onClose();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível salvar o pacote.')),
  });

  const availableProcedures = procedures.filter((p) => p.active || watchedIds.includes(p.id));

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
          height: 'min(86dvh, 680px)',
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
          title={pkg ? 'Editar pacote' : 'Criar pacote'}
          subtitle="Combine procedimentos com preço especial"
          subtitleWrap
          icon={pkg ? <EditOutlinedIcon fontSize="small" /> : <RedeemOutlinedIcon fontSize="small" />}
          trailing={!isCompact ? <PackageActiveToggle control={control} /> : undefined}
          bottom={
            isCompact ? (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block' }}>
                  Disponível para venda
                </Typography>
                <PackageActiveToggle control={control} fullWidth />
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
            // MUI zera o padding-top quando o content segue o DialogTitle; força o espaçamento
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
                <LabeledField label="Nome do pacote" required>
                  <TextField
                    {...field}
                    fullWidth
                    autoFocus={!pkg}
                    placeholder="Ex.: Harmonização Facial"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                </LabeledField>
              )}
            />

            {/* Tipo */}
            <LabeledField label="Tipo de pacote">
              <ToggleButtonGroup
                exclusive
                fullWidth
                color="primary"
                value={watchedType}
                onChange={(_, val) => val && handleTypeChange(val)}
                sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 700, py: 1.1 } }}
              >
                <ToggleButton value="COMBO">Conjunto de procedimentos</ToggleButton>
                <ToggleButton value="SESSIONS">Sessões de um procedimento</ToggleButton>
              </ToggleButtonGroup>
            </LabeledField>

            {/* Procedimentos incluídos */}
            <Controller
              name="procedureIds"
              control={control}
              rules={{ validate: (v) => v.length > 0 || 'Selecione ao menos um procedimento' }}
              render={({ fieldState }) => (
                <LabeledField label={isSessions ? 'Procedimento' : 'Procedimentos incluídos'} required>
                  {isSessions ? (
                    <TextField
                      select
                      fullWidth
                      value={watchedIds[0] ?? ''}
                      onChange={(e) => setValue('procedureIds', e.target.value ? [e.target.value] : [], { shouldDirty: true })}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      SelectProps={{ displayEmpty: true }}
                    >
                      <MenuItem value="" disabled>
                        Selecione um procedimento
                      </MenuItem>
                      {availableProcedures.map((p) => (
                        <MenuItem key={p.id} value={p.id}>
                          {p.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  ) : (
                    <TextField
                      select
                      fullWidth
                      value={watchedIds}
                      onChange={(e) =>
                        setValue(
                          'procedureIds',
                          typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as unknown as string[]),
                          { shouldDirty: true },
                        )
                      }
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      SelectProps={{
                        multiple: true,
                        displayEmpty: true,
                        renderValue: (selected) => {
                          const ids = selected as string[];
                          if (ids.length === 0) {
                            return <Box component="span" sx={{ color: 'text.disabled' }}>Selecione os procedimentos</Box>;
                          }
                          return (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {ids.map((id) => {
                                const proc = procedures.find((p) => p.id === id);
                                return <Chip key={id} size="small" label={proc?.name ?? '—'} />;
                              })}
                            </Box>
                          );
                        },
                      }}
                    >
                      {availableProcedures.map((p) => (
                        <MenuItem key={p.id} value={p.id}>
                          <Checkbox size="small" checked={watchedIds.includes(p.id)} sx={{ py: 0, mr: 1 }} />
                          <ListItemText primary={p.name} />
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                </LabeledField>
              )}
            />

            {/* Sessões + Validade */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <LabeledField label="Nº de sessões">
                {isSessions ? (
                  <Controller
                    name="sessions"
                    control={control}
                    rules={{ min: { value: 1, message: 'Mínimo 1' } }}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        type="number"
                        fullWidth
                        inputProps={{ inputMode: 'numeric', min: 1 }}
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                      />
                    )}
                  />
                ) : (
                  <TextField
                    fullWidth
                    disabled
                    sx={DISABLED_FIELD_SX}
                    value={sessionCount ? `${sessionCount} ${sessionCount === 1 ? 'sessão' : 'sessões'}` : ''}
                    placeholder="Selecione os procedimentos"
                  />
                )}
              </LabeledField>

              <Controller
                name="validityDays"
                control={control}
                render={({ field }) => {
                  const known = VALIDITY_OPTIONS.some((o) => o.value === field.value);
                  return (
                    <LabeledField label="Validade do pacote">
                      <TextField {...field} select fullWidth>
                        {VALIDITY_OPTIONS.map((o) => (
                          <MenuItem key={String(o.value)} value={o.value}>
                            {o.label}
                          </MenuItem>
                        ))}
                        {!known && field.value !== '' && (
                          <MenuItem value={field.value}>{`${field.value} dias`}</MenuItem>
                        )}
                      </TextField>
                    </LabeledField>
                  );
                }}
              />
            </Box>

            {/* Valor cheio + Valor do pacote */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <LabeledField label="Valor cheio (R$)">
                <TextField
                  fullWidth
                  disabled
                  sx={DISABLED_FIELD_SX}
                  value={fullPrice > 0 ? brl.format(fullPrice).replace('R$', '').trim() : ''}
                  placeholder="0,00"
                  InputProps={{ startAdornment: <FieldAdornment position="start">R$</FieldAdornment> }}
                />
              </LabeledField>

              <Controller
                name="totalPrice"
                control={control}
                render={({ field }) => (
                  <LabeledField label="Valor do pacote (R$)">
                    <MoneyField {...field} fullWidth />
                  </LabeledField>
                )}
              />
            </Box>

            {/* Destaque */}
            <Controller
              name="highlight"
              control={control}
              render={({ field }) => (
                <LabeledField label="Destaque">
                  <TextField
                    {...field}
                    value={field.value || ''}
                    select
                    fullWidth
                    SelectProps={{
                      displayEmpty: true,
                      renderValue: (v) => {
                        if (v === 'BEST_SELLER') return 'Mais vendido';
                        if (v === 'RECURRING') return 'Recorrente';
                        return <Box component="span" sx={{ color: 'text.disabled' }}>Nenhum</Box>;
                      },
                    }}
                  >
                    <MenuItem value="">Nenhum</MenuItem>
                    <MenuItem value="BEST_SELLER">Mais vendido</MenuItem>
                    <MenuItem value="RECURRING">Recorrente</MenuItem>
                  </TextField>
                </LabeledField>
              )}
            />

            {mutation.isError && (
              <Alert severity="error" variant="outlined">
                {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                  'Erro ao salvar pacote'}
              </Alert>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ ...dialogActionsBorderSx, flexShrink: 0 }}>
          <Button onClick={onClose} type="button" disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            {mutation.isPending ? 'Salvando…' : pkg ? 'Salvar' : 'Salvar pacote'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
