import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Popover,
  Stack,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/pt-br';

import { notificationsApi } from '../../api/notifications';
import { AuroraIcon } from '../AuroraIcon';
import { NotificationPreferencesDialog } from './NotificationPreferencesDialog';
import { useAppToast } from '../../contexts/AppToastContext';
import type { Notification } from '../../types';
import { fontSizes } from '../../theme/fontSizes';
import { clickableProps } from '../../utils/a11y';

dayjs.extend(relativeTime);
dayjs.locale('pt-br');

const POLL_MS = 30_000;

interface NotificationsBellProps {
  iconColor?: string;
}

export function NotificationsBell({ iconColor }: NotificationsBellProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);

  const open = Boolean(anchorEl);

  const { data: count = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsApi.unreadCount(),
    refetchInterval: POLL_MS,
  });

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', 'list', 10],
    queryFn: () => notificationsApi.list({ limit: 10 }),
    enabled: open,
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Todas as notificações foram marcadas como lidas');
    },
    onError: () => {
      toast.error('Erro ao marcar notificações como lidas');
    },
  });

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const handleClickNotification = (n: Notification) => {
    if (!n.read) markAsReadMutation.mutate(n.id);
    if (n.link) {
      navigate(n.link);
      handleClose();
    }
  };

  return (
    <>
      <Tooltip title="Notificações">
        <IconButton
          aria-label={count > 0 ? `Notificações, ${count} não lidas` : 'Notificações'}
          onClick={handleOpen}
          sx={{
            width: { xs: 34, sm: 38 },
            height: { xs: 34, sm: 38 },
            borderRadius: '12px',
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'grey.50',
            color: iconColor ?? 'text.secondary',
            '&:hover': { bgcolor: 'grey.100' },
          }}
        >
          <Badge
            badgeContent={count}
            color="error"
            max={99}
            sx={{ '& .MuiBadge-badge': { fontWeight: 700, fontSize: fontSizes['3xs'] } }}
          >
            <AuroraIcon name="bell" size={20} strokeWidth={1.8} />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              width: 380,
              maxHeight: 520,
              mt: 1,
              borderRadius: '16px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 12px 48px -12px rgba(16,40,37,.28)',
            },
          },
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1}
          sx={{ px: 2.1, py: 1.75, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}
        >
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Typography sx={{ fontSize: fontSizes.lg, fontWeight: 800 }}>Notificações</Typography>
            {count > 0 && (
              <Box
                component="span"
                sx={{
                  fontSize: fontSizes['2xs'],
                  fontWeight: 800,
                  color: 'primary.main',
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.09),
                  px: 1,
                  py: '2px',
                  borderRadius: '7px',
                }}
              >
                {count} nova{count > 1 ? 's' : ''}
              </Box>
            )}
          </Stack>
          <Button
            size="small"
            disabled={count === 0 || markAllAsReadMutation.isPending}
            onClick={() => markAllAsReadMutation.mutate()}
            sx={{ fontSize: fontSizes.xs, fontWeight: 700, minWidth: 0, px: 0.75 }}
          >
            Marcar lidas
          </Button>
        </Stack>

        <Box sx={{ overflowY: 'auto', flex: 1 }}>
          {isLoading ? (
            <Box display="flex" justifyContent="center" py={3}>
              <CircularProgress size={24} />
            </Box>
          ) : notifications.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
              <Typography variant="body2">Você não tem notificações</Typography>
            </Box>
          ) : (
            notifications.map((n) => (
              <Box
                key={n.id}
                {...clickableProps(() => handleClickNotification(n))}
                sx={{
                  display: 'flex',
                  gap: 1.25,
                  px: 2.1,
                  py: 1.5,
                  cursor: 'pointer',
                  borderBottom: '1px solid',
                  borderColor: 'grey.50',
                  bgcolor: n.read ? 'transparent' : 'rgba(21,153,139,.05)',
                  '&:hover': { bgcolor: 'grey.50' },
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
                  <Stack direction="row" alignItems="center" spacing={0.9}>
                    <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 800 }} noWrap>
                      {n.title}
                    </Typography>
                    {!n.read && (
                      <Box
                        sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0 }}
                      />
                    )}
                  </Stack>
                  <Typography
                    sx={{
                      fontSize: fontSizes.xs,
                      color: 'text.secondary',
                      fontWeight: 500,
                      mt: 0.25,
                      // Avisos da plataforma vêm em várias linhas (tópicos do release)
                      ...(n.type === 'PLATFORM_ANNOUNCEMENT' ? { whiteSpace: 'pre-line' } : {}),
                    }}
                  >
                    {n.message}
                  </Typography>
                  <Typography sx={{ fontSize: fontSizes['2xs'], color: 'text.disabled', fontWeight: 600, mt: 0.5 }}>
                    {dayjs(n.createdAt).fromNow()}
                  </Typography>
                </Box>
              </Box>
            ))
          )}
        </Box>

        <Box
          component="button"
          type="button"
          onClick={() => {
            void queryClient.prefetchQuery({
              queryKey: ['notification-preferences'],
              queryFn: () => notificationsApi.getPreferences(),
            });
            setPrefsOpen(true);
            handleClose();
          }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            height: 46,
            flexShrink: 0,
            border: 'none',
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'grey.50',
            color: 'text.secondary',
            fontFamily: 'inherit',
            fontSize: fontSizes.sm,
            fontWeight: 700,
            cursor: 'pointer',
            '&:hover': { bgcolor: 'grey.100' },
          }}
        >
          <SettingsIcon sx={{ fontSize: 16 }} />
          Preferências de notificação
        </Box>
      </Popover>

      <NotificationPreferencesDialog
        open={prefsOpen}
        onClose={() => setPrefsOpen(false)}
      />
    </>
  );
}
