import { useMemo, useState } from 'react';
import { Box, Button, Skeleton, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { skincareApi } from '../api/skincare';
import { SkincareProductDialog, SkincareRuleDialog } from '../components/skincare/SkincareConfigDialogs';
import {
  RULE_FIELDS,
  SKINCARE_MOMENTS,
  SKINCARE_STEPS,
  optionLabel,
  ruleConditionLabel,
  skincareTagsFromCatalog,
} from '../components/skincare/skincareUtils';
import { usePlatformCatalog } from '../hooks/usePlatformCatalog';
import {
  BORDER_SOFT,
  DARK_BG,
  ICON,
  PANEL_SX,
  PRIMARY_BUTTON_SX,
  Pill,
  SmallIconButton,
  Svg,
  TEXT_SOFT,
} from '../components/skincare/skincareUi';
import { useAppDialog } from '../contexts/AppDialogContext';
import { useAppToast } from '../contexts/AppToastContext';
import { usePermissions } from '../contexts/usePermissions';
import type { SkincareProduct, SkincareRule } from '../types';
import { fontSizes } from '../theme/fontSizes';
import { getApiErrorMessage } from '../utils/apiError';

type Tab = 'produtos' | 'regras';

const PRODUCT_COLUMNS = '2.1fr 1.5fr 1.2fr 1.1fr 1.4fr 76px';

const HEAD_SX = { fontSize: fontSizes['2xs'], fontWeight: 800, letterSpacing: '.04em', color: TEXT_SOFT, textTransform: 'uppercase' } as const;

/** Rotinas de skincare: produtos e regras usados pela anamnese de pele (a anamnese em si fica na ficha da paciente). */
export function SkincareRoutines() {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const { confirm } = useAppDialog();
  const { has } = usePermissions();
  const canEdit = has('routines:edit');
  const canDelete = has('routines:delete');

  const [tab, setTab] = useState<Tab>('produtos');
  const [productDialog, setProductDialog] = useState<{ open: boolean; editing: SkincareProduct | null }>({ open: false, editing: null });
  const [ruleDialog, setRuleDialog] = useState<{ open: boolean; editing: SkincareRule | null }>({ open: false, editing: null });

  const { data: products = [], isLoading: productsLoading } = useQuery({ queryKey: ['skincare', 'products'], queryFn: skincareApi.listProducts });
  const { data: rules = [], isLoading: rulesLoading } = useQuery({ queryKey: ['skincare', 'rules'], queryFn: skincareApi.listRules });
  const productName = useMemo(() => new Map(products.map((p) => [p.id, p.name])), [products]);
  const tagCatalog = usePlatformCatalog('skincare_tag');
  const tagOptions = useMemo(() => skincareTagsFromCatalog(tagCatalog), [tagCatalog]);

  const deleteProduct = useMutation({
    mutationFn: (p: SkincareProduct) => skincareApi.removeProduct(p.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skincare'] });
      toast.success('Item excluído');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível excluir o produto.')),
  });
  const deleteRule = useMutation({
    mutationFn: (r: SkincareRule) => skincareApi.removeRule(r.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skincare', 'rules'] });
      toast.success('Item excluído');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível excluir a regra.')),
  });

  const askDeleteProduct = async (p: SkincareProduct) => {
    const ok = await confirm({
      title: `Excluir "${p.name}"?`,
      message: 'O produto também será retirado das regras em que aparece.',
      confirmLabel: 'Excluir',
      confirmColor: 'error',
    });
    if (ok) deleteProduct.mutate(p);
  };
  const askDeleteRule = async (r: SkincareRule) => {
    const ok = await confirm({
      title: `Excluir "${ruleConditionLabel(r)}"?`,
      message: 'A regra deixa de ser aplicada nas próximas rotinas.',
      confirmLabel: 'Excluir',
      confirmColor: 'error',
    });
    if (ok) deleteRule.mutate(r);
  };

  const tabButton = (value: Tab, label: string) => {
    const selected = tab === value;
    return (
      <Box
        component="button"
        type="button"
        aria-pressed={selected}
        onClick={() => setTab(value)}
        sx={{
          height: 36,
          px: 1.9,
          borderRadius: '9px',
          border: 'none',
          fontFamily: 'inherit',
          fontSize: fontSizes.sm,
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          bgcolor: selected ? DARK_BG : 'transparent',
          color: selected ? '#fff' : 'text.secondary',
        }}
      >
        {label}
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.25 }}>
        <Box sx={{ display: 'flex', gap: 0.5, p: 0.5, borderRadius: '12px', bgcolor: 'background.paper', border: 1, borderColor: 'divider', maxWidth: '100%', overflowX: 'auto' }}>
          {tabButton('produtos', `Produtos e ativos · ${products.length}`)}
          {tabButton('regras', `Regras · ${rules.length}`)}
        </Box>
        <Box sx={{ flex: 1 }} />
        {canEdit && (
          <Button
            onClick={() => (tab === 'produtos' ? setProductDialog({ open: true, editing: null }) : setRuleDialog({ open: true, editing: null }))}
            sx={PRIMARY_BUTTON_SX}
          >
            <Svg d={ICON.plus} size={16} stroke={2.2} />
            {tab === 'produtos' ? 'Novo produto' : 'Nova regra'}
          </Button>
        )}
      </Box>

      {tab === 'produtos' ? (
        <Box sx={{ ...PANEL_SX, overflowX: 'auto' }}>
          <Box sx={{ minWidth: 880 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: PRODUCT_COLUMNS, gap: 1.5, px: 2.5, py: 1.6, bgcolor: 'grey.50', borderBottom: 1, borderColor: 'divider' }}>
              <Typography sx={HEAD_SX}>Produto</Typography>
              <Typography sx={HEAD_SX}>Ativo principal</Typography>
              <Typography sx={HEAD_SX}>Momento</Typography>
              <Typography sx={HEAD_SX}>Etapa</Typography>
              <Typography sx={HEAD_SX}>Características</Typography>
              <span />
            </Box>
            {productsLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Box key={i} sx={{ px: 2.5, py: 1.6, borderBottom: `1px solid ${BORDER_SOFT}` }}>
                  <Skeleton width="40%" />
                </Box>
              ))
            ) : products.length === 0 ? (
              <Typography sx={{ px: 2.5, py: 3, fontSize: fontSizes.sm, color: TEXT_SOFT, fontWeight: 600 }}>
                Nenhum produto cadastrado. Cadastre os produtos que a clínica indica para montar as rotinas.
              </Typography>
            ) : (
              products.map((p) => (
                <Box
                  key={p.id}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: PRODUCT_COLUMNS,
                    gap: 1.5,
                    px: 2.5,
                    py: 1.6,
                    borderBottom: `1px solid ${BORDER_SOFT}`,
                    alignItems: 'center',
                    '&:last-of-type': { borderBottom: 0 },
                  }}
                >
                  <Box sx={{ lineHeight: 1.35, minWidth: 0 }}>
                    <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 700 }}>{p.name}</Typography>
                    <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }}>{p.brand}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', fontWeight: 600, minWidth: 0 }}>{p.activeIngredient}</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                    {p.moments.map((m) => (
                      <Pill key={m}>{optionLabel(SKINCARE_MOMENTS, m)}</Pill>
                    ))}
                  </Box>
                  <Typography sx={{ fontSize: fontSizes.xs, fontWeight: 700 }}>{optionLabel(SKINCARE_STEPS, p.step)}</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                    {p.tags.length === 0 ? (
                      <Typography sx={{ fontSize: fontSizes.xs, color: TEXT_SOFT }}>—</Typography>
                    ) : (
                      p.tags.map((t) => (
                        <Pill key={t} tone="neutral">
                          {optionLabel(tagOptions, t)}
                        </Pill>
                      ))
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.75, justifyContent: 'flex-end' }}>
                    {canEdit && <SmallIconButton title="Editar" icon={ICON.edit} onClick={() => setProductDialog({ open: true, editing: p })} />}
                    {canDelete && <SmallIconButton title="Excluir" danger icon={ICON.trash} onClick={() => askDeleteProduct(p)} />}
                  </Box>
                </Box>
              ))
            )}
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', lineHeight: 1.5, textWrap: 'pretty' }}>
            Todas as regras que batem com as respostas da anamnese são somadas. Os produtos incluídos entram na etapa definida no cadastro do produto;
            as restrições removem qualquer produto com aquela característica, mesmo que outra regra o inclua.
          </Typography>
          {RULE_FIELDS.map(([field, label]) => {
            const group = rules.filter((r) => r.field === field);
            return (
              <Box key={field} sx={{ ...PANEL_SX, overflow: 'hidden' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.25, px: 2.5, py: 1.75, bgcolor: 'grey.50', borderBottom: 1, borderColor: 'divider' }}>
                  <Typography sx={{ fontSize: fontSizes.md, fontWeight: 800 }}>{label}</Typography>
                  <Typography sx={{ fontSize: fontSizes.xs, fontWeight: 700, color: TEXT_SOFT }}>
                    {group.length} {group.length === 1 ? 'regra' : 'regras'}
                  </Typography>
                </Box>
                {rulesLoading ? (
                  <Box sx={{ px: 2.5, py: 2 }}>
                    <Skeleton width="50%" />
                  </Box>
                ) : group.length === 0 ? (
                  <Typography sx={{ px: 2.5, py: 2.25, fontSize: fontSizes.xs, color: TEXT_SOFT, fontWeight: 600 }}>Nenhuma regra para este critério.</Typography>
                ) : (
                  group.map((r) => (
                    <Box
                      key={r.id}
                      sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '12px 18px',
                        px: 2.5,
                        py: 1.9,
                        borderBottom: `1px solid ${BORDER_SOFT}`,
                        alignItems: 'flex-start',
                        '&:last-of-type': { borderBottom: 0 },
                      }}
                    >
                      <Box component="span" sx={{ flex: '0 0 auto', fontSize: fontSizes.xs, fontWeight: 800, px: 1.5, py: 0.75, borderRadius: '9px', bgcolor: DARK_BG, color: '#fff' }}>
                        {ruleConditionLabel(r)}
                      </Box>
                      <Box sx={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {r.productIds.length > 0 && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75 }}>
                            <Typography component="span" sx={{ ...HEAD_SX, mr: 0.25 }}>
                              Inclui
                            </Typography>
                            {r.productIds
                              .filter((id) => productName.has(id))
                              .map((id) => (
                                <Pill key={id}>{productName.get(id)}</Pill>
                              ))}
                          </Box>
                        )}
                        {r.avoidTags.length > 0 && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75 }}>
                            <Typography component="span" sx={{ ...HEAD_SX, mr: 0.25 }}>
                              Evita
                            </Typography>
                            {r.avoidTags.map((t) => (
                              <Pill key={t} tone="danger">
                                {optionLabel(tagOptions, t)}
                              </Pill>
                            ))}
                          </Box>
                        )}
                        {r.note && (
                          <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', fontWeight: 600, textWrap: 'pretty' }}>Orientação: {r.note}</Typography>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.75, flexShrink: 0 }}>
                        {canEdit && <SmallIconButton title="Editar" icon={ICON.edit} onClick={() => setRuleDialog({ open: true, editing: r })} />}
                        {canDelete && <SmallIconButton title="Excluir" danger icon={ICON.trash} onClick={() => askDeleteRule(r)} />}
                      </Box>
                    </Box>
                  ))
                )}
              </Box>
            );
          })}
        </Box>
      )}

      <SkincareProductDialog open={productDialog.open} editing={productDialog.editing} onClose={() => setProductDialog({ open: false, editing: null })} />
      <SkincareRuleDialog open={ruleDialog.open} editing={ruleDialog.editing} products={products} onClose={() => setRuleDialog({ open: false, editing: null })} />
    </Box>
  );
}
