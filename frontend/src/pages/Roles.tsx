import { useMemo, useState } from 'react';
import {
  alpha,
  Box,
  Button,
  ButtonBase,
  Card,
  IconButton,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { PageHeader } from '../components/PageHeader';
import { rolesApi } from '../api/roles';
import { RoleFormDialog } from '../components/roles/RoleFormDialog';
import { PermissionsMatrix } from '../components/roles/PermissionsMatrix';
import { roleColor } from '../components/roles/roleColors';
import { useAppDialog } from '../contexts/AppDialogContext';
import { useAppToast } from '../contexts/AppToastContext';
import { getApiErrorMessage } from '../utils/apiError';
import { usePermissions } from '../contexts/usePermissions';
import { ALL_PERMISSIONS, countCatalogPermissions, SYSTEM_ADMIN_ROLE_NAME } from '../contexts/permissions';
import type { Role } from '../types';
import { fontSizes } from '../theme/fontSizes';

const ACTION_BUTTON_SX = {
  width: 30,
  height: 30,
  borderRadius: '9px',
  border: 1,
  borderColor: 'divider',
  color: 'text.secondary',
} as const;

function sameSet(a: readonly string[], b: readonly string[]) {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((p) => set.has(p));
}

function membersLabel(count: number) {
  return `${count} ${count === 1 ? 'membro' : 'membros'}`;
}

function ShieldIcon({ size = 19 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l7 2.8v5.2c0 4.6-3.1 7.6-7 9.2-3.9-1.6-7-4.6-7-9.2V5.8z" />
      <path d="M9 11.8l2 2 3.6-3.8" />
    </svg>
  );
}

function RoleCard({
  role,
  color,
  active,
  onClick,
}: {
  role: Role;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  const theme = useTheme();
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={active}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 1.375,
        width: '100%',
        textAlign: 'left',
        bgcolor: 'background.paper',
        borderRadius: '14px',
        px: 2,
        py: 1.75,
        border: 1,
        borderColor: active ? 'primary.main' : 'divider',
        boxShadow: active
          ? `0 0 0 3px ${alpha(theme.palette.primary.main, 0.14)}`
          : '0 1px 2px rgba(16,40,37,.04),0 8px 24px -12px rgba(16,40,37,.10)',
        transition: 'border-color .15s, box-shadow .15s',
        '&:hover': { borderColor: active ? 'primary.main' : 'grey.300' },
      }}
    >
      <Box
        sx={{
          width: 38,
          height: 38,
          borderRadius: '11px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: alpha(color, 0.1),
          color,
        }}
      >
        <ShieldIcon />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
        <Typography noWrap sx={{ fontSize: fontSizes.sm, fontWeight: 800, color: 'text.primary' }}>
          {role.name}
        </Typography>
        <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', fontWeight: 600 }}>
          {membersLabel(role._count?.users ?? 0)}
        </Typography>
      </Box>
      {role.isSystem && (
        <Tooltip title="Grupo do sistema (não pode ser excluído)">
          <LockOutlinedIcon role="img" aria-hidden={false} sx={{ fontSize: 16, color: 'text.disabled' }} />
        </Tooltip>
      )}
    </ButtonBase>
  );
}

