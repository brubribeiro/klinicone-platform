import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Card, IconButton, MenuItem, Select, Stack, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import { downloadCsv } from '../utils/csv';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUrlState } from '../hooks/useUrlState';
import { STOCK_FILTER_CODEC, matchFields, type StockFilter } from '../utils/listFilters';
import { inventoryApi } from '../api/inventory';
import { InventoryFormDialog } from '../components/inventory/InventoryFormDialog';
import { MovementDialog } from '../components/inventory/MovementDialog';
import { BulkPurchaseDialog } from '../components/inventory/BulkPurchaseDialog';
import { InventoryDetailDrawer } from '../components/inventory/InventoryDetailDrawer';
import { INVENTORY_GRID_COLUMNS, InventoryListRow } from '../components/inventory/InventoryListRow';
import {
  EXPIRING_DAYS,
  STOCK_STATUS_COLOR,
  daysToExpiry,
  isLowStock,
} from '../components/inventory/inventoryStatus';
import {
  LIST_HEADER_COMPACT_SELECT_SX,
  LIST_HEADER_ICON_BUTTON_SX,
  ListCardHeader,
  ListSearchField,
} from '../components/ListCardHeader';
import { COMPACT_PAGE_ARROW_SX, ListPageButtons } from '../components/ListPageButtons';
import { ListEmptyState, ListSkeletonRows } from '../components/ListStates';
import { ListTableHeader } from '../components/ListTableHeader';
import { StatCard } from '../components/StatCard';
import { usePagination } from '../hooks/usePagination';
import { useAppDialog } from '../contexts/AppDialogContext';
import { useAppToast } from '../contexts/AppToastContext';
import { useDeleteWithDependencies } from '../hooks/useDeleteWithDependencies';
import { getApiErrorMessage } from '../utils/apiError';
import { usePermissions } from '../contexts/usePermissions';
import type { InventoryItem } from '../types';
import { fontSizes } from '../theme/fontSizes';
import { moneyFormatter } from '../utils/money';

const brlRounded = moneyFormatter({
  maximumFractionDigits: 0,
});
const PAGE_SIZE = 10;

const TOOLBAR_BUTTON_SX = {
  flexShrink: 0,
  whiteSpace: 'nowrap',
  height: 38,
  px: 1.9,
  borderRadius: '11px',
  borderColor: 'divider',
  bgcolor: 'background.paper',
  color: 'text.primary',
  fontSize: fontSizes.sm,
} as const;

