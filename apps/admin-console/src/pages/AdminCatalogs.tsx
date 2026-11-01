import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import BlockIcon from '@mui/icons-material/Block';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../api/admin';
import { CatalogFormDialog } from '../components/CatalogFormDialog';
import { ROW_ACTION_SX } from '../components/adminUi';
import {
  LIST_HEADER_ACTION_SX,
  LIST_HEADER_SELECT_SX,
  ListCardHeader,
} from '../../../../frontend/src/components/ListCardHeader';
import { useAppDialog } from '../../../../frontend/src/contexts/AppDialogContext';
import { useAppToast } from '../../../../frontend/src/contexts/AppToastContext';
import {
  catalogMetaColor,
  PLATFORM_CATALOG_KIND_LABELS,
  PLATFORM_CATALOG_KINDS,
} from '../../../../frontend/src/features/platformCatalog';
import { useUrlState, urlEnum } from '../../../../frontend/src/hooks/useUrlState';
import { fontSizes } from '../../../../frontend/src/theme/fontSizes';
import { getApiErrorMessage } from '../../../../frontend/src/utils/apiError';
import type { PlatformCatalogItem, PlatformCatalogKind } from '../../../../frontend/src/types';

const KIND_CODEC = urlEnum<PlatformCatalogKind>([...PLATFORM_CATALOG_KINDS]);

const GRID_COLS = 'minmax(0, 1.2fr) minmax(0, 1.6fr) 72px minmax(0, 1fr) 96px';
const GRID_MIN_WIDTH = 720;

