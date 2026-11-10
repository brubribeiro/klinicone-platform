import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Link,
  Skeleton,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../api/admin';
import { useAppToast } from '../../../../frontend/src/contexts/AppToastContext';
import { getApiErrorMessage } from '../../../../frontend/src/utils/apiError';
import { adminPath } from '../../../../frontend/src/utils/adminPath';
import { fontSizes } from '../../../../frontend/src/theme/fontSizes';
import { DialogHeader, dialogActionsBorderSx, dialogPaperSx } from '../../../../frontend/src/components/DialogCloseButton';
import { formatDateTime } from './adminUi';
import { FEEDBACK_STATUS_META, FeedbackStatusPill, FeedbackTypePill } from './feedbackUi';
import type { FeedbackStatus } from '../../../../frontend/src/types';

const DIALOG_MAX_WIDTH = 620;
const REPLY_MAX_LENGTH = 2000;

const LABEL_SX = {
  fontSize: fontSizes['2xs'],
  fontWeight: 800,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'text.disabled',
} as const;

interface Props {
  reportId: string | null;
  onClose: () => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={LABEL_SX}>{label}</Typography>
      <Box sx={{ fontSize: fontSizes.sm, mt: 0.25, overflowWrap: 'anywhere' }}>{children}</Box>
    </Box>
  );
}

