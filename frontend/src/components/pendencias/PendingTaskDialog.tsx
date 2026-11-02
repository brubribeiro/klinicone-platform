import { useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  FormControlLabel,
  MenuItem,
  Switch,
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { pendenciasApi, type PendingTaskPayload } from '../../api/pendencias';
import { usersApi } from '../../api/users';
import { useAppDialog } from '../../contexts/AppDialogContext';
import { useAppToast } from '../../contexts/AppToastContext';
import { getApiErrorMessage } from '../../utils/apiError';
import { AuroraIcon } from '../AuroraIcon';
import { DialogHeader, dialogActionsBorderSx, dialogPaperSx, formSwitchLabelSx } from '../DialogCloseButton';
import { LabeledField } from '../LabeledField';
import type { PendingCategory, PendingItem } from '../../types';
import { CATEGORY_OPTIONS } from './pendenciasUtils';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pendência manual em edição (vinda da lista). */
  editing?: PendingItem | null;
  canDelete?: boolean;
}

interface FormValues {
  title: string;
  description: string;
  category: PendingCategory;
  dueDate: string;
  urgent: boolean;
  assigneeId: string;
}

const DIALOG_MAX_WIDTH = 560;

const EMPTY: FormValues = {
  title: '',
  description: '',
  category: 'ADMINISTRATIVE',
  dueDate: '',
  urgent: false,
  assigneeId: '',
};

export function PendingTaskDialog({ open, onClose, editing, canDelete }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const { confirm } = useAppDialog();

  const { control, handleSubmit, reset } = useForm<FormValues>({ defaultValues: EMPTY });

  const { data: users = [] } = useQuery({
    queryKey: ['users', 'active'],
    queryFn: () => usersApi.listActive(),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      editing
        ? {
            title: editing.title,
            description: editing.description ?? '',
            category: editing.category,
            dueDate: editing.dueDate ?? '',
            urgent: editing.urgent,
            assigneeId: editing.assignee?.id ?? '',
          }
        : EMPTY,
    );
  }, [open, editing, reset]);

  const onSaved = (message: string) => {
    queryClient.invalidateQueries({ queryKey: ['pendencias'] });
    toast.success(message);
    onClose();
  };

  const saveMutation = useMutation({
    mutationFn: (payload: PendingTaskPayload) =>
      editing?.taskId ? pendenciasApi.update(editing.taskId, payload) : pendenciasApi.create(payload),
    onSuccess: () => onSaved(editing ? 'Pendência atualizada.' : 'Pendência criada.'),
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível salvar a pendência.')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pendenciasApi.remove(id),
    onSuccess: () => onSaved('Pendência excluída.'),
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível excluir a pendência.')),
  });

  const onSubmit = (values: FormValues) => {
    saveMutation.mutate({
      title: values.title.trim(),
      description: values.description.trim() || null,
      category: values.category,
      dueDate: values.dueDate || null,
      urgent: values.urgent,
      assigneeId: values.assigneeId || null,
    });
  };

  const handleDelete = async () => {
    if (!editing?.taskId) return;
    const ok = await confirm({
      title: 'Excluir pendência',
      message: `Excluir a pendência "${editing.title}"?`,
      confirmLabel: 'Excluir',
      confirmColor: 'error',
    });
    if (ok) deleteMutation.mutate(editing.taskId);
  };

  const saving = saveMutation.isPending || deleteMutation.isPending;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          ...dialogPaperSx(isMobile),
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          ...(isMobile
            ? { height: '100%', maxHeight: '100dvh' }
            : { maxWidth: DIALOG_MAX_WIDTH, maxHeight: '94dvh', overflow: 'hidden' }),
        },
      }}
    >
      <Box
        component="form"
        onSubmit={handleSubmit(onSubmit)}
        sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, ...(isMobile ? { height: '100%' } : {}) }}
      >
        <DialogHeader
          onClose={onClose}
          isMobile={isMobile}
          title={editing ? 'Editar pendência' : 'Nova pendência'}
          subtitle={editing ? editing.title : 'Tarefa manual com responsável e prazo'}
          icon={editing ? <EditOutlinedIcon fontSize="small" /> : <AuroraIcon name="pendencias" size={20} />}
        />
        <DialogContent
          sx={{
            px: { xs: 2, sm: 3 },
            pb: { xs: 2, sm: 2.5 },
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            '&.MuiDialogContent-root': { pt: { xs: 2.75, sm: 3 } },
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
            <Controller
              name="title"
              control={control}
              rules={{ validate: (v) => !!v.trim() || 'Título é obrigatório' }}
              render={({ field, fieldState }) => (
                <LabeledField label="Título" required>
                  <TextField
                    {...field}
                    placeholder="Ex.: Renovar alvará sanitário"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    inputProps={{ maxLength: 120 }}
                    fullWidth
                    autoFocus={!editing}
                  />
                </LabeledField>
              )}
            />
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <LabeledField label="Descrição">
                  <TextField {...field} multiline minRows={2} maxRows={5} inputProps={{ maxLength: 500 }} fullWidth />
                </LabeledField>
              )}
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <LabeledField label="Categoria" required>
                    <TextField {...field} select fullWidth>
                      {CATEGORY_OPTIONS.map((c) => (
                        <MenuItem key={c.value} value={c.value}>
                          {c.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </LabeledField>
                )}
              />
              <Controller
                name="dueDate"
                control={control}
                render={({ field }) => (
                  <LabeledField label="Prazo">
                    <TextField {...field} type="date" fullWidth />
                  </LabeledField>
                )}
              />
            </Box>
            <Controller
              name="assigneeId"
              control={control}
              render={({ field }) => (
                <LabeledField label="Responsável">
                  <TextField {...field} select fullWidth>
                    <MenuItem value="">
                      <em>Sem responsável</em>
                    </MenuItem>
                    {users.map((u) => (
                      <MenuItem key={u.id} value={u.id}>
                        {u.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </LabeledField>
              )}
            />
            <Controller
              name="urgent"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  sx={formSwitchLabelSx}
                  control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                  label="Marcar como urgente"
                />
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ ...dialogActionsBorderSx, flexShrink: 0 }}>
          {editing && canDelete && (
            <Button
              type="button"
              color="error"
              startIcon={<DeleteOutlineIcon />}
              onClick={handleDelete}
              disabled={saving}
              sx={{ mr: 'auto' }}
            >
              Excluir
            </Button>
          )}
          <Button onClick={onClose} type="button" disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? 'Salvando…' : editing ? 'Salvar' : 'Criar pendência'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