/** Catálogos globais da plataforma (super-admin): sem override por clínica. */
export function AdminCatalogs() {
  const queryClient = useQueryClient();
  const { confirm } = useAppDialog();
  const toast = useAppToast();
  const [kind, setKind] = useUrlState<PlatformCatalogKind>('tipo', 'document_category', KIND_CODEC);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformCatalogItem | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['admin', 'catalogs', kind],
    queryFn: () => adminApi.listCatalogs(kind),
    placeholderData: keepPreviousData,
  });

  const activeMutation = useMutation({
    mutationFn: ({ item, active }: { item: PlatformCatalogItem; active: boolean }) =>
      adminApi.setCatalogItemActive(item.id, active),
    onSuccess: (updated, { active }) => {
      queryClient.setQueryData<PlatformCatalogItem[]>(['admin', 'catalogs', kind], (old) =>
        old?.map((i) => (i.id === updated.id ? updated : i)),
      );
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      queryClient.invalidateQueries({ queryKey: ['catalogs'] });
      toast.success(active ? `“${updated.label}” ativado.` : `“${updated.label}” desativado.`);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível alterar o item.')),
  });

  const toggleActive = async (item: PlatformCatalogItem) => {
    if (item.active) {
      const ok = await confirm({
        title: 'Desativar item',
        message: `Desativar “${item.label}”?`,
        details: [
          'Deixa de aparecer nos selects das clínicas.',
          'Registros que já usam este valor continuam com ele.',
        ],
        confirmLabel: 'Desativar',
        confirmColor: 'error',
      });
      if (ok) activeMutation.mutate({ item, active: false });
    } else {
      activeMutation.mutate({ item, active: true });
    }
  };

  const openForm = (item: PlatformCatalogItem | null) => {
    setEditing(item);
    setFormOpen(true);
  };

  const activeCount = useMemo(() => items.filter((i) => i.active).length, [items]);

  return (
    <Box>
      <Card sx={{ p: 0, overflow: 'hidden' }}>
        <ListCardHeader
          title={
            <Typography sx={{ fontSize: fontSizes.md, color: 'text.secondary', fontWeight: 600 }}>
              {isLoading ? (
                <Skeleton width={200} />
              ) : (
                <>
                  <Box component="span" sx={{ color: 'text.primary', fontWeight: 800 }}>
                    {items.length}
                  </Box>{' '}
                  {items.length === 1 ? 'item' : 'itens'}
                  {items.length > activeCount && ` · ${activeCount} ativo${activeCount === 1 ? '' : 's'}`}
                  <Box component="span" sx={{ color: 'text.disabled', fontWeight: 500 }}>
                    {' '}
                    · mesmas opções em todas as clínicas
                  </Box>
                </>
              )}
            </Typography>
          }
        >
          <TextField
            select
            size="small"
            value={kind}
            onChange={(e) => setKind(e.target.value as PlatformCatalogKind)}
            inputProps={{ 'aria-label': 'Tipo de catálogo' }}
            sx={{ ...LIST_HEADER_SELECT_SX, minWidth: 220 }}
          >
            {PLATFORM_CATALOG_KINDS.map((k) => (
              <MenuItem key={k} value={k}>
                {PLATFORM_CATALOG_KIND_LABELS[k]}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openForm(null)} sx={LIST_HEADER_ACTION_SX}>
            Novo item
          </Button>
        </ListCardHeader>

        <Box sx={{ overflowX: 'auto' }}>
          <Box sx={{ minWidth: GRID_MIN_WIDTH }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: GRID_COLS,
                gap: 1.5,
                px: 2.5,
                py: 1.25,
                borderBottom: 1,
                borderColor: 'divider',
                bgcolor: 'grey.50',
              }}
            >
              {['Valor', 'Rótulo', 'Ordem', 'Meta', ''].map((h) => (
                <Typography
                  key={h || 'actions'}
                  sx={{
                    fontSize: fontSizes['2xs'],
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                  }}
                >
                  {h}
                </Typography>
              ))}
            </Box>

            {isLoading ? (
              <Stack spacing={0} sx={{ px: 2.5, py: 1 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} height={48} sx={{ my: 0.5 }} />
                ))}
              </Stack>
            ) : items.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <CategoryOutlinedIcon sx={{ fontSize: 42, color: 'text.disabled', mb: 1 }} />
                <Typography sx={{ fontWeight: 700 }}>Nenhum item neste catálogo</Typography>
                <Typography color="text.secondary" sx={{ fontSize: fontSizes.md, mt: 0.5 }}>
                  Crie o primeiro item para {PLATFORM_CATALOG_KIND_LABELS[kind].toLowerCase()}.
                </Typography>
              </Box>
            ) : (
              items.map((item) => {
                const color = catalogMetaColor(item.meta);
                const defaultTrigger =
                  item.meta && typeof item.meta === 'object' && typeof item.meta.defaultTrigger === 'string'
                    ? item.meta.defaultTrigger
                    : null;
                return (
                  <Box
                    key={item.id}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: GRID_COLS,
                      gap: 1.5,
                      alignItems: 'center',
                      px: 2.5,
                      py: 1.35,
                      borderBottom: 1,
                      borderColor: 'grey.100',
                      opacity: item.active ? 1 : 0.55,
                      '&:last-of-type': { borderBottom: 0 },
                    }}
                  >
                    <Typography noWrap sx={{ fontSize: fontSizes.sm, fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}>
                      {item.value}
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                      {color && (
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '4px',
                            bgcolor: color,
                            flexShrink: 0,
                            border: 1,
                            borderColor: alpha(color, 0.4),
                          }}
                        />
                      )}
                      <Typography noWrap sx={{ fontSize: fontSizes.md, fontWeight: 600 }}>
                        {item.label}
                      </Typography>
                      {!item.active && (
                        <Chip size="small" label="Inativo" sx={{ height: 20, fontSize: fontSizes['2xs'], fontWeight: 700 }} />
                      )}
                    </Stack>
                    <Typography sx={{ fontSize: fontSizes.sm, fontVariantNumeric: 'tabular-nums' }}>{item.sortOrder}</Typography>
                    <Typography noWrap sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }}>
                      {defaultTrigger ?? (color ? color : '—')}
                    </Typography>
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title="Editar">
                        <IconButton aria-label={`Editar ${item.label}`} onClick={() => openForm(item)} sx={ROW_ACTION_SX}>
                          <EditIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={item.active ? 'Desativar' : 'Ativar'}>
                        <IconButton
                          aria-label={`${item.active ? 'Desativar' : 'Ativar'} ${item.label}`}
                          disabled={activeMutation.isPending}
                          onClick={() => toggleActive(item)}
                          sx={{ ...ROW_ACTION_SX, color: item.active ? 'error.main' : 'success.main' }}
                        >
                          {item.active ? (
                            <BlockIcon sx={{ fontSize: 16 }} />
                          ) : (
                            <PlayCircleOutlineIcon sx={{ fontSize: 16 }} />
                          )}
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      </Card>

      <CatalogFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
        defaultKind={kind}
      />
    </Box>
  );
}
