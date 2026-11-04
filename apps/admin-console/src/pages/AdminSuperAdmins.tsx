import { useState } from 'react';
import { Box, Button, Card, Chip, IconButton, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../api/admin';
import { SuperAdminFormDialog } from '../components/SuperAdminFormDialog';
import { formatDate, formatLastAccess, ROW_ACTION_SX } from '../components/adminUi';
import { superAdminAccessLabel, superAdminRemoveBlockedReason } from '../components/superAdminsUi';
import { LIST_HEADER_ACTION_SX, ListCardHeader } from '../../../../frontend/src/components/ListCardHeader';
import { useAppDialog } from '../../../../frontend/src/contexts/AppDialogContext';
import { useAppToast } from '../../../../frontend/src/contexts/AppToastContext';
import { useAuth } from '../../../../frontend/src/contexts/AuthContext';
import { fontSizes } from '../../../../frontend/src/theme/fontSizes';
import { getApiErrorMessage } from '../../../../frontend/src/utils/apiError';
import type { PlatformSuperAdmin } from '../../../../frontend/src/types';

const QUERY_KEY = ['admin', 'super-admins'];

const GRID_COLS = 'minmax(0, 1.4fr) minmax(0, 1.6fr) minmax(0, 1.2fr) 110px 120px 56px';
const GRID_MIN_WIDTH = 720;

/** Gerenciar quem acessa o console /admin da plataforma. */
export function AdminSuperAdmins() {
  const queryClient = useQueryClient();
  const { confirm } = useAppDialog();
  const toast = useAppToast();
  const { user } = useAuth();
  const [formOpen, setFormOpen] = useState(false);

  const {
    data: admins = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({ queryKey: QUERY_KEY, queryFn: adminApi.listSuperAdmins, retry: false });

  const removeMutation = useMutation({
    mutationFn: (admin: PlatformSuperAdmin) => adminApi.removeSuperAdmin(admin.id),
    onSuccess: (_res, admin) => {
      queryClient.setQueryData<PlatformSuperAdmin[]>(QUERY_KEY, (old) => old?.filter((a) => a.id !== admin.id));
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      toast.success(
        admin.hasClinic
          ? `Permissão de super-admin removida de “${admin.email}” (continua na clínica).`
          : `Super-admin “${admin.email}” removido.`,
      );
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível remover o super-admin.')),
  });

  const handleRemove = async (admin: PlatformSuperAdmin) => {
    if (user?.id === admin.id) {
      toast.error('Você não pode remover a própria permissão.');
      return;
    }
    const ok = await confirm({
      title: 'Remover super-admin',
      message: `Remover a permissão de “${admin.name}” (${admin.email})?`,
      details: admin.hasClinic
        ? [
            'Essa pessoa continua acessando a clínica normalmente.',
            'Sessões ativas no /admin serão encerradas.',
          ]
        : [
            'Conta só da plataforma: será desativada ou excluída conforme o padrão de usuários.',
            'Sessões ativas serão encerradas.',
          ],
      confirmLabel: 'Remover',
      confirmColor: 'error',
    });
    if (ok) removeMutation.mutate(admin);
  };

  const dualCount = admins.filter((a) => a.hasClinic).length;

  return (
    <Box>
      <Card sx={{ p: 0, overflow: 'hidden' }}>
        <ListCardHeader
          title={
            <Typography sx={{ fontSize: fontSizes.md, color: 'text.secondary', fontWeight: 600 }}>
              {isLoading ? (
                <Skeleton width={220} />
              ) : isError ? (
                'Super-admins'
              ) : (
                <>
                  <Box component="span" sx={{ color: 'text.primary', fontWeight: 800 }}>
                    {admins.length}
                  </Box>{' '}
                  {admins.length === 1 ? 'super-admin' : 'super-admins'}
                  {dualCount > 0 && (
                    <Box component="span" sx={{ color: 'text.disabled', fontWeight: 500 }}>
                      {' '}
                      · {dualCount} com login dual
                    </Box>
                  )}
                </>
              )}
            </Typography>
          }
        >
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormOpen(true)} sx={LIST_HEADER_ACTION_SX}>
            Adicionar
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
              {['Nome', 'E-mail', 'Acesso', 'Criado em', 'Último acesso', ''].map((h) => (
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
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} height={48} sx={{ my: 0.5 }} />
                ))}
              </Stack>
            ) : isError ? (
              <Stack alignItems="flex-start" spacing={1.5} sx={{ px: 2.5, py: 3 }}>
                <Typography role="alert" sx={{ color: 'error.main', fontSize: fontSizes.sm }}>
                  {getApiErrorMessage(error, 'Não foi possível carregar os super-admins.')}
                </Typography>
                <Button variant="outlined" size="small" disabled={isFetching} onClick={() => refetch()}>
                  Tentar de novo
                </Button>
              </Stack>
            ) : admins.length === 0 ? (
              <Typography sx={{ px: 2.5, py: 3, color: 'text.secondary', fontSize: fontSizes.sm }}>
                Nenhum super-admin encontrado.
              </Typography>
            ) : (
              admins.map((admin) => {
                const isSelf = user?.id === admin.id;
                const blocked = superAdminRemoveBlockedReason(admin, {
                  currentUserId: user?.id,
                  totalCount: admins.length,
                });
                const accessLabel = superAdminAccessLabel(admin);
                return (
                  <Box
                    key={admin.id}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: GRID_COLS,
                      gap: 1.5,
                      alignItems: 'center',
                      px: 2.5,
                      py: 1.35,
                      borderBottom: 1,
                      borderColor: 'divider',
                      '&:last-child': { borderBottom: 0 },
                    }}
                  >
                    <Typography sx={{ fontWeight: 700, fontSize: fontSizes.sm, color: 'text.primary' }} noWrap>
                      {admin.name}
                      {isSelf && (
                        <Box component="span" sx={{ ml: 0.75, color: 'text.disabled', fontWeight: 500 }}>
                          (você)
                        </Box>
                      )}
                    </Typography>
                    <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary' }} noWrap>
                      {admin.email}
                    </Typography>
                    <Box>
                      <Chip
                        size="small"
                        variant={admin.hasClinic ? 'filled' : 'outlined'}
                        label={accessLabel}
                        sx={{ fontWeight: admin.hasClinic ? 700 : 600, maxWidth: '100%' }}
                      />
                    </Box>
                    <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary' }}>
                      {formatDate(admin.createdAt)}
                    </Typography>
                    <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary' }}>
                      {formatLastAccess(admin.lastAccessAt)}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Tooltip title={blocked ?? 'Remover permissão'}>
                        <span>
                          <IconButton
                            size="small"
                            aria-label={`Remover ${admin.name}`}
                            disabled={!!blocked || removeMutation.isPending}
                            onClick={() => handleRemove(admin)}
                            sx={{ ...ROW_ACTION_SX, color: blocked ? undefined : 'error.main' }}
                          >
                            <PersonRemoveOutlinedIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      </Card>

      <SuperAdminFormDialog open={formOpen} onClose={() => setFormOpen(false)} />
    </Box>
  );
}
