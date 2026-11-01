import { useEffect, useMemo, useState } from 'react';
import { Box, Button, MenuItem, Select } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { skincareApi, type SkincareProductPayload, type SkincareRulePayload } from '../../api/skincare';
import { useAppToast } from '../../contexts/AppToastContext';
import { usePlatformCatalog } from '../../hooks/usePlatformCatalog';
import { getApiErrorMessage } from '../../utils/apiError';
import type { SkincareProduct, SkincareRule, SkincareRuleField } from '../../types';
import { RULE_FIELDS, SKINCARE_MOMENTS, SKINCARE_STEPS, optionLabel, ruleValueOptions, skincareTagsFromCatalog } from './skincareUtils';
import { BUTTON_SX, Field, INPUT_SX, PRIMARY_BUTTON_SX, SkinModal, SkincareMultiSelect, TextInput, ToggleChip } from './skincareUi';

const SELECT_SX = {
  ...INPUT_SX,
  px: 0,
  '& .MuiSelect-select': { px: 1.5, py: 0, minHeight: '44px !important', display: 'flex', alignItems: 'center' },
  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
} as const;

// O SkinModal fica acima da gaveta da paciente; o menu do select precisa ficar acima dele.
const SELECT_MENU_PROPS = { sx: { zIndex: (t: Theme) => t.zIndex.modal + 4 } };

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

function ModalActions({ onCancel, onSave, saving, label }: { onCancel: () => void; onSave: () => void; saving: boolean; label: string }) {
  return (
    <>
      <Button onClick={onCancel} disabled={saving} sx={{ ...BUTTON_SX, px: 2.25 }}>
        Cancelar
      </Button>
      <Button onClick={onSave} disabled={saving} sx={{ ...PRIMARY_BUTTON_SX, px: 2.5, boxShadow: 'none' }}>
        {saving ? 'Salvando…' : label}
      </Button>
    </>
  );
}

const EMPTY_PRODUCT: SkincareProductPayload = {
  name: '',
  brand: '',
  activeIngredient: '',
  moments: ['manha'],
  step: 'limpeza',
  tags: [],
  howTo: '',
  note: '',
};

function useSkincareTagSelectOptions() {
  const tagCatalog = usePlatformCatalog('skincare_tag');
  return useMemo(
    () => skincareTagsFromCatalog(tagCatalog).map(([value, label]) => ({ value, label })),
    [tagCatalog],
  );
}

