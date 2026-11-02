import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Alert,
  alpha,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  FormControlLabel,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckIcon from '@mui/icons-material/Check';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { usersApi, UserPayload } from '../../api/users';
import { rolesApi } from '../../api/roles';
import { useAppToast } from '../../contexts/AppToastContext';
import { getApiErrorMessage } from '../../utils/apiError';
import { EMAIL_PATTERN } from '../../utils/masks';
import { ALL_PERMISSIONS, countCatalogPermissions } from '../../contexts/permissions';
import { DialogHeader, dialogActionsBorderSx, dialogPaperSx, formSwitchLabelSx } from '../DialogCloseButton';
import type { UserSummary } from '../../types';
import { fontSizes } from '../../theme/fontSizes';

interface ProfessionalFormDialogProps {
  open: boolean;
  onClose: () => void;
  user?: UserSummary | null;
}

type FormValues = {
  name: string;
  email: string;
  roleId: string;
  active: boolean;
  providesAppointments: boolean;
  isPrimary: boolean;
  specialty: string;
  councilRegister: string;
  calendarColor: string;
  bio: string;
};

const empty: FormValues = {
  name: '',
  email: '',
  roleId: '',
  active: true,
  providesAppointments: true,
  isPrimary: false,
  specialty: '',
  councilRegister: '',
  calendarColor: '',
  bio: '',
};

const COLOR_SWATCHES = ['#15998B', '#E0915B', '#5BA8DE', '#D46B8A', '#9B7BD4', '#4FB3A8', '#C99230', '#5A9A7D'];

const DIALOG_MAX_WIDTH = 900;
const DIALOG_HEIGHT_DESKTOP = 720;

const FORM_CARD_SX = {
  p: { xs: 1.5, sm: 1.75 },
  borderRadius: 2,
  borderColor: 'divider',
  bgcolor: 'background.paper',
  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
  height: '100%',
} as const;

function SectionTitle({ title }: { icon?: ReactNode; title: string }) {
  return (
    <Typography
      sx={{
        display: 'block',
        mb: 1.75,
        fontSize: fontSizes.xs,
        fontWeight: 800,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'text.disabled',
      }}
    >
      {title}
    </Typography>
  );
}

function SubsectionLabel({ children }: { children: ReactNode }) {
  return (
    <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
      {children}
    </Typography>
  );
}