export function Roles() {
  const queryClient = useQueryClient();
  const { confirm } = useAppDialog();
  const toast = useAppToast();
  const { has } = usePermissions();
  const canCreate = has('roles:create');
  const canEdit = has('roles:edit');
  const canDelete = has('roles:delete');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ roleId: string; permissions: string[] } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesApi.list(),
  });

  const selectedIndex = Math.max(0, roles.findIndex((r) => r.id === selectedId));
  const selected = roles[selectedIndex] as Role | undefined;

  const isAdminRole = selected?.name === SYSTEM_ADMIN_ROLE_NAME;
  const matrixEditable = canEdit && !!selected && !isAdminRole;
  const permissions =
    draft && draft.roleId === selected?.id ? draft.permissions : selected?.permissions ?? [];
  const dirty = !!selected && !!draft && draft.roleId === selected.id && !sameSet(draft.permissions, selected.permissions);
  const selectedCount = useMemo(() => countCatalogPermissions(permissions), [permissions]);

  const selectRole = async (id: string) => {
    if (id === selected?.id) return;
    if (dirty) {
      const ok = await confirm({
        title: 'Descartar alterações',
        message: `As permissões de ${selected?.name} não foram salvas. Descartar as alterações?`,
        confirmLabel: 'Descartar',
        confirmColor: 'warning',
      });
      if (!ok) return;
    }
    setDraft(null);
    setSelectedId(id);
  };

  const savePermissionsMutation = useMutation({
    mutationFn: ({ id, perms }: { id: string; perms: string[] }) =>
      rolesApi.update(id, { permissions: perms }),
    onSuccess: (updated) => {
      queryClient.setQueryData<Role[]>(['roles'], (prev) =>
        prev?.map((r) => (r.id === updated.id ? { ...r, ...updated, _count: r._count } : r)),
      );
      setDraft(null);
      toast.success('Permissões atualizadas.');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Não foi possível salvar as permissões.'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rolesApi.remove(id),
    onSuccess: () => {
      setDraft(null);
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Grupo excluído.');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Não foi possível excluir o grupo.'));
    },
  });

  const handleDelete = async (role: Role) => {
    const ok = await confirm({
      title: 'Excluir grupo',
      message: `Excluir o grupo ${role.name}?`,
      confirmLabel: 'Excluir',
      confirmColor: 'error',
    });
    if (ok) deleteMutation.mutate(role.id);
  };

  return (
    <Box>
      <PageHeader
        title="Grupos e permissões"
        subtitle="Defina o que cada grupo pode acessar, criar, editar e excluir"
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '300px 1fr' },
          gap: 2.25,
          alignItems: 'start',
        }}
      >
        <Stack spacing={1.25}>
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} variant="rounded" height={68} sx={{ borderRadius: '14px' }} />
              ))
            : roles.map((r, i) => (
                <RoleCard
                  key={r.id}
                  role={r}
                  color={roleColor(r, i)}
                  active={r.id === selected?.id}
                  onClick={() => selectRole(r.id)}
                />
              ))}
          {canCreate && (
            <Button
              variant="outlined"
              fullWidth
              startIcon={<AddIcon />}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              sx={{
                height: 46,
                borderRadius: '14px',
                fontSize: fontSizes.sm,
                fontWeight: 700,
                borderColor: 'divider',
                color: 'text.primary',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
                },
              }}
            >
              Novo grupo
            </Button>
          )}
        </Stack>

        <Card sx={{ overflow: 'hidden', p: 0 }}>
          <Box
            sx={{
              px: { xs: 2, sm: 2.75 },
              py: 2.25,
              borderBottom: 1,
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: 1.5,
            }}
          >
            <Box sx={{ flex: 1, minWidth: 220 }}>
              {selected ? (
                <>
                  <Typography component="h3" sx={{ fontSize: fontSizes.xl, fontWeight: 700 }}>
                    Permissões — {selected.name}
                  </Typography>
                  {selected.description?.trim() ? (
                    <Typography sx={{ mt: 0.35, fontSize: fontSizes.sm, color: 'text.secondary', lineHeight: 1.45 }}>
                      {selected.description}
                    </Typography>
                  ) : null}
                  <Typography
                    component="p"
                    sx={{
                      mt: selected.description?.trim() ? 0.5 : 0.35,
                      fontSize: fontSizes.xs,
                      fontWeight: 600,
                      color: 'text.disabled',
                      lineHeight: 1.4,
                    }}
                  >
                    {selectedCount} de {ALL_PERMISSIONS.length} permissões
                    <Box component="span" aria-hidden sx={{ mx: 0.65 }}>
                      ·
                    </Box>
                    {membersLabel(selected._count?.users ?? 0)}
                    {selected.restrictToOwnAppointments && (
                      <>
                        <Box component="span" aria-hidden sx={{ mx: 0.65 }}>
                          ·
                        </Box>
                        <Box component="span" sx={{ color: 'warning.main', fontWeight: 700 }}>
                          Só a própria agenda
                        </Box>
                      </>
                    )}
                  </Typography>
                </>
              ) : (
                <Skeleton variant="text" width={260} sx={{ fontSize: fontSizes['2xl'] }} />
              )}
            </Box>
            {selected && (
              <Stack
                direction="row"
                spacing={0.75}
                useFlexGap
                flexWrap="wrap"
                justifyContent="flex-end"
                alignItems="center"
                sx={{ flexShrink: 0 }}
              >
                {dirty && (
                  <>
                    <Typography sx={{ fontSize: fontSizes.xs, color: 'warning.dark', fontWeight: 700, mr: 0.5 }}>
                      Alterações não salvas
                    </Typography>
                    <Button size="small" onClick={() => setDraft(null)} disabled={savePermissionsMutation.isPending}>
                      Descartar
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={savePermissionsMutation.isPending}
                      onClick={() => savePermissionsMutation.mutate({ id: selected.id, perms: permissions })}
                    >
                      {savePermissionsMutation.isPending ? 'Salvando…' : 'Salvar permissões'}
                    </Button>
                  </>
                )}
                {canEdit && (
                  <Tooltip title="Editar grupo">
                    <IconButton
                      aria-label={`Editar grupo ${selected.name}`}
                      size="small"
                      sx={ACTION_BUTTON_SX}
                      onClick={() => {
                        setEditing(selected);
                        setFormOpen(true);
                      }}
                    >
                      <EditOutlinedIcon sx={{ fontSize: 17 }} />
                    </IconButton>
                  </Tooltip>
                )}
                {canDelete && !selected.isSystem && (
                  <Tooltip title="Excluir grupo">
                    <IconButton aria-label={`Excluir grupo ${selected.name}`} size="small" sx={ACTION_BUTTON_SX} onClick={() => handleDelete(selected)}>
                      <DeleteOutlineIcon sx={{ fontSize: 17 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            )}
          </Box>

          <PermissionsMatrix
            value={permissions}
            readOnly={!matrixEditable}
            onChange={(next) => selected && setDraft({ roleId: selected.id, permissions: next })}
          />

          {isAdminRole && (
            <Typography
              sx={{
                px: { xs: 2, sm: 2.75 },
                py: 1.5,
                borderTop: 1,
                borderColor: 'divider',
                fontSize: fontSizes.xs,
                color: 'text.secondary',
              }}
            >
              O grupo Administrador sempre tem acesso total; as permissões não podem ser removidas.
            </Typography>
          )}

          {matrixEditable && (
            <Typography
              sx={{
                px: { xs: 2, sm: 2.75 },
                py: 1.5,
                borderTop: 1,
                borderColor: 'divider',
                fontSize: fontSizes.xs,
                color: 'text.secondary',
              }}
            >
              Clique numa célula para marcar ou desmarcar; no nome do módulo ou da coluna, marca a linha ou a
              coluna inteira.
            </Typography>
          )}
        </Card>
      </Box>

      <RoleFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        role={editing}
        roles={roles}
        onSaved={(saved) => {
          if (!editing) {
            // Coloca o grupo novo no cache antes de selecioná-lo, para a matriz não piscar até o refetch.
            queryClient.setQueryData<Role[]>(['roles'], (prev) =>
              prev && !prev.some((r) => r.id === saved.id)
                ? [...prev, { ...saved, _count: { users: 0 } }]
                : prev,
            );
            setDraft(null);
            setSelectedId(saved.id);
          }
        }}
      />
    </Box>
  );
}