export function SkincareProductDialog({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: SkincareProduct | null }) {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const [form, setForm] = useState<SkincareProductPayload>(EMPTY_PRODUCT);
  const tagSelectOptions = useSkincareTagSelectOptions();

  useEffect(() => {
    if (!open) return;
    setForm(
      editing
        ? {
            name: editing.name,
            brand: editing.brand ?? '',
            activeIngredient: editing.activeIngredient ?? '',
            moments: editing.moments,
            step: editing.step,
            tags: editing.tags,
            howTo: editing.howTo ?? '',
            note: editing.note ?? '',
          }
        : EMPTY_PRODUCT,
    );
  }, [open, editing]);

  const mutation = useMutation({
    mutationFn: (payload: SkincareProductPayload) =>
      editing ? skincareApi.updateProduct(editing.id, payload) : skincareApi.createProduct(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skincare', 'products'] });
      toast.success(editing ? 'Produto atualizado' : 'Produto cadastrado');
      onClose();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível salvar o produto.')),
  });

  const set = <K extends keyof SkincareProductPayload>(key: K, value: SkincareProductPayload[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = () => {
    if (!form.name.trim()) return toast.error('Informe o nome do produto');
    if (!form.moments.length) return toast.error('Escolha ao menos um momento de uso');
    mutation.mutate(form);
  };

  return (
    <SkinModal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar produto' : 'Novo produto'}
      subtitle="O momento e a etapa definem onde o produto aparece na rotina."
      actions={<ModalActions onCancel={onClose} onSave={save} saving={mutation.isPending} label="Salvar produto" />}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 1.75 }}>
        <Field label="Nome do produto">
          <TextInput autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex.: Sérum vitamina C 10%" />
        </Field>
        <Field label="Marca">
          <TextInput value={form.brand ?? ''} onChange={(e) => set('brand', e.target.value)} placeholder="Ex.: Lumière Lab" />
        </Field>
        <Field label="Ativo principal">
          <TextInput value={form.activeIngredient ?? ''} onChange={(e) => set('activeIngredient', e.target.value)} placeholder="Ex.: Ácido ascórbico" />
        </Field>
        <Field label="Etapa da rotina">
          <Select value={form.step} onChange={(e) => set('step', e.target.value as SkincareProductPayload['step'])} sx={SELECT_SX} MenuProps={SELECT_MENU_PROPS}>
            {SKINCARE_STEPS.map(([v, label]) => (
              <MenuItem key={v} value={v}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </Field>
      </Box>
      <Field label="Momento de uso">
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {SKINCARE_MOMENTS.map(([v, label]) => (
            <ToggleChip key={v} selected={form.moments.includes(v)} onClick={() => set('moments', toggle(form.moments, v))}>
              {label}
            </ToggleChip>
          ))}
        </Box>
      </Field>
      <Field label="Características" hint="gerenciadas em /admin/catalogos">
        <SkincareMultiSelect
          options={tagSelectOptions}
          value={form.tags}
          onChange={(tags) => set('tags', tags)}
          placeholder="Buscar características…"
        />
      </Field>
      <Field label="Como usar">
        <TextInput multiline minRows={2} value={form.howTo ?? ''} onChange={(e) => set('howTo', e.target.value)} placeholder="Ex.: 3 a 4 gotas no rosto seco, antes do hidratante." />
      </Field>
      <Field label="Observação curta">
        <TextInput value={form.note ?? ''} onChange={(e) => set('note', e.target.value)} placeholder="Ex.: introduzir aos poucos, 2x por semana" />
      </Field>
    </SkinModal>
  );
}

export function SkincareRuleDialog({
  open,
  onClose,
  editing,
  products,
}: {
  open: boolean;
  onClose: () => void;
  editing: SkincareRule | null;
  products: SkincareProduct[];
}) {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const [form, setForm] = useState<SkincareRulePayload>({ field: 'pele', value: 'normal', productIds: [], avoidTags: [], note: '' });
  const tagSelectOptions = useSkincareTagSelectOptions();

  const productSelectOptions = useMemo(
    () =>
      products.map((p) => ({
        value: p.id,
        label: p.name,
        hint: optionLabel(SKINCARE_STEPS, p.step),
      })),
    [products],
  );

  useEffect(() => {
    if (!open) return;
    setForm(
      editing
        ? { field: editing.field, value: editing.value, productIds: editing.productIds, avoidTags: editing.avoidTags, note: editing.note ?? '' }
        : { field: 'pele', value: 'normal', productIds: [], avoidTags: [], note: '' },
    );
  }, [open, editing]);

  const mutation = useMutation({
    mutationFn: (payload: SkincareRulePayload) => (editing ? skincareApi.updateRule(editing.id, payload) : skincareApi.createRule(payload)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skincare', 'rules'] });
      toast.success(editing ? 'Regra atualizada' : 'Regra criada');
      onClose();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível salvar a regra.')),
  });

  const save = () => {
    if (!form.productIds.length && !form.avoidTags.length) return toast.error('Inclua ao menos um produto ou restrição');
    mutation.mutate(form);
  };

  return (
    <SkinModal
      open={open}
      onClose={onClose}
      maxWidth={700}
      title={editing ? 'Editar regra' : 'Nova regra'}
      subtitle="Quando a resposta bater com o critério, a regra é aplicada."
      actions={<ModalActions onCancel={onClose} onSave={save} saving={mutation.isPending} label="Salvar regra" />}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 1.75 }}>
        <Field label="Critério">
          <Select
            value={form.field}
            onChange={(e) => {
              const field = e.target.value as SkincareRuleField;
              setForm((f) => ({ ...f, field, value: ruleValueOptions(field)[0][0] }));
            }}
            sx={SELECT_SX}
            MenuProps={SELECT_MENU_PROPS}
          >
            {RULE_FIELDS.map(([v, label]) => (
              <MenuItem key={v} value={v}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </Field>
        <Field label="Resposta">
          <Select value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} sx={SELECT_SX} MenuProps={SELECT_MENU_PROPS}>
            {ruleValueOptions(form.field).map(([v, label]) => (
              <MenuItem key={v} value={v}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </Field>
      </Box>
      <Field label="Produtos incluídos">
        <SkincareMultiSelect
          options={productSelectOptions}
          value={form.productIds}
          onChange={(productIds) => setForm((f) => ({ ...f, productIds }))}
          placeholder={products.length ? 'Buscar produtos…' : 'Cadastre produtos na aba Produtos'}
        />
      </Field>
      <Field label="Evitar produtos com">
        <SkincareMultiSelect
          options={tagSelectOptions}
          value={form.avoidTags}
          onChange={(avoidTags) => setForm((f) => ({ ...f, avoidTags }))}
          placeholder="Buscar características…"
        />
      </Field>
      <Field label="Orientação para a paciente" hint="opcional">
        <TextInput value={form.note ?? ''} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Ex.: introduzir um ativo novo por vez" />
      </Field>
    </SkinModal>
  );
}