export function ProfessionalFormDialog({ open, onClose, user }: ProfessionalFormDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const { control, handleSubmit, reset, watch, setValue } = useForm<FormValues>({
    defaultValues: empty,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesApi.list(),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setPhotoPreview(user?.photoUrl ?? null);
    reset(
      user
        ? {
            name: user.name,
            email: user.email,
            roleId: user.roleId,
            active: user.active,
            providesAppointments: user.providesAppointments ?? true,
            isPrimary: user.isPrimary ?? false,
            specialty: user.specialty ?? '',
            councilRegister: user.councilRegister ?? '',
            calendarColor: user.calendarColor ?? '',
            bio: user.bio ?? '',
          }
        : empty,
    );
  }, [open, user, reset]);

  const providesAppointments = watch('providesAppointments');
  const active = watch('active');
  const nameValue = watch('name');
  const calendarColor = watch('calendarColor');
  const selectedRoleId = watch('roleId');
  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const selectedPermissionCount = selectedRole ? countCatalogPermissions(selectedRole.permissions) : 0;

  const photoUpload = useMutation({
    mutationFn: (file: File) => usersApi.uploadPhoto(user!.id, file),
    onSuccess: (updated) => {
      setPhotoPreview(updated.photoUrl ?? null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Foto atualizada.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível enviar a foto.')),
  });

  const photoRemove = useMutation({
    mutationFn: () => usersApi.removePhoto(user!.id),
    onSuccess: () => {
      setPhotoPreview(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Foto removida.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível remover a foto.')),
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: UserPayload = {
        name: values.name.trim(),
        email: values.email.trim(),
        roleId: values.roleId,
        active: values.active,
        providesAppointments: values.providesAppointments,
        isPrimary: values.providesAppointments ? values.isPrimary : false,
        specialty: values.specialty.trim() || null,
        councilRegister: values.councilRegister.trim() || null,
        calendarColor: values.calendarColor || null,
        bio: values.bio.trim() || null,
      };
      if (user) return usersApi.update(user.id, payload);
      return usersApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'appointment-providers'] });
      queryClient.invalidateQueries({ queryKey: ['available-professionals'] });
      toast.success(user ? 'Profissional atualizado.' : 'Profissional criado.');
      onClose();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Não foi possível salvar o profissional.'));
    },
  });

  const photoBusy = photoUpload.isPending || photoRemove.isPending;

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
            : {
                maxWidth: DIALOG_MAX_WIDTH,
                height: DIALOG_HEIGHT_DESKTOP,
                maxHeight: '94dvh',
                overflow: 'hidden',
              }),
        },
      }}
    >
      <Box
        component="form"
        noValidate
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          ...(isMobile ? { height: '100%' } : {}),
        }}
      >
        <DialogHeader
          onClose={onClose}
          isMobile={isMobile}
          title={user ? 'Editar profissional' : 'Novo profissional'}
          subtitle={user ? `${user.name} · ${user.email}` : 'Dados de acesso, perfil e agenda'}
          icon={user ? <EditOutlinedIcon fontSize="small" /> : <PersonAddOutlinedIcon fontSize="small" />}
          trailing={
            !isCompact && selectedPermissionCount > 0 ? (
              <Chip
                size="small"
                label={`${selectedPermissionCount} de ${ALL_PERMISSIONS.length}`}
                variant="outlined"
                sx={{ flexShrink: 0 }}
              />
            ) : undefined
          }
        />

        <DialogContent
          dividers
          sx={{
            px: { xs: 2, sm: 3 },
            py: { xs: 2, sm: 2.5 },
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: (t) => t.palette.background.default,
          }}
        >
          <Grid container spacing={2.5} alignItems="stretch">
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={FORM_CARD_SX}>
                <SectionTitle icon={<LabelOutlinedIcon fontSize="small" />} title="Identificação e acesso" />

                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Controller
                      name="name"
                      control={control}
                      rules={{ required: 'Nome é obrigatório' }}
                      render={({ field, fieldState }) => (
                        <TextField
                          {...field}
                          label="Nome completo"
                          fullWidth
                          required
                          autoFocus={!user}
                          error={!!fieldState.error}
                          helperText={fieldState.error?.message}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Controller
                      name="email"
                      control={control}
                      rules={{
                        required: 'E-mail é obrigatório',
                        pattern: { value: EMAIL_PATTERN, message: 'E-mail inválido' },
                      }}
                      render={({ field, fieldState }) => (
                        <TextField
                          {...field}
                          type="email"
                          label="E-mail"
                          fullWidth
                          required
                          inputProps={{ inputMode: 'email', autoComplete: 'off' }}
                          error={!!fieldState.error}
                          helperText={fieldState.error?.message}
                        />
                      )}
                    />
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />

                <SubsectionLabel>Grupo e permissões</SubsectionLabel>
                <Controller
                  name="roleId"
                  control={control}
                  rules={{ required: 'Selecione um grupo' }}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      select
                      label="Grupo"
                      fullWidth
                      required
                      error={!!fieldState.error}
                      helperText={
                        fieldState.error?.message ??
                        (selectedRole
                          ? `${selectedPermissionCount} de ${ALL_PERMISSIONS.length} permissões neste grupo`
                          : 'Define o que este profissional pode acessar na plataforma')
                      }
                    >
                      {roles.map((r) => (
                        <MenuItem key={r.id} value={r.id}>
                          {r.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />

                {selectedRole?.description && (
                  <Alert severity="info" sx={{ mt: 2, py: 0.75 }}>
                    {selectedRole.description}
                  </Alert>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={FORM_CARD_SX}>
                <SectionTitle icon={<WorkOutlineOutlinedIcon fontSize="small" />} title="Operação na clínica" />

                <SubsectionLabel>Status do usuário</SubsectionLabel>
                <Controller
                  name="active"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      sx={formSwitchLabelSx}
                      control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                      label={field.value ? 'Usuário ativo' : 'Usuário inativo'}
                    />
                  )}
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, mb: 0.5 }}>
                  {active ? 'Pode fazer login e usar a plataforma.' : 'Acesso bloqueado até reativar o usuário.'}
                </Typography>

                <Divider sx={{ my: 2 }} />

                <SubsectionLabel>Agenda e atendimentos</SubsectionLabel>
                <Stack spacing={0.25}>
                  <Controller
                    name="providesAppointments"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        sx={formSwitchLabelSx}
                        control={
                          <Switch
                            checked={field.value}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              field.onChange(checked);
                              if (!checked) setValue('isPrimary', false);
                            }}
                          />
                        }
                        label="Realiza atendimentos"
                      />
                    )}
                  />

                  {providesAppointments && (
                    <Controller
                      name="isPrimary"
                      control={control}
                      render={({ field }) => (
                        <FormControlLabel
                          sx={{ ...formSwitchLabelSx, ml: { xs: 0, sm: 3 } }}
                          control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                          label="Profissional principal"
                        />
                      )}
                    />
                  )}
                </Stack>

                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                  {providesAppointments
                    ? 'Aparece em agendamentos e horários. O profissional principal entra no cálculo de custo/hora — apenas um pode ser marcado.'
                    : 'Não aparece na seleção de profissionais em agendamentos e horários.'}
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ ...FORM_CARD_SX, height: 'auto' }}>
                <SectionTitle icon={<BadgeOutlinedIcon fontSize="small" />} title="Perfil profissional" />

                <Grid container spacing={2.5} alignItems="flex-start">
                  <Grid item xs={12} sm="auto">
                    <Stack alignItems="center" spacing={1}>
                      <Avatar
                        src={photoPreview ?? undefined}
                        sx={{
                          width: 88,
                          height: 88,
                          fontSize: fontSizes['4xl'],
                          fontWeight: 700,
                          bgcolor: calendarColor || 'primary.main',
                        }}
                      >
                        {(nameValue || '?').trim().charAt(0).toUpperCase()}
                      </Avatar>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        hidden
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) photoUpload.mutate(file);
                          e.target.value = '';
                        }}
                      />
                      <Tooltip title={user ? '' : 'Salve o profissional para adicionar a foto'}>
                        <span>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<PhotoCameraOutlinedIcon />}
                            disabled={!user || photoBusy}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            {photoPreview ? 'Trocar foto' : 'Enviar foto'}
                          </Button>
                        </span>
                      </Tooltip>
                      {photoPreview && user && (
                        <Button
                          size="small"
                          color="error"
                          startIcon={<DeleteOutlineIcon />}
                          disabled={photoBusy}
                          onClick={() => photoRemove.mutate()}
                        >
                          Remover
                        </Button>
                      )}
                    </Stack>
                  </Grid>

                  <Grid item xs={12} sm>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Controller
                          name="specialty"
                          control={control}
                          render={({ field }) => (
                            <TextField {...field} label="Especialidade" fullWidth placeholder="Ex.: Biomédica esteta" />
                          )}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Controller
                          name="councilRegister"
                          control={control}
                          render={({ field }) => (
                            <TextField {...field} label="Registro do conselho" fullWidth placeholder="Ex.: CRBM 12345" />
                          )}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <SubsectionLabel>Cor na agenda</SubsectionLabel>
                        <Controller
                          name="calendarColor"
                          control={control}
                          render={({ field }) => (
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                              {COLOR_SWATCHES.map((c) => {
                                const selected = field.value?.toLowerCase() === c.toLowerCase();
                                return (
                                  <Box
                                    key={c}
                                    component="button"
                                    type="button"
                                    aria-label={c}
                                    onClick={() => field.onChange(selected ? '' : c)}
                                    sx={{
                                      width: 30,
                                      height: 30,
                                      borderRadius: '50%',
                                      cursor: 'pointer',
                                      bgcolor: c,
                                      border: (t) =>
                                        selected ? `2px solid ${t.palette.text.primary}` : '2px solid transparent',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#fff',
                                    }}
                                  >
                                    {selected && <CheckIcon sx={{ fontSize: 16 }} />}
                                  </Box>
                                );
                              })}
                            </Stack>
                          )}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Controller
                          name="bio"
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="Bio / descrição"
                              fullWidth
                              multiline
                              minRows={2}
                              placeholder="Breve descrição do profissional"
                            />
                          )}
                        />
                      </Grid>
                    </Grid>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            {mutation.isError && (
              <Grid item xs={12}>
                <Alert severity="error" variant="outlined">
                  {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                    'Erro ao salvar profissional'}
                </Alert>
              </Grid>
            )}
          </Grid>
        </DialogContent>

        <DialogActions sx={{ ...dialogActionsBorderSx, flexShrink: 0 }}>
          <Button onClick={onClose} type="button" disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            {mutation.isPending ? 'Salvando…' : user ? 'Salvar' : 'Criar profissional'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
