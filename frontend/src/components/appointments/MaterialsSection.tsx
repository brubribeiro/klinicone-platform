import { useMemo, type Dispatch, type SetStateAction } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { fontSizes } from '../../theme/fontSizes';
import type { Appointment, InventoryItem, Procedure } from '../../types';
import { appointmentProcedureIds, selectedProcedures as selectedProceduresById } from '../../utils/appointmentProcedures';
import type { ExtraMaterialRow } from './appointmentFormModel';
import { AppointmentFormSection } from './AppointmentFormSection';
import type { SectionControl } from './PatientSection';

/** Soma os materiais dos procedimentos por item (um item usado por dois procedimentos conta as duas vezes). */
export function sumProcedureMaterials(procedures: Procedure[]) {
  const map = new Map<string, { itemId: string; quantity: number; item?: InventoryItem }>();
  for (const procedure of procedures) {
    for (const m of procedure.materials ?? []) {
      const prev = map.get(m.itemId);
      map.set(m.itemId, {
        itemId: m.itemId,
        quantity: (prev?.quantity ?? 0) + Number(m.quantity),
        item: m.item ?? prev?.item,
      });
    }
  }
  return [...map.values()];
}

/**
 * Estoque por item. Na edição, devolve o que este agendamento já baixou: os materiais dos
 * procedimentos salvos (não dos selecionados agora) e os extras.
 */
export function availableStock(
  inventory: InventoryItem[],
  appointmentSource: Appointment | null | undefined,
  procedureOptions: Procedure[],
) {
  const map = new Map<string, number>();
  for (const item of inventory) {
    map.set(item.id, Number(item.quantity));
  }
  if (appointmentSource?.materialsDeducted) {
    const deducted = sumProcedureMaterials(
      selectedProceduresById(procedureOptions, appointmentProcedureIds(appointmentSource)),
    );
    for (const m of deducted) {
      map.set(m.itemId, (map.get(m.itemId) ?? 0) + Number(m.quantity));
    }
    for (const m of appointmentSource.extraMaterials ?? []) {
      map.set(m.itemId, (map.get(m.itemId) ?? 0) + Number(m.quantity));
    }
  }
  return map;
}

/** Estoque efetivo (ver availableStock) e necessidade total por item. */
export function useAppointmentMaterials({
  inventory,
  appointmentSource,
  procedureOptions,
  selectedProcedures,
  extraMaterials,
}: {
  inventory: InventoryItem[];
  appointmentSource?: Appointment | null;
  procedureOptions: Procedure[];
  selectedProcedures: Procedure[];
  extraMaterials: ExtraMaterialRow[];
}) {
  const materials = useMemo(() => sumProcedureMaterials(selectedProcedures), [selectedProcedures]);

  const effectiveAvailable = useMemo(
    () => availableStock(inventory, appointmentSource, procedureOptions),
    [inventory, appointmentSource, procedureOptions],
  );

  const totalMaterialNeed = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of materials) {
      map.set(m.itemId, (map.get(m.itemId) ?? 0) + Number(m.quantity));
    }
    for (const extra of extraMaterials) {
      if (!extra.itemId || extra.quantity <= 0) continue;
      map.set(extra.itemId, (map.get(extra.itemId) ?? 0) + Number(extra.quantity));
    }
    return map;
  }, [materials, extraMaterials]);

  const hasInsufficient = useMemo(() => {
    for (const [itemId, needed] of totalMaterialNeed) {
      const available = effectiveAvailable.get(itemId);
      if (available !== undefined && available < needed) return true;
    }
    return false;
  }, [totalMaterialNeed, effectiveAvailable]);

  return { materials, effectiveAvailable, totalMaterialNeed, hasInsufficient };
}

type MaterialsState = ReturnType<typeof useAppointmentMaterials>;

function LegendSwatch({ tone, label }: { tone: 'warning' | 'error'; label: string }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.6}>
      <Box
        sx={{
          width: 10,
          height: 10,
          borderRadius: '3px',
          border: '1px solid',
          borderColor: `${tone}.main`,
          bgcolor: (t) => alpha(t.palette[tone].main, 0.14),
        }}
      />
      <Typography sx={{ fontSize: fontSizes['2xs'], color: 'text.secondary' }}>{label}</Typography>
    </Stack>
  );
}

