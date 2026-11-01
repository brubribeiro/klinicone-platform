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

/** Detalhe de um report (super-admin) com a troca de status. */
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
      onClose={statusMutation.isPending ? undefined : onClose}
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
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={dialogActionsBorderSx}>
        <Button onClick={onClose} disabled={statusMutation.isPending} sx={{ mr: 'auto' }}>
          Fechar
        </Button>
        {actions.map((a) => (
          <Button
            key={a.status}
            variant={a.variant}
            disabled={statusMutation.isPending}
            onClick={() => statusMutation.mutate(a.status)}
          >
            {a.label}
          </Button>
        ))}
      </DialogActions>
    </Dialog>
  );
}
