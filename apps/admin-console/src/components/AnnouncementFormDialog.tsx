import { useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../api/admin';
import { useAppToast } from '../../../../frontend/src/contexts/AppToastContext';
import { getApiErrorMessage } from '../../../../frontend/src/utils/apiError';
import { DialogHeader, dialogActionsBorderSx, dialogPaperSx } from '../../../../frontend/src/components/DialogCloseButton';
import { AuroraIcon } from '../../../../frontend/src/components/AuroraIcon';
import { FormSection } from '../../../../frontend/src/components/FormSection';
import { LabeledField } from '../../../../frontend/src/components/LabeledField';
import { fontSizes } from '../../../../frontend/src/theme/fontSizes';
import { ANNOUNCEMENT_KIND_LABELS, announcementWhen } from './announcementUi';
import type { AnnouncementKind, PlatformAnnouncement } from '../../../../frontend/src/types';

const DIALOG_MAX_WIDTH = 860;
const TITLE_MAX = 120;
const BODY_MAX = 4000;

interface FormValues {
  title: string;
  body: string;
  kind: AnnouncementKind;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** null = novo aviso; enviado abre só para leitura. */
  editing: PlatformAnnouncement | null;
}

/** Criar/editar o aviso, com prévia de como ele aparece no sino das clínicas. */
export function AnnouncementFormDialog({ open, onClose, editing }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const readOnly = editing?.status === 'SENT';

  const { control, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { title: '', body: '', kind: 'FEATURE' },
  });
  const [title, body] = useWatch({ control, name: ['title', 'body'] });

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = { title: values.title.trim(), body: values.body.trim(), kind: values.kind };
      return editing ? adminApi.updateAnnouncement(editing.id, payload) : adminApi.createAnnouncement(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      toast.success(editing ? 'Aviso atualizado.' : 'Rascunho criado.');
      onClose();
    },
  });

  const saving = saveMutation.isPending;
  const resetMutation = saveMutation.reset;

  useEffect(() => {
    if (!open) return;
    reset({ title: editing?.title ?? '', body: editing?.body ?? '', kind: editing?.kind ?? 'FEATURE' });
    resetMutation();
  }, [open, editing, reset, resetMutation]);

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
            : { maxWidth: DIALOG_MAX_WIDTH, width: DIALOG_MAX_WIDTH, maxHeight: '94dvh', overflow: 'hidden' }),
        },
      }}
    >
      <Box
        component="form"
        noValidate
        onSubmit={handleSubmit((values) => saveMutation.mutate(values))}
        sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, ...(isMobile ? { height: '100%' } : {}) }}
      >
        <DialogHeader
          onClose={onClose}
          isMobile={isMobile}
          title={readOnly ? 'Aviso enviado' : editing ? 'Editar aviso' : 'Novo aviso'}
          subtitle={
            editing
              ? [editing.version ? `Versão ${editing.version}` : 'Escrito à mão', announcementWhen(editing)].join(' · ')
              : 'Novidade ou correção para as clínicas'
          }
          icon={editing && !readOnly ? <EditOutlinedIcon fontSize="small" /> : <CampaignOutlinedIcon fontSize="small" />}
        />

        <DialogContent
          sx={{
            px: { xs: 2, sm: 3 },
            pb: { xs: 2, sm: 2.5 },
            flex: 1,
            overflow: 'auto',
            bgcolor: 'background.default',
            '&.MuiDialogContent-root': { pt: { xs: 2.75, sm: 3 } },
          }}
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.35fr 1fr' }, gap: 2.25 }}>
            <FormSection title="Aviso" sx={{ height: '100%' }}>
              <Stack spacing={1.75}>
                <Controller
                  name="kind"
                  control={control}
                  render={({ field }) => (
                    <LabeledField label="Tipo">
                      <ToggleButtonGroup
                        exclusive
                        size="small"
                        disabled={readOnly}
                        value={field.value}
                        onChange={(_, v: AnnouncementKind | null) => v && field.onChange(v)}
                        aria-label="Tipo do aviso"
                      >
                        {(['FEATURE', 'FIX'] as const).map((k) => (
                          <ToggleButton key={k} value={k} sx={{ px: 2 }}>
                            {ANNOUNCEMENT_KIND_LABELS[k]}
                          </ToggleButton>
                        ))}
                      </ToggleButtonGroup>
                    </LabeledField>
                  )}
                />
                <Controller
                  name="title"
                  control={control}
                  rules={{
                    validate: (v) => v.trim().length >= 3 || 'Informe o título',
                    maxLength: { value: TITLE_MAX, message: `Máximo de ${TITLE_MAX} caracteres` },
                  }}
                  render={({ field, fieldState }) => (
                    <LabeledField label="Título" required>
                      <TextField
                        {...field}
                        placeholder="Ex.: Novidades da versão 0.3.0"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                        fullWidth
                        autoFocus={!readOnly}
                        InputProps={{ readOnly }}
                      />
                    </LabeledField>
                  )}
                />
                <Controller
                  name="body"
                  control={control}
                  rules={{
                    validate: (v) => v.trim().length >= 3 || 'Escreva o texto do aviso',
                    maxLength: { value: BODY_MAX, message: `Máximo de ${BODY_MAX} caracteres` },
                  }}
                  render={({ field, fieldState }) => (
                    <LabeledField label="Texto" required>
                      <TextField
                        {...field}
                        placeholder={'• O que mudou, uma linha por tópico'}
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message ?? `${field.value.length}/${BODY_MAX} · sem dados de pacientes`}
                        fullWidth
                        multiline
                        minRows={9}
                        maxRows={16}
                        InputProps={{ readOnly }}
                      />
                    </LabeledField>
                  )}
                />
              </Stack>
            </FormSection>

            <FormSection title="Prévia no sino" subtitle="Como os usuários das clínicas vão ver" sx={{ height: '100%' }}>
              <Box
                sx={{
                  display: 'flex',
                  gap: 1.25,
                  p: 1.5,
                  borderRadius: '12px',
                  border: 1,
                  borderColor: 'divider',
                  bgcolor: 'rgba(21,153,139,.05)',
                }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'rgba(21,153,139,.12)',
                    color: 'primary.main',
                  }}
                >
                  <AuroraIcon name="bell" size={18} strokeWidth={1.9} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
                  <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 800 }} noWrap>
                    {title.trim() || 'Título do aviso'}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: fontSizes.xs,
                      color: 'text.secondary',
                      fontWeight: 500,
                      mt: 0.25,
                      whiteSpace: 'pre-line',
                      maxHeight: 360,
                      overflow: 'auto',
                    }}
                  >
                    {body.trim() || 'O texto aparece aqui.'}
                  </Typography>
                </Box>
              </Box>
              <Typography sx={{ fontSize: fontSizes.xs, color: 'text.disabled', mt: 1.25 }}>
                Vai para os usuários ativos das clínicas ativas; quem desligou “Novidades da plataforma” nas
                preferências não recebe.
              </Typography>
            </FormSection>
          </Box>

          {saveMutation.error && (
            <Alert severity="error" variant="outlined" sx={{ mt: 2.25 }}>
              {getApiErrorMessage(saveMutation.error, 'Não foi possível salvar o aviso.')}
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ ...dialogActionsBorderSx, flexShrink: 0 }}>
          <Button onClick={onClose} type="button" disabled={saving}>
            {readOnly ? 'Fechar' : 'Cancelar'}
          </Button>
          {!readOnly && (
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? 'Salvando…' : editing ? 'Salvar' : 'Criar rascunho'}
            </Button>
          )}
        </DialogActions>
      </Box>
    </Dialog>
  );
}
