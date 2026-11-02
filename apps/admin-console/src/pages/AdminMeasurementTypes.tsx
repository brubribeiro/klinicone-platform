import { useState } from 'react';
import { Box, Button, Card, Chip, IconButton, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import BlockIcon from '@mui/icons-material/Block';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../api/admin';
import { MeasurementTypeFormDialog } from '../components/MeasurementTypeFormDialog';
import { ROW_ACTION_SX } from '../components/adminUi';
import { LIST_HEADER_ACTION_SX, ListCardHeader } from '../../../../frontend/src/components/ListCardHeader';
import { useAppDialog } from '../../../../frontend/src/contexts/AppDialogContext';
import { useAppToast } from '../../../../frontend/src/contexts/AppToastContext';
import { fontSizes } from '../../../../frontend/src/theme/fontSizes';
import { getApiErrorMessage } from '../../../../frontend/src/utils/apiError';
import type { MeasurementType } from '../../../../frontend/src/types';

const QUERY_KEY = ['admin', 'measurement-types'];

const GRID_COLS = '72px minmax(0, 1.6fr) 80px minmax(0, 1fr) 136px';
const GRID_MIN_WIDTH = 640;

/** Tipos de medida do card "Medidas corporais" (catálogo global; peso e altura são fixos). */
export function AdminMeasurementTypes() {
  const queryClient = useQueryClient();
  const { confirm } = useAppDialog();
  const toast = useAppToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MeasurementType | null>(null);

  const { data: types = [], isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: adminApi.listMeasurementTypes });

  const onChanged = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
    queryClient.invalidateQueries({ queryKey: ['measurement-types'] });
  };

  const activeMutation = useMutation({
    mutationFn: ({ type, active }: { type: MeasurementType; active: boolean }) =>
      adminApi.setMeasurementTypeActive(type.id, active),
    onSuccess: (updated, { active }) => {
      queryClient.setQueryData<MeasurementType[]>(QUERY_KEY, (old) =>
        old?.map((t) => (t.id === updated.id ? { ...t, active: updated.active } : t)),
      );
      onChanged();
      toast.success(active ? `“${updated.name}” ativada.` : `“${updated.name}” desativada.`);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível alterar a medida.')),
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => adminApi.reorderMeasurementTypes(ids),
    onMutate: (ids) => {
      const previous = queryClient.getQueryData<MeasurementType[]>(QUERY_KEY);
      queryClient.setQueryData<MeasurementType[]>(QUERY_KEY, (old) =>
        ids.map((id, sortOrder) => ({ ...old!.find((t) => t.id === id)!, sortOrder })),
      );
      return { previous };
    },
    onSuccess: (list) => {
      queryClient.setQueryData(QUERY_KEY, list);
      onChanged();
    },
    onError: (err, _ids, ctx) => {
      queryClient.setQueryData(QUERY_KEY, ctx?.previous);
      toast.error(getApiErrorMessage(err, 'Não foi possível reordenar.'));
    },
  });

  const removeMutation = useMutation({
    mutationFn: (type: MeasurementType) => adminApi.removeMeasurementType(type.id),
    onSuccess: (_res, type) => {
      queryClient.setQueryData<MeasurementType[]>(QUERY_KEY, (old) => old?.filter((t) => t.id !== type.id));
      onChanged();
      toast.success(`“${type.name}” excluída.`);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível excluir a medida.')),
  });

  const move = (index: number, delta: number) => {
    const ids = types.map((t) => t.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    reorderMutation.mutate(ids);
  };

  const toggleActive = async (type: MeasurementType) => {
    if (type.active) {
      const ok = await confirm({
        title: 'Desativar medida',
        message: `Desativar “${type.name}”?`,
        details: [
          'Deixa de aparecer ao registrar medidas nas clínicas.',
          'Valores já registrados continuam visíveis no histórico das pacientes.',
        ],
        confirmLabel: 'Desativar',
        confirmColor: 'error',
      });
      if (ok) activeMutation.mutate({ type, active: false });
    } else {
      activeMutation.mutate({ type, active: true });
    }
  };

  const handleRemove = async (type: MeasurementType) => {
    const ok = await confirm({
      title: 'Excluir medida',
      message: `Excluir “${type.name}”?`,
      confirmLabel: 'Excluir',
      confirmColor: 'error',
    });
    if (ok) removeMutation.mutate(type);
  };

  const openForm = (type: MeasurementType | null) => {
    setEditing(type);
    setFormOpen(true);
  };

  const activeCount = types.filter((t) => t.active).length;

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
                    {types.length}
                  </Box>{' '}
                  {types.length === 1 ? 'medida' : 'medidas'} · {activeCount} ativa{activeCount === 1 ? '' : 's'}
                  <Box component="span" sx={{ color: 'text.disabled', fontWeight: 500 }}>
                    {' '}
                    · IMC é calculado de peso e altura
                  </Box>
                </>
              )}
            </Typography>
          }
        >
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openForm(null)} sx={LIST_HEADER_ACTION_SX}>
            Nova medida
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
              {['Ordem', 'Nome', 'Unidade', 'Registros', ''].map((h) => (
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
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} height={48} sx={{ my: 0.5 }} />
                ))}
              </Stack>
            ) : (
              types.map((type, index) => {
                const basic = !!type.key;
                return (
                  <Box
                    key={type.id}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: GRID_COLS,
                      gap: 1.5,
                      alignItems: 'center',
                      px: 2.5,
                      py: 1.35,
                      borderBottom: 1,
                      borderColor: 'grey.100',
                      '&:last-of-type': { borderBottom: 0 },
                    }}
                  >
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Subir">
                        <span>
                          <IconButton
                            aria-label={`Subir ${type.name}`}
                            disabled={index === 0 || reorderMutation.isPending}
                            onClick={() => move(index, -1)}
                            sx={ROW_ACTION_SX}
                          >
                            <ArrowUpwardIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Descer">
                        <span>
                          <IconButton
                            aria-label={`Descer ${type.name}`}
                            disabled={index === types.length - 1 || reorderMutation.isPending}
                            onClick={() => move(index, 1)}
                            sx={ROW_ACTION_SX}
                          >
                            <ArrowDownwardIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={1}
                      sx={{ minWidth: 0, opacity: type.active ? 1 : 0.55 }}
                    >
                      <Typography noWrap sx={{ fontSize: fontSizes.md, fontWeight: 600 }}>
                        {type.name}
                      </Typography>
                      {basic && (
                        <Chip
                          size="small"
                          color="primary"
                          variant="outlined"
                          label="Básica"
                          sx={{ height: 20, fontSize: fontSizes['2xs'], fontWeight: 700 }}
                        />
                      )}
                      {!type.active && (
                        <Chip size="small" label="Inativa" sx={{ height: 20, fontSize: fontSizes['2xs'], fontWeight: 700 }} />
                      )}
                    </Stack>
                    <Typography sx={{ fontSize: fontSizes.sm, opacity: type.active ? 1 : 0.55 }}>{type.unit}</Typography>
                    <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                      {basic ? '—' : (type.valuesCount ?? 0)}
                    </Typography>
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      {basic ? (
                        <Typography sx={{ fontSize: fontSizes.xs, color: 'text.disabled' }}>Sempre ativa</Typography>
                      ) : (
                        <>
                          <Tooltip title="Editar">
                            <IconButton aria-label={`Editar ${type.name}`} onClick={() => openForm(type)} sx={ROW_ACTION_SX}>
                              <EditIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={type.active ? 'Desativar' : 'Ativar'}>
                            <IconButton
                              aria-label={`${type.active ? 'Desativar' : 'Ativar'} ${type.name}`}
                              disabled={activeMutation.isPending}
                              onClick={() => toggleActive(type)}
                              sx={{ ...ROW_ACTION_SX, color: type.active ? 'error.main' : 'success.main' }}
                            >
                              {type.active ? (
                                <BlockIcon sx={{ fontSize: 16 }} />
                              ) : (
                                <PlayCircleOutlineIcon sx={{ fontSize: 16 }} />
                              )}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={type.valuesCount ? 'Tem valores registrados: só pode ser desativada' : 'Excluir'}>
                            <span>
                              <IconButton
                                aria-label={`Excluir ${type.name}`}
                                disabled={!!type.valuesCount || removeMutation.isPending}
                                onClick={() => handleRemove(type)}
                                sx={ROW_ACTION_SX}
                              >
                                <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </>
                      )}
                    </Stack>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      </Card>

      <MeasurementTypeFormDialog open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
    </Box>
  );
}
