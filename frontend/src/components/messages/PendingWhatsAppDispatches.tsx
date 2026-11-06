import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  Collapse,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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
  const [open, setOpen] = useState(false);
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
    <Card sx={{ ...CARD_SX, mb: { xs: 1.5, sm: 2 } }}>
      <Box
        component="button"
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          width: '100%',
          px: { xs: 1.5, sm: 2 },
          py: 1,
          border: 0,
          bgcolor: 'transparent',
          color: 'text.primary',
          fontFamily: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <WhatsAppIcon sx={{ fontSize: 18, color: '#1DAE53' }} />
        <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 700, flex: 1 }}>
          Envios automáticos pendentes
          {!isLoading && (
            <Box component="span" sx={{ ml: 1, color: 'primary.main' }}>
              {pending.length}
            </Box>
          )}
        </Typography>
        <ExpandMoreIcon
          sx={{ color: 'text.secondary', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}
        />
      </Box>
      <Collapse in={open} unmountOnExit>
        <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', px: { xs: 1.5, sm: 2 }, pb: 1 }}>
          Gerados pelo scheduler (a cada 1h). Abra o WhatsApp para enviar — o painel registra a tentativa.
        </Typography>
      {isLoading ? (
        <Stack spacing={0} sx={{ px: 2, py: 0.5 }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} height={48} />
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
              px: { xs: 1.5, sm: 2 },
              py: 1,
              borderTop: 1,
              borderColor: 'grey.100',
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 700 }} noWrap>
                {d.patient?.name ?? 'Paciente'} · {d.template?.name ?? 'Modelo'}
              </Typography>
              <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }} noWrap>
                {triggerLabel[d.trigger]} · {dayjs(d.createdAt).format('DD/MM HH:mm')}
              </Typography>
              <Typography
                sx={{
                  fontSize: fontSizes.xs,
                  color: 'text.secondary',
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
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
                height: 34,
                borderRadius: '10px',
                fontSize: fontSizes.sm,
              }}
            >
              Abrir WhatsApp
            </Button>
          </Stack>
        ))
      )}
      </Collapse>
    </Card>
  );
}