export function MaterialsSection({
  section,
  enabled,
  inventory,
  extraMaterials,
  setExtraMaterials,
  willDeductMaterials,
  materialsState,
}: {
  section: SectionControl;
  enabled: boolean;
  inventory: InventoryItem[];
  extraMaterials: ExtraMaterialRow[];
  setExtraMaterials: Dispatch<SetStateAction<ExtraMaterialRow[]>>;
  willDeductMaterials: boolean;
  materialsState: MaterialsState;
}) {
  const { materials, effectiveAvailable, totalMaterialNeed, hasInsufficient } = materialsState;
  const extraCount = extraMaterials.filter((m) => m.itemId).length;
  const summary = !enabled
    ? 'Disponível para procedimentos'
    : willDeductMaterials && hasInsufficient
      ? 'Estoque insuficiente para este atendimento'
      : `${materials.length} previsto${materials.length !== 1 ? 's' : ''} · ${extraCount} extra${extraCount !== 1 ? 's' : ''}`;

  return (
    <AppointmentFormSection
      {...section}
      expanded={enabled && section.expanded}
      onToggle={enabled ? section.onToggle : () => undefined}
      title="Materiais"
      summary={summary}
    >
      <Stack spacing={1.5}>
        {materials.length > 0 && (
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={600}
              sx={{ display: 'block', mb: 0.75 }}
            >
              Previstos no procedimento
              {!willDeductMaterials && ' (reservados)'}
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.75}>
              {materials.map((m) => {
                const needed = totalMaterialNeed.get(m.itemId) ?? Number(m.quantity);
                const available =
                  effectiveAvailable.get(m.itemId) ??
                  (m.item?.quantity !== undefined ? Number(m.item.quantity) : undefined);
                const minQty = m.item?.minQuantity !== undefined ? Number(m.item.minQuantity) : undefined;
                const noStock = available !== undefined && available < needed;
                const low =
                  !noStock &&
                  available !== undefined &&
                  minQty !== undefined &&
                  available - needed <= minQty;
                const tone = noStock ? 'error' : low ? 'warning' : null;
                return (
                  <Box
                    key={m.itemId}
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.6,
                      fontSize: fontSizes.xs,
                      fontWeight: 700,
                      px: 1.15,
                      py: 0.55,
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: tone ? `${tone}.main` : 'divider',
                      bgcolor: tone ? (t) => alpha(t.palette[tone].main, 0.1) : 'grey.50',
                      color: tone ? `${tone}.dark` : 'text.secondary',
                    }}
                  >
                    {tone && (
                      <Box
                        sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: `${tone}.main`, flexShrink: 0 }}
                      />
                    )}
                    {m.item?.name ?? 'Item'} — {m.quantity}
                    {m.item?.unit ? ` ${m.item.unit}` : ''}
                  </Box>
                );
              })}
            </Stack>
            <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
              <LegendSwatch tone="warning" label="Estoque baixo" />
              <LegendSwatch tone="error" label="Sem estoque" />
            </Stack>
          </Box>
        )}

        <Box>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Materiais extras
            </Typography>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setExtraMaterials((rows) => [...rows, { itemId: '', quantity: 1 }])}
            >
              Adicionar
            </Button>
          </Stack>

          {extraMaterials.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nenhum material extra além do previsto no procedimento.
            </Typography>
          ) : (
            <Stack spacing={1.25}>
              {extraMaterials.map((row, index) => {
                const otherUsedIds = new Set(
                  extraMaterials
                    .filter((_, i) => i !== index)
                    .map((m) => m.itemId)
                    .filter(Boolean),
                );
                const availableItems = inventory.filter(
                  (i) => i.id === row.itemId || !otherUsedIds.has(i.id),
                );
                const totalForItem = row.itemId ? totalMaterialNeed.get(row.itemId) ?? 0 : 0;
                const available = row.itemId ? effectiveAvailable.get(row.itemId) : undefined;
                const insufficient =
                  !!row.itemId && available !== undefined && available < totalForItem;

                return (
                  <Stack
                    key={index}
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ sm: 'flex-start' }}
                  >
                    <Autocomplete
                      sx={{ flex: 1, minWidth: 0 }}
                      size="small"
                      options={availableItems}
                      getOptionLabel={(i) =>
                        `${i.name}${i.unit ? ` (${i.unit})` : ''} — disp.: ${effectiveAvailable.get(i.id) ?? i.quantity}`
                      }
                      value={availableItems.find((i) => i.id === row.itemId) ?? null}
                      onChange={(_, val) => {
                        setExtraMaterials((rows) =>
                          rows.map((r, i) => (i === index ? { ...r, itemId: val?.id ?? '' } : r)),
                        );
                      }}
                      renderInput={(params) => (
                        <TextField {...params} label="Material" size="small" required />
                      )}
                    />
                    <Stack direction="row" spacing={0.5} alignItems="flex-start">
                      <TextField
                        type="number"
                        size="small"
                        label="Qtd"
                        value={row.quantity}
                        inputProps={{ min: 0.001, step: 0.001 }}
                        sx={{ width: 88 }}
                        error={!!insufficient}
                        onChange={(e) => {
                          const quantity = Number(e.target.value);
                          setExtraMaterials((rows) =>
                            rows.map((r, i) => (i === index ? { ...r, quantity } : r)),
                          );
                        }}
                      />
                      <Tooltip title="Remover">
                        <IconButton
                          aria-label={`Remover material ${index + 1}`}
                          size="small"
                          onClick={() => setExtraMaterials((rows) => rows.filter((_, i) => i !== index))}
                          sx={{ mt: 0.25 }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
                );
              })}
            </Stack>
          )}
        </Box>
      </Stack>
    </AppointmentFormSection>
  );
}
