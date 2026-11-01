import { useMemo, useState, type MouseEvent } from 'react';
import { Box, Button, Card, MenuItem, Skeleton, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MemoryOutlinedIcon from '@mui/icons-material/MemoryOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUrlState } from '../hooks/useUrlState';
import {
  ACTIVE_FILTER_CODEC,
  MAINTENANCE_FILTER_CODEC,
  matchFields,
  matchesActiveFilter,
  type ActiveFilter,
  type MaintenanceFilter,
} from '../utils/listFilters';
import { equipmentApi } from '../api/equipment';
import { EquipmentCard } from '../components/equipment/EquipmentCard';
import { EquipmentFormDialog } from '../components/equipment/EquipmentFormDialog';
import { daysUntil, nextMaintenanceOf } from '../components/equipment/equipmentMaintenance';
import {
  LIST_HEADER_PAPER_SELECT_SX,
  LIST_HEADER_PRIMARY_ACTION_SX,
  ListCardHeader,
  ListSearchField,
} from '../components/ListCardHeader';
import { ListPageButtons } from '../components/ListPageButtons';
import { ListEmptyState } from '../components/ListStates';
import { StatCard } from '../components/StatCard';
import { usePagination } from '../hooks/usePagination';
import { useAppDialog } from '../contexts/AppDialogContext';
import { useAppToast } from '../contexts/AppToastContext';
import { getApiErrorMessage } from '../utils/apiError';
import { usePermissions } from '../contexts/usePermissions';
import type { Equipment } from '../types';
import { fontSizes } from '../theme/fontSizes';

const PAGE_SIZE = 12;


export function EquipmentPage() {
  const queryClient = useQueryClient();
  const { confirm } = useAppDialog();
  const toast = useAppToast();
  const { has } = usePermissions();
  const canCreate = has('equipment:create');
  const canEdit = has('equipment:edit');
  const canDelete = has('equipment:delete');

  const [search, setSearch] = useUrlState('busca', '');
  const [activeFilter, setActiveFilter] = useUrlState<ActiveFilter>('status', 'ALL', ACTIVE_FILTER_CODEC);
  const [maintenanceFilter, setMaintenanceFilter] = useUrlState<MaintenanceFilter>('manutencao', 'ALL', MAINTENANCE_FILTER_CODEC);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['equipment'],
    queryFn: () => equipmentApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => equipmentApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast.success('Equipamento excluído.');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Não foi possível excluir o equipamento.'));
    },
  });

  const maintenanceMutation = useMutation({
    mutationFn: (id: string) => equipmentApi.registerMaintenance(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast.success('Manutenção registrada.');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Não foi possível registrar a manutenção.'));
    },
  });

  const isMaintenanceDue = (e: Equipment) => {
    const days = daysUntil(nextMaintenanceOf(e));
    return days != null && days <= 30;
  };

  const stats = useMemo(() => {
    let overdue = 0;
    let upcoming = 0;
    for (const e of items) {
      const days = daysUntil(nextMaintenanceOf(e));
      if (days == null) continue;
      if (days < 0) overdue += 1;
      else if (days <= 30) upcoming += 1;
    }
    return { total: items.length, active: items.filter((e) => e.active).length, overdue, upcoming };
  }, [items]);

  const filteredItems = useMemo(
    () =>
      items.filter((e) => {
        if (!matchesActiveFilter(e.active, activeFilter)) return false;
        if (maintenanceFilter === 'DUE' && !isMaintenanceDue(e)) return false;
        return matchFields(search, e.name, e.brand, e.model);
      }),
    [items, search, activeFilter, maintenanceFilter],
  );

  const { page: current, setPage, pageCount, rows, rangeStart, rangeEnd } = usePagination(
    filteredItems,
    PAGE_SIZE);

  const handleEdit = (e: Equipment) => {
    setEditing(e);
    setFormOpen(true);
  };

  const handleMaintenance = async (ev: MouseEvent, e: Equipment) => {
    ev.stopPropagation();
    const ok = await confirm({
      title: 'Registrar manutenção',
      message: `Registrar manutenção de ${e.name} agora?`,
      confirmLabel: 'Registrar',
    });
    if (ok) maintenanceMutation.mutate(e.id);
  };

  const handleDelete = async (ev: MouseEvent, e: Equipment) => {
    ev.stopPropagation();
    const ok = await confirm({
      title: 'Excluir equipamento',
      message: `Excluir ${e.name}?`,
      confirmLabel: 'Excluir',
      confirmColor: 'error',
    });
    if (ok) deleteMutation.mutate(e.id);
  };

  return (
    <Box>
      {/* Cards de estatística */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: { xs: 1.5, sm: 2 },
          mb: { xs: 2, sm: 2.5 },
        }}
      >
        <StatCard label="Equipamentos" value={stats.total} loading={isLoading} />
        <StatCard label="Operacionais" value={stats.active} color="success.main" loading={isLoading} />
        <StatCard label="Manut. atrasada" value={stats.overdue} color="warning.main" loading={isLoading} />
        <StatCard label="Manut. próx. 30d" value={stats.upcoming} loading={isLoading} />
      </Box>

      {/* Título + filtros + ações */}
      <ListCardHeader
        nowrapFrom="md"
        sx={{ px: 0, py: 0, borderBottom: 0, mb: 2.5 }}
        title={<Typography sx={{ fontSize: fontSizes.xl, fontWeight: 700 }}>Equipamentos</Typography>}
      >
        <TextField
          select
          size="small"
          value={maintenanceFilter}
          onChange={(e) => {
            setMaintenanceFilter(e.target.value as MaintenanceFilter);
            setPage(0);
          }}
          sx={LIST_HEADER_PAPER_SELECT_SX}
          inputProps={{ 'aria-label': 'Manutenção' }}
        >
          <MenuItem value="ALL">Todas as manutenções</MenuItem>
          <MenuItem value="DUE">Próxima ou atrasada</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          value={activeFilter}
          onChange={(e) => {
            setActiveFilter(e.target.value as ActiveFilter);
            setPage(0);
          }}
          sx={LIST_HEADER_PAPER_SELECT_SX}
          inputProps={{ 'aria-label': 'Status' }}
        >
          <MenuItem value="ALL">Todos os status</MenuItem>
          <MenuItem value="ACTIVE">Ativos</MenuItem>
          <MenuItem value="INACTIVE">Inativos</MenuItem>
        </TextField>
        <ListSearchField
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(0);
          }}
          placeholder="Buscar equipamento..."
        />
        {canCreate && (
          <Button data-tour="equipment-new"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            sx={LIST_HEADER_PRIMARY_ACTION_SX}
          >
            Adicionar equipamento
          </Button>
        )}
      </ListCardHeader>

      {/* Lista de cards */}
      {isLoading ? (
        <Box data-tour="equipment-list" sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 2.25 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={250} sx={{ borderRadius: '18px' }} />
          ))}
        </Box>
      ) : filteredItems.length === 0 ? (
        <Card sx={{ borderRadius: '18px' }}>
          <ListEmptyState
            icon={MemoryOutlinedIcon}
            sx={{ p: 6 }}
            title={items.length === 0 ? 'Nenhum equipamento cadastrado' : 'Nenhum equipamento encontrado'}
            description={
              items.length === 0
                ? 'Cadastre as máquinas da clínica para controlar a manutenção preventiva.'
                : 'Tente ajustar a busca ou os filtros.'
            }
          />
        </Card>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 2.25 }}>
          {rows.map((e) => (
            <EquipmentCard
              key={e.id}
              equipment={e}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={() => handleEdit(e)}
              onMaintenance={(ev) => handleMaintenance(ev, e)}
              onDelete={(ev) => handleDelete(ev, e)}
            />
          ))}
        </Box>
      )}

      {/* Paginação */}
      {!isLoading && filteredItems.length > 0 && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems="center"
          justifyContent="space-between"
          spacing={1.5}
          sx={{ mt: 3 }}
        >
          <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary' }}>
            Mostrando {rangeStart}–{rangeEnd} de{' '}
            {filteredItems.length}
            {filteredItems.length !== items.length && ` (${items.length} no total)`}
          </Typography>
          {pageCount > 1 && (
            <ListPageButtons
              page={current}
              pageCount={pageCount}
              onChange={setPage}
              size={38}
              radius="10px"
              px={1}
              spacing={1}
              fontSize={fontSizes.md}
              wrapJustify={{ xs: 'center', sm: 'flex-end' }}
            />
          )}
        </Stack>
      )}
      <EquipmentFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        equipment={editing}
      />
    </Box>
  );
}
