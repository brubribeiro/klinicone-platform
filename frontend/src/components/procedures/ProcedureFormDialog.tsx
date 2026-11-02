import { useEffect } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SpaOutlinedIcon from '@mui/icons-material/SpaOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { proceduresApi, ProcedurePayload } from '../../api/procedures';
import { FieldAdornment } from '../FieldAdornment';
import { LabeledField } from '../LabeledField';
import { MoneyField } from '../MoneyField';
import { FormSection } from '../FormSection';
import { inventoryApi } from '../../api/inventory';
import { equipmentApi } from '../../api/equipment';
import { recurringExpensesApi } from '../../api/recurring-expenses';
import { useAppToast } from '../../contexts/AppToastContext';
import { getApiErrorMessage } from '../../utils/apiError';
import {
  DialogHeader,
  dialogActionsBorderSx,
  dialogFormLayoutSx,
  formDialogPaperSx,
} from '../DialogCloseButton';
import { ListTableHeader } from '../ListTableHeader';
import { ProcedureCostSummary } from './ProcedureCostSummary';
import { ProcedureToggleCard } from './ProcedureToggleCard';
import type { Procedure } from '../../types';
import { fontSizes } from '../../theme/fontSizes';
import { usePlatformCatalog } from '../../hooks/usePlatformCatalog';

interface ProcedureFormDialogProps {
  open: boolean;
  onClose: () => void;
  procedure?: Procedure | null;
}

type MaterialRow = { itemId: string; quantity: number };
type EquipmentRow = { equipmentId: string; costPerUse: number | string };

type FormValues = {
  name: string;
  description: string;
  category: string;
  durationMinutes: number;
  price: number;
  active: boolean;
  applicationMap: boolean;
  recurrenceDays: number | string;
  materials: MaterialRow[];
  equipments: EquipmentRow[];
};

const empty: FormValues = {
  name: '',
  description: '',
  category: '',
  durationMinutes: 60,
  price: 0,
  active: true,
  applicationMap: false,
  recurrenceDays: '',
  materials: [],
  equipments: [],
};

const DIALOG_MAX_WIDTH = 1140;

/** Botão contornado neutro (borda cinza, fundo branco). */
const NEUTRAL_OUTLINED_SX = {
  bgcolor: 'background.paper',
  borderColor: 'divider',
  color: 'text.primary',
  '&:hover': { bgcolor: 'grey.50', borderColor: 'divider' },
} as const;

/** Cabeçalho das mini-tabelas de materiais e equipamentos. */
const MINI_TABLE_HEADER_SX = { gap: 1, px: 1.5, py: 1, fontWeight: 800, letterSpacing: '0.04em' } as const;