export function Inventory() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { confirm, alert } = useAppDialog();
  const toast = useAppToast();
  const deleteWithDependencies = useDeleteWithDependencies();
  const { has } = usePermissions();
  const canEdit = has('inventory:edit');
  const canDelete = has('inventory:delete');

  const [search, setSearch] = useUrlState('busca', '');
  const [stockFilter, setStockFilter] = useUrlState<StockFilter>('estoque', 'ALL', STOCK_FILTER_CODEC);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [movementOpen, setMovementOpen] = useState(false);
  const [movementItem, setMovementItem] = useState<InventoryItem | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => inventoryApi.list(),
  });

  const stats = useMemo(() => {
    const lowStock = items.filter(isLowStock).length;
    const expiring = items.filter((i) => {
      const days = daysToExpiry(i.expiresAt);
      return days != null && days >= 0 && days <= EXPIRING_DAYS;
    }).length;
    const stockValue = items.reduce(
      (sum, i) => sum + Math.max(0, Number(i.quantity)) * Number(i.costPrice ?? 0),
      0,
    );
    return [
      { label: 'Itens cadastrados', value: String(items.length) },
      { label: 'Estoque baixo', value: String(lowStock), color: lowStock > 0 ? STOCK_STATUS_COLOR.LOW : undefined },
      { label: `Vencendo (${EXPIRING_DAYS}d)`, value: String(expiring), color: expiring > 0 ? STOCK_STATUS_COLOR.EXPIRING : undefined },
      { label: 'Valor em estoque', value: brlRounded.format(stockValue) },
    ];
  }, [items]);

  const filteredItems = useMemo(
    () =>
      items.filter((i) => {
        if (stockFilter === 'LOW' && !isLowStock(i)) return false;
        return matchFields(search, i.name, i.sku, i.description);
      }),
    [items, search, stockFilter],
  );

  const { page: current, setPage, pageCount, rows, rangeStart, rangeEnd } = usePagination(
    filteredItems,
    PAGE_SIZE);


  const exportCsv = async () => {
    const ok = downloadCsv(
      'estoque.csv',
      items.map((i) => ({
        Nome: i.name,
        SKU: i.sku ?? '',
        Quantidade: String(i.quantity),
        'Qtd Mínima': String(i.minQuantity),
        Unidade: i.unit ?? '',
        'Custo Unitário': i.costPrice != null ? Number(i.costPrice).toFixed(2) : '',
      })),
      ['Nome', 'SKU', 'Quantidade', 'Qtd Mínima', 'Unidade', 'Custo Unitário'],
    );
    if (!ok) {
      await alert({
        title: 'Exportar',
        message: 'Nenhum item para exportar.',
        severity: 'info',
      });
    }
  };

  const openMovement = (item: InventoryItem | null) => {
    setMovementItem(item);
    setMovementOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditing(item);
    setFormOpen(true);
  };

  const handleDelete = async (item: InventoryItem) => {
    if (!canDelete) {
      toast.error('Você não tem permissão para excluir itens do estoque. Peça a um administrador para liberar "Estoque > Excluir" no seu grupo.');
      return;
    }
    await deleteWithDependencies({
      title: 'Excluir item',
      message: `Excluir o item "${item.name}"?`,
      remove: (options) => inventoryApi.remove(item.id, options),
      successMessage: 'Item excluído.',
      errorMessage: 'Não foi possível excluir o item.',
      onDeleted: () => {
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        setDetailId((open) => (open === item.id ? null : open));
      },
    });
  };

  return (
    <Box>
      <Stack spacing={2.25}>
        {/* Indicadores */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            gap: { xs: 1.5, md: 2.25 },
          }}
        >
          {stats.map((s) => (
            <StatCard
              key={s.label}
              label={s.label}
              value={s.value}
              color={s.color}
              loading={isLoading}
              skeletonWidth={70}
              skeletonHeight={34}
              sx={{ p: '18px 20px', border: 1, borderColor: 'divider' }}
              valueSx={{ fontSize: fontSizes['6xl'], lineHeight: 1.2 }}
              labelSx={{ fontSize: fontSizes.sm }}
            />
          ))}
        </Box>

        {/* Tabela de produtos */}
        <Card data-tour="inventory-list" sx={{ borderRadius: '18px', border: 1, borderColor: 'divider', overflow: 'hidden' }}>
          <ListCardHeader
            breakpoint="lg"
            nowrapFrom={null}
            sx={{ py: 2.25 }}
            title={
              <Typography component="h3" sx={{ fontSize: fontSizes.xl, fontWeight: 700 }}>
                Produtos &amp; insumos
              </Typography>
            }
          >
            <ListSearchField
              compact
              width={210}
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(0);
              }}
              placeholder="Buscar produto..."
              ariaLabel="Buscar por nome ou SKU"
            />
            <Select
              size="small"
              value={stockFilter}
              onChange={(e) => {
                setStockFilter(e.target.value as StockFilter);
                setPage(0);
              }}
              inputProps={{ 'aria-label': 'Filtrar estoque' }}
              sx={{ ...LIST_HEADER_COMPACT_SELECT_SX, minWidth: 160 }}
            >
              <MenuItem value="ALL">Todo o estoque</MenuItem>
              <MenuItem value="LOW">Abaixo do mínimo</MenuItem>
            </Select>
            <Tooltip title="Exportar CSV">
              <IconButton
                onClick={exportCsv}
                aria-label="Exportar CSV"
                sx={{ ...LIST_HEADER_ICON_BUTTON_SX, borderRadius: '11px' }}
              >
                <FileDownloadOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button data-tour="inventory-move"
              variant="outlined"
              startIcon={<SwapVertIcon />}
              onClick={() => openMovement(null)}
              disabled={items.length === 0}
              sx={TOOLBAR_BUTTON_SX}
            >
              Movimentar
            </Button>
            {canEdit && (
              <Button data-tour="inventory-new"
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setBulkOpen(true)}
                sx={{ ...TOOLBAR_BUTTON_SX, border: 0, bgcolor: undefined, color: undefined }}
              >
                Adicionar item
              </Button>
            )}
          </ListCardHeader>

          <Box sx={{ overflowX: 'auto' }}>
            <Box sx={{ minWidth: 760 }}>
              <ListTableHeader columns={INVENTORY_GRID_COLUMNS} sx={{ px: 2.75, py: 1.6 }}>
                <span>Produto</span>
                <span>SKU</span>
                <span>Validade</span>
                <span>Qtd / Mín</span>
                <span>Status</span>
                <Box component="span" sx={{ textAlign: 'right' }}>
                  Valor un.
                </Box>
                <span />
              </ListTableHeader>

              {isLoading ? (
                <ListSkeletonRows height={28} px={2.75} py={1.25} />
              ) : rows.length === 0 ? (
                <ListEmptyState
                  icon={Inventory2OutlinedIcon}
                  sx={{ py: 7 }}
                  title={items.length === 0 ? 'Nenhum item no estoque' : 'Nenhum item encontrado com os filtros'}
                  description={
                    items.length === 0
                      ? 'Cadastre produtos e insumos para controlar o estoque.'
                      : 'Tente ajustar a busca ou o filtro.'
                  }
                />
              ) : (
                rows.map((item) => <InventoryListRow key={item.id} item={item} onOpen={() => setDetailId(item.id)} onDelete={() => handleDelete(item)} />)
              )}
            </Box>
          </Box>

          {/* Paginação */}
          {!isLoading && filteredItems.length > 0 && (
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              flexWrap="wrap"
              useFlexGap
              spacing={1.5}
              sx={{ px: 2.75, py: 1.75 }}
            >
              <Typography sx={{ fontSize: fontSizes.sm, color: 'text.disabled', fontWeight: 600 }}>
                Mostrando {rangeStart}–{rangeEnd} de{' '}
                {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'itens'}
                {filteredItems.length !== items.length && ` (de ${items.length})`}
              </Typography>
              {pageCount > 1 && (
                <ListPageButtons
                  page={current}
                  pageCount={pageCount}
                  onChange={setPage}
                  windowed
                  size={34}
                  radius="9px"
                  px={0.75}
                  spacing={0.9}
                  arrowSx={COMPACT_PAGE_ARROW_SX}
                />
              )}
            </Stack>
          )}
        </Card>
      </Stack>

      <InventoryDetailDrawer
        itemId={detailId}
        onClose={() => setDetailId(null)}
        onMovement={openMovement}
        onEdit={canEdit ? openEdit : undefined}
        onDelete={handleDelete}
        onOpenPage={(id) => navigate(`/estoque/${id}`)}
      />
      <InventoryFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        item={editing}
      />
      <MovementDialog
        open={movementOpen}
        onClose={() => setMovementOpen(false)}
        item={movementItem}
        items={items}
      />
      <BulkPurchaseDialog open={bulkOpen} onClose={() => setBulkOpen(false)} />
    </Box>
  );
}