/** Detalhe de um report (super-admin): troca de status, resposta ao autor e exclusão. */
export function FeedbackDetailDialog({ reportId, onClose }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const toast = useAppToast();
  const queryClient = useQueryClient();

  const { data: report, isLoading } = useQuery({
    queryKey: ['admin', 'feedback', 'detail', reportId],
    queryFn: () => adminApi.getFeedback(reportId!),
    enabled: !!reportId,
  });

  const [draft, setDraft] = useState('');
  const [editingReply, setEditingReply] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    setDraft('');
    setEditingReply(false);
    setConfirmDelete(false);
  }, [reportId]);

  const replyMutation = useMutation({
    mutationFn: (text: string) => adminApi.replyFeedback(reportId!, text),
    onSuccess: (updated) => {
      queryClient.setQueryData(['admin', 'feedback', 'detail', reportId], updated);
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      setEditingReply(false);
      setDraft('');
      toast.success('Resposta enviada ao autor.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível enviar a resposta.')),
  });

  const deleteMutation = useMutation({
    mutationFn: () => adminApi.deleteFeedback(reportId!),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['admin', 'feedback', 'detail', reportId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'feedback', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      toast.success('Report excluído.');
      onClose();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível excluir o report.')),
  });


  const statusMutation = useMutation({
    mutationFn: (status: FeedbackStatus) => adminApi.setFeedbackStatus(reportId!, status),
    onSuccess: (updated) => {
      queryClient.setQueryData(['admin', 'feedback', 'detail', reportId], updated);
      queryClient.invalidateQueries({ queryKey: ['admin', 'feedback', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      toast.success(`Report marcado como "${FEEDBACK_STATUS_META[updated.status].label.toLowerCase()}".`);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível alterar o status.')),
  });

  const busy = statusMutation.isPending || replyMutation.isPending || deleteMutation.isPending;
  const showReplyForm = !!report && (!report.replyText || editingReply);
  const trimmedDraft = draft.trim();

  const actions: { status: FeedbackStatus; label: string; variant: 'contained' | 'outlined' }[] = !report
    ? []
    : report.status === 'OPEN'
      ? [
          { status: 'TRIAGED', label: 'Marcar em triagem', variant: 'outlined' },
          { status: 'CLOSED', label: 'Resolver', variant: 'contained' },
        ]
      : report.status === 'TRIAGED'
        ? [
            { status: 'OPEN', label: 'Reabrir', variant: 'outlined' },
            { status: 'CLOSED', label: 'Resolver', variant: 'contained' },
          ]
        : [{ status: 'OPEN', label: 'Reabrir', variant: 'outlined' }];

  return (
    <Dialog
      open={!!reportId}
      onClose={busy ? undefined : onClose}
      maxWidth={false}
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          ...dialogPaperSx(isMobile),
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          ...(isMobile ? { height: '100%', maxHeight: '100dvh' } : { maxWidth: DIALOG_MAX_WIDTH, maxHeight: '94dvh' }),
        },
      }}
    >
      <DialogHeader
        onClose={onClose}
        isMobile={isMobile}
        title={report?.title ?? 'Report'}
        subtitle={report ? `${report.tenant.name} · ${formatDateTime(report.createdAt)}` : undefined}
        icon={<FeedbackOutlinedIcon fontSize="small" />}
      />
      <DialogContent sx={{ pt: '20px !important' }}>
        {isLoading || !report ? (
          <Stack spacing={1.5}>
            <Skeleton variant="rounded" height={28} width={180} />
            <Skeleton variant="rounded" height={120} />
            <Skeleton variant="rounded" height={60} />
          </Stack>
        ) : (
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1}>
              <FeedbackTypePill type={report.type} />
              <FeedbackStatusPill status={report.status} />
            </Stack>
            <Typography
              sx={{
                fontSize: fontSizes.sm,
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                bgcolor: 'grey.50',
                border: 1,
                borderColor: 'divider',
                borderRadius: '12px',
                p: 2,
              }}
            >
              {report.description}
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <Field label="Clínica">
                <Link component={RouterLink} to={adminPath(`/clinicas/${report.tenant.id}`)} underline="hover" fontWeight={700}>
                  {report.tenant.name}
                </Link>
              </Field>
              <Field label="Autor">
                {report.user.name}
                <Typography component="span" sx={{ display: 'block', fontSize: fontSizes.xs, color: 'text.secondary' }}>
                  {report.user.email}
                </Typography>
              </Field>
              <Field label="Página">{report.pageUrl || '—'}</Field>
              <Field label="Último status">
                {report.statusChangedAt ? formatDateTime(report.statusChangedAt) : 'Sem alteração'}
              </Field>
            </Box>

            <Box>
              <Typography sx={{ ...LABEL_SX, mb: 0.75 }}>Resposta ao autor</Typography>
              {report.replyText && !editingReply && (
                <Box
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderLeft: 3,
                    borderLeftColor: 'primary.main',
                    borderRadius: '12px',
                    p: 2,
                  }}
                >
                  <Typography sx={{ fontSize: fontSizes.sm, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                    {report.replyText}
                  </Typography>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mt: 1 }}>
                    <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }}>
                      {[report.repliedByName, report.repliedAt ? formatDateTime(report.repliedAt) : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </Typography>
                    <Button
                      size="small"
                      disabled={busy}
                      onClick={() => {
                        setDraft(report.replyText ?? '');
                        setEditingReply(true);
                      }}
                    >
                      Responder de novo
                    </Button>
                  </Stack>
                </Box>
              )}
              {showReplyForm && (
                <Stack spacing={1}>
                  <TextField
                    multiline
                    minRows={3}
                    maxRows={10}
                    fullWidth
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Escreva a resposta. O autor recebe o texto como notificação no app."
                    inputProps={{ maxLength: REPLY_MAX_LENGTH, 'aria-label': 'Resposta ao autor' }}
                    helperText={`${draft.length}/${REPLY_MAX_LENGTH} · enviar não muda o status`}
                    disabled={busy}
                  />
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    {editingReply && (
                      <Button size="small" disabled={busy} onClick={() => setEditingReply(false)}>
                        Cancelar
                      </Button>
                    )}
                    <Button
                      size="small"
                      variant="contained"
                      disabled={busy || !trimmedDraft || trimmedDraft === report.replyText}
                      onClick={() => replyMutation.mutate(trimmedDraft)}
                    >
                      {editingReply ? 'Atualizar resposta' : 'Enviar resposta'}
                    </Button>
                  </Stack>
                </Stack>
              )}
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ ...dialogActionsBorderSx, flexWrap: 'wrap', gap: 1 }}>
        {confirmDelete ? (
          <>
            <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 700, color: 'error.main', mr: 'auto' }}>
              Excluir este report de vez? Não dá para desfazer.
            </Typography>
            <Button onClick={() => setConfirmDelete(false)} disabled={deleteMutation.isPending}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              color="error"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              Excluir
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onClose} disabled={busy}>
              Fechar
            </Button>
            <Button color="error" disabled={busy || !report} onClick={() => setConfirmDelete(true)} sx={{ mr: 'auto' }}>
              Excluir
            </Button>
            {actions.map((a) => (
              <Button
                key={a.status}
                variant={a.variant}
                disabled={busy}
                onClick={() => statusMutation.mutate(a.status)}
              >
                {a.label}
              </Button>
            ))}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
