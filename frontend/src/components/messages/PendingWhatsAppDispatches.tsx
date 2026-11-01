import {
  Box,
  Button,
  Card,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';

import { messagesApi } from '../../api/messages';
import { triggerLabelMap } from './messageTemplateConstants';
import { useAppToast } from '../../contexts/AppToastContext';
import { getApiErrorMessage } from '../../utils/apiError';
import { fontSizes } from '../../theme/fontSizes';

const CARD_SX = { borderRadius: '18px', overflow: 'hidden' } as const;

export function PendingWhatsAppDispatches() {
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const triggerLabel = triggerLabelMap();

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ['message-dispatches', 'pending'],
    queryFn: () => messagesApi.listPendingDispatches(),
    refetchInterval: 60_000,
  });

  const markSent = useMutation({
    mutationFn: (id: string) => messagesApi.markDispatchSent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-dispatches', 'pending'] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Não foi possível registrar o envio.'));
    },
  });

  const openWhatsApp = (dispatch: (typeof pending)[0]) => {
    if (!dispatch.waMeUrl) {
      toast.error('Telefone inválido ou ausente para este envio.');
      return;
    }
    window.open(dispatch.waMeUrl, '_blank');
    markSent.mutate(dispatch.id);
    toast.success('WhatsApp aberto — envio registrado.');
  };

  if (!isLoading && pending.length === 0) return null;

  return (
    <Card sx={{ ...CARD_SX, mb: { xs: 2, sm: 2.25 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        spacing={1}
        sx={{ px: { xs: 2, sm: 2.75 }, py: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Box>
          <Typography sx={{ fontSize: fontSizes.lg, fontWeight: 700 }}>Envios automáticos pendentes</Typography>
          <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', mt: 0.25 }}>
            Gerados pelo scheduler (a cada 1h). Abra o WhatsApp para enviar — o painel registra a tentativa.
          </Typography>
        </Box>
        {!isLoading && (
          <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 700, color: 'primary.main' }}>
            {pending.length} na fila
          </Typography>
        )}
      </Stack>

      {isLoading ? (
        <Stack spacing={0} sx={{ px: 2.75, py: 1 }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} height={72} sx={{ my: 1 }} />
          ))}
        </Stack>
      ) : (
        pending.map((d) => (
          <Stack
            key={d.id}
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            spacing={1.5}
            sx={{
              px: { xs: 2, sm: 2.75 },
              py: 1.75,
              borderBottom: 1,
              borderColor: 'grey.100',
              '&:last-of-type': { borderBottom: 0 },
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: fontSizes.md, fontWeight: 700 }} noWrap>
                {d.patient?.name ?? 'Paciente'} · {d.template?.name ?? 'Modelo'}
              </Typography>
              <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }} noWrap>
                Gatilho: {triggerLabel[d.trigger]} · {dayjs(d.createdAt).format('DD/MM/YYYY HH:mm')}
                {d.appointment?.startAt &&
                  ` · Agendamento ${dayjs(d.appointment.startAt).format('DD/MM/YYYY HH:mm')}`}
              </Typography>
              <Typography
                sx={{
                  fontSize: fontSizes.xs,
                  color: 'text.secondary',
                  mt: 0.5,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {d.renderedMessage}
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<WhatsAppIcon />}
              onClick={() => openWhatsApp(d)}
              disabled={!d.waMeUrl || markSent.isPending}
              sx={{
                flexShrink: 0,
                bgcolor: '#25D366',
                '&:hover': { bgcolor: '#1da851' },
                height: 40,
                borderRadius: '10px',
              }}
            >
              Abrir WhatsApp
            </Button>
          </Stack>
        ))
      )}
    </Card>
  );
}