const MATERIAL_COLUMNS = '1fr 96px 92px 34px';
const EQUIPMENT_COLUMNS = '1fr 120px 34px';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function ProcedureFormDialog({ open, onClose, procedure }: ProcedureFormDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const categorySuggestions = usePlatformCatalog('procedure_category');
  const isEditing = !!procedure;
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const { control, handleSubmit, reset, watch } = useForm<FormValues>({ defaultValues: empty });
  const { fields, append, remove } = useFieldArray({ control, name: 'materials' });
  const { fields: equipFields, append: appendEquip, remove: removeEquip } = useFieldArray({
    control,
    name: 'equipments',
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => inventoryApi.list(),
    enabled: open,
  });

  const { data: equipmentList = [] } = useQuery({
    queryKey: ['equipment'],
    queryFn: () => equipmentApi.list(),
    enabled: open,
  });

  const { data: hourlySummary } = useQuery({
    queryKey: ['hourly-cost-summary'],
    queryFn: () => recurringExpensesApi.getHourlyCostSummary(false),
    enabled: open,
  });
  const hourlyCost = hourlySummary?.hourlyCost ?? 0;

  useEffect(() => {
    if (!open) return;
    reset(
      procedure
        ? {
            name: procedure.name,
            description: procedure.description ?? '',
            category: procedure.category ?? '',
            durationMinutes: procedure.durationMinutes,
            price: Number(procedure.price),
            active: procedure.active,
            applicationMap: procedure.applicationMap ?? false,
            recurrenceDays: procedure.recurrenceDays ?? '',
            materials:
              procedure.materials?.map((m) => ({
                itemId: m.itemId,
                quantity: m.quantity,
              })) ?? [],
            equipments:
              procedure.equipments?.map((e) => ({
                equipmentId: e.equipmentId,
                costPerUse: Number(e.costPerUse),
              })) ?? [],
          }
        : empty,
    );
  }, [open, procedure, reset]);

  const watchedMaterials = watch('materials');
  const watchedPrice = Number(watch('price')) || 0;
  const watchedDuration = Number(watch('durationMinutes')) || 0;

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: ProcedurePayload = {
        name: values.name,
        durationMinutes: Number(values.durationMinutes),
        price: Number(values.price),
        active: values.active,
        recurrenceDays: values.recurrenceDays ? Number(values.recurrenceDays) : null,
        applicationMap: values.applicationMap,
        ...(values.description ? { description: values.description } : {}),
        ...(values.category?.trim() ? { category: values.category.trim() } : {}),
        materials: values.materials
          .filter((m) => m.itemId && Number(m.quantity) > 0)
          .map((m) => ({ itemId: m.itemId, quantity: Number(m.quantity) })),
        equipments: values.equipments
          .filter((e) => e.equipmentId)
          .map((e) => ({ equipmentId: e.equipmentId, costPerUse: Number(e.costPerUse) || 0 })),
      };
      return procedure
        ? proceduresApi.update(procedure.id, payload)
        : proceduresApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procedures'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success(procedure ? 'Procedimento atualizado.' : 'Procedimento criado.');
      onClose();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Não foi possível salvar o procedimento.'));
    },
  });

  const usedIds = new Set(watchedMaterials.map((m) => m.itemId).filter(Boolean));

  const hasStockWarning = fields.length > 0 && watchedMaterials.some((m) => {
    const item = inventory.find((i) => i.id === m.itemId);
    return item && Number(m.quantity) > item.quantity;
  });

  // Custo de material + equipamento + despesa fixa (custo/hora × duração) → margem
  const watchedEquipments = watch('equipments');
  const materialCost = watchedMaterials.reduce((sum, m) => {
    const item = inventory.find((i) => i.id === m.itemId);
    const unit = item?.costPrice != null ? Number(item.costPrice) : 0;
    return sum + unit * Number(m.quantity || 0);
  }, 0);
  const equipmentCost = watchedEquipments.reduce(
    (sum, e) => sum + (Number(e.costPerUse) || 0),
    0,
  );
  const fixedCostShare = hourlyCost * (watchedDuration / 60);
  const totalCost = materialCost + equipmentCost + fixedCostShare;
  const marginValue = watchedPrice - totalCost;
  const marginPct = watchedPrice > 0 ? (marginValue / watchedPrice) * 100 : 0;

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
          height: 'min(86dvh, 820px)',
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
          title={isEditing ? 'Editar procedimento' : 'Novo procedimento'}
          subtitle="Cadastre um item no catálogo"
          subtitleWrap
          icon={<SpaOutlinedIcon fontSize="small" />}
        />

        <DialogContent
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            p: { xs: 2, sm: 3 },
            bgcolor: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
            '&.MuiDialogContent-root': {
              paddingTop: { xs: 2, sm: 3 },
            },
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '2fr 3fr' },
              gap: 2,
              alignItems: 'stretch',
            }}
          >
            {/* ─── Coluna esquerda: informações ─── */}
            <FormSection title="Informações do procedimento" sx={{ height: '100%' }}>
            <Stack spacing={1.75}>

              <Controller
                name="name"
                control={control}
                rules={{ required: 'Nome é obrigatório' }}
                render={({ field, fieldState }) => (
                  <LabeledField label="Nome do procedimento" required>
                    <TextField
                      {...field}
                      fullWidth
                      size="small"
                      placeholder="Ex.: Toxina Botulínica"
                      autoFocus={!procedure}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  </LabeledField>
                )}
              />

              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <LabeledField label="Categoria">
                    <TextField
                      {...field}
                      fullWidth
                      size="small"
                      placeholder="Ex.: Facial, Injetáveis, Laser..."
                      inputProps={{ list: 'procedure-category-list' }}
                    />
                  </LabeledField>
                )}
              />
              <datalist id="procedure-category-list">
                {categorySuggestions.map((c) => (
                  <option key={c.value} value={c.value} />
                ))}
              </datalist>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.75 }}>
                <Controller
                  name="durationMinutes"
                  control={control}
                  rules={{
                    required: 'Informe a duração',
                    min: { value: 5, message: 'Mínimo de 5 minutos' },
                  }}
                  render={({ field, fieldState }) => (
                    <LabeledField label="Duração" required>
                      <TextField
                        {...field}
                        type="number"
                        fullWidth
                        size="small"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                        inputProps={{ inputMode: 'numeric', min: 5 }}
                        InputProps={{ endAdornment: <FieldAdornment>min</FieldAdornment> }}
                      />
                    </LabeledField>
                  )}
                />
                <Controller
                  name="recurrenceDays"
                  control={control}
                  render={({ field }) => (
                    <LabeledField label="Retorno em (dias)">
                      <TextField
                        {...field}
                        type="number"
                        fullWidth
                        size="small"
                        placeholder="Opcional"
                        inputProps={{ inputMode: 'numeric', min: 0 }}
                        InputProps={{ endAdornment: <FieldAdornment>dias</FieldAdornment> }}
                      />
                    </LabeledField>
                  )}
                />
              </Box>

              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <LabeledField label="Descrição">
                    <TextField
                      {...field}
                      fullWidth
                      multiline
                      minRows={4}
                      placeholder="Detalhes do procedimento, cuidados e indicações"
                    />
                  </LabeledField>
                )}
              />

              <Controller
                name="active"
                control={control}
                render={({ field }) => (
                  <ProcedureToggleCard
                    icon={<ScheduleOutlinedIcon sx={{ fontSize: 18 }} />}
                    title="Disponível para agendamento"
                    subtitle={field.value ? 'Visível na agenda e nos pacotes' : 'Oculto até reativar'}
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />

              <Controller
                name="applicationMap"
                control={control}
                render={({ field }) => (
                  <ProcedureToggleCard
                    icon={<SpaOutlinedIcon sx={{ fontSize: 18 }} />}
                    title="Mapa de aplicação"
                    subtitle="Habilita marcação de pontos no atendimento"
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </Stack>
            </FormSection>

            {/* ─── Coluna direita: materiais + valor + custo ─── */}
            <FormSection
              title="Materiais e equipamentos"
              subtitle="Compõe o custo de cada atendimento"
              sx={{ height: '100%' }}
              action={
                <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => append({ itemId: '', quantity: 1 })}
                    sx={NEUTRAL_OUTLINED_SX}
                  >
                    Material
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => appendEquip({ equipmentId: '', costPerUse: 0 })}
                    sx={NEUTRAL_OUTLINED_SX}
                  >
                    Equip.
                  </Button>
                </Stack>
              }
            >
              <Stack spacing={1.5} sx={{ flex: 1, minHeight: 0 }}>
              <Box sx={{ border: 1, borderColor: 'divider', borderRadius: '13px', overflow: 'hidden' }}>
                <ListTableHeader columns={MATERIAL_COLUMNS} sx={MINI_TABLE_HEADER_SX}>
                  <span>Item</span>
                  <span>Qtd.</span>
                  <span>Custo</span>
                  <span />
                </ListTableHeader>

                {fields.length === 0 ? (
                  <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
                    <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary' }}>
                      Nenhum material vinculado.
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ maxHeight: 260, overflowY: 'auto' }}>
                    {fields.map((field, index) => {
                      const currentItemId = watchedMaterials[index]?.itemId;
                      const currentQty = Number(watchedMaterials[index]?.quantity ?? 0);
                      const selectedItem = inventory.find((i) => i.id === currentItemId);
                      const availableItems = inventory.filter(
                        (i) => i.id === currentItemId || !usedIds.has(i.id),
                      );
                      const insufficient =
                        selectedItem && currentQty > 0 && selectedItem.quantity < currentQty;
                      const lineCost =
                        selectedItem?.costPrice != null ? Number(selectedItem.costPrice) * currentQty : 0;
                      return (
                        <Box
                          key={field.id}
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: MATERIAL_COLUMNS,
                            gap: 1,
                            px: 1.5,
                            py: 1,
                            alignItems: 'center',
                            borderBottom: 1,
                            borderColor: 'divider',
                            '&:last-of-type': { borderBottom: 0 },
                          }}
                        >
                          <Controller
                            name={`materials.${index}.itemId` as const}
                            control={control}
                            rules={{ required: 'Selecione o material' }}
                            render={({ field: f, fieldState }) => (
                              <Autocomplete
                                size="small"
                                sx={{ minWidth: 0 }}
                                options={availableItems}
                                getOptionLabel={(i) => `${i.name}${i.unit ? ` (${i.unit})` : ''}`}
                                value={availableItems.find((i) => i.id === f.value) ?? null}
                                onChange={(_, val) => f.onChange(val?.id ?? '')}
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    placeholder="Selecionar"
                                    size="small"
                                    error={!!fieldState.error}
                                  />
                                )}
                              />
                            )}
                          />
                          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
                            <Controller
                              name={`materials.${index}.quantity` as const}
                              control={control}
                              rules={{ required: 'Informe a quantidade', min: { value: 1, message: 'Mínimo 1' } }}
                              render={({ field: f, fieldState }) => (
                                <TextField
                                  {...f}
                                  type="number"
                                  size="small"
                                  inputProps={{ inputMode: 'numeric', min: 1, style: { textAlign: 'center' } }}
                                  error={insufficient || !!fieldState.error}
                                  sx={{ width: 56 }}
                                />
                              )}
                            />
                            {selectedItem?.unit && (
                              <Typography sx={{ fontSize: fontSizes['2xs'], color: 'text.disabled', fontWeight: 600 }} noWrap>
                                {selectedItem.unit}
                              </Typography>
                            )}
                          </Stack>
                          <Typography sx={{ fontSize: fontSizes.xs, fontWeight: 700 }} noWrap>
                            {lineCost > 0 ? brl.format(lineCost) : '—'}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => remove(index)}
                            aria-label="Remover material"
                            sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}
                          >
                            <DeleteOutlineIcon sx={{ fontSize: 17 }} />
                          </IconButton>
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Box>

              {equipFields.length > 0 && (
                <Box sx={{ border: 1, borderColor: 'divider', borderRadius: '13px', overflow: 'hidden' }}>
                  <ListTableHeader columns={EQUIPMENT_COLUMNS} sx={MINI_TABLE_HEADER_SX}>
                    <span>Equipamento</span>
                    <span>Custo / uso</span>
                    <span />
                  </ListTableHeader>
                  <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
                    {equipFields.map((field, index) => (
                      <Box
                        key={field.id}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: EQUIPMENT_COLUMNS,
                          gap: 1,
                          px: 1.5,
                          py: 1,
                          alignItems: 'center',
                          borderBottom: 1,
                          borderColor: 'divider',
                          '&:last-of-type': { borderBottom: 0 },
                        }}
                      >
                        <Controller
                          name={`equipments.${index}.equipmentId` as const}
                          control={control}
                          rules={{ required: 'Selecione o equipamento' }}
                          render={({ field: f, fieldState }) => (
                            <Autocomplete
                              size="small"
                              sx={{ minWidth: 0 }}
                              options={equipmentList}
                              getOptionLabel={(e) => e.name}
                              value={equipmentList.find((e) => e.id === f.value) ?? null}
                              onChange={(_, val) => f.onChange(val?.id ?? '')}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  placeholder="Selecionar"
                                  size="small"
                                  error={!!fieldState.error}
                                />
                              )}
                            />
                          )}
                        />
                        <Controller
                          name={`equipments.${index}.costPerUse` as const}
                          control={control}
                          render={({ field: f }) => (
                            <MoneyField {...f} size="small" />
                          )}
                        />
                        <IconButton
                          size="small"
                          onClick={() => removeEquip(index)}
                          aria-label="Remover equipamento"
                          sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}
                        >
                          <DeleteOutlineIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}

              {hasStockWarning && (
                <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ py: 0.25 }}>
                  Algum material está acima do estoque atual.
                </Alert>
              )}

              <Controller
                name="price"
                control={control}
                rules={{ required: 'Informe o valor de venda' }}
                render={({ field, fieldState }) => (
                  <LabeledField label="Valor de venda (R$)" required>
                    <MoneyField
                      {...field}
                      fullWidth
                      size="small"
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  </LabeledField>
                )}
              />

              <ProcedureCostSummary
                materialCost={materialCost}
                equipmentCost={equipmentCost}
                fixedCostShare={fixedCostShare}
                durationMinutes={watchedDuration}
                totalCost={totalCost}
                marginValue={marginValue}
                marginPct={marginPct}
              />
              </Stack>
            </FormSection>
          </Box>

          {mutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data
                ?.message ?? 'Erro ao salvar procedimento'}
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ ...dialogActionsBorderSx, flexShrink: 0, gap: 1 }}>
          <Button
            onClick={onClose}
            type="button"
            variant="outlined"
            sx={{ ...NEUTRAL_OUTLINED_SX, color: 'text.secondary' }}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={mutation.isPending}
            sx={{ boxShadow: (t) => `0 6px 16px -6px ${t.palette.primary.main}` }}
          >
            {mutation.isPending ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Salvar procedimento'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
