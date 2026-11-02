import { Box, Button, IconButton, Stack, Tooltip } from '@mui/material';

import { useColorMode } from '../../contexts/ColorModeContext';
import { useAppointmentDialog } from '../../contexts/AppointmentDialogContext';
import { NotificationsBell } from '../notifications/NotificationsBell';
import { AuroraIcon } from '../AuroraIcon';

// Mesmo visual do sino (NotificationsBell); menores no celular para caber o título
const HEADER_ICON_BUTTON_SX = {
  width: { xs: 34, sm: 38 },
  height: { xs: 34, sm: 38 },
  borderRadius: '12px',
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'grey.50',
  color: 'text.secondary',
  '&:hover': { bgcolor: 'grey.100' },
} as const;

interface HeaderActionsProps {
  /** Só admins veem o botão de histórico. */
  canSeeHistory: boolean;
  hasAuditEntity: boolean;
  onOpenHistory: () => void;
  moneyHidden: boolean;
  onToggleMoneyHidden: () => void;
  canSeeAgenda: boolean;
  /** Presente quando a tela tem tour guiado: mostra o botão “Como funciona?”. */
  onOpenTour?: () => void;
}

/** Botões à direita do header: tour, tema, histórico, ocultar valores, notificações e novo agendamento. */
export function HeaderActions({
  canSeeHistory,
  hasAuditEntity,
  onOpenHistory,
  moneyHidden,
  onToggleMoneyHidden,
  canSeeAgenda,
  onOpenTour,
}: HeaderActionsProps) {
  const { mode: colorMode, toggleColorMode } = useColorMode();
  const { openAppointmentDialog } = useAppointmentDialog();

  return (
    <Stack direction="row" spacing={{ xs: 0.5, sm: 1 }} alignItems="center" sx={{ flexShrink: 0 }}>
      {onOpenTour && (
        <Tooltip title="Como funciona?">
          <IconButton onClick={onOpenTour} aria-label="Como funciona? Ver tour da tela" data-tour="tour-help" sx={HEADER_ICON_BUTTON_SX}>
            <AuroraIcon name="help" size={20} strokeWidth={1.8} />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title={colorMode === 'dark' ? 'Tema claro' : 'Tema escuro'}>
        <IconButton onClick={toggleColorMode} aria-label="Alternar tema" sx={HEADER_ICON_BUTTON_SX}>
          <AuroraIcon name={colorMode === 'dark' ? 'sun' : 'moon'} size={20} strokeWidth={1.8} />
        </IconButton>
      </Tooltip>
      {canSeeHistory && (
        <Tooltip title={hasAuditEntity ? 'Histórico de alterações' : 'Sem histórico nesta tela'}>
          <span>
            <IconButton
              onClick={onOpenHistory}
              disabled={!hasAuditEntity}
              aria-label="Histórico de alterações"
              sx={{ ...HEADER_ICON_BUTTON_SX, '&.Mui-disabled': { bgcolor: 'grey.50', color: 'text.disabled', opacity: 0.55 } }}
            >
              <AuroraIcon name="clock" size={20} strokeWidth={1.8} />
            </IconButton>
          </span>
        </Tooltip>
      )}
      <Tooltip title={moneyHidden ? 'Mostrar valores' : 'Ocultar valores'}>
        <IconButton
          aria-label={moneyHidden ? 'Mostrar valores' : 'Ocultar valores'}
          onClick={onToggleMoneyHidden}
          aria-pressed={moneyHidden}
          sx={{
            ...HEADER_ICON_BUTTON_SX,
            ...(moneyHidden && {
              bgcolor: 'primary.main',
              borderColor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': { bgcolor: 'primary.dark' },
            }),
          }}
        >
          <AuroraIcon name={moneyHidden ? 'eyeOff' : 'eye'} size={20} strokeWidth={1.8} />
        </IconButton>
      </Tooltip>
      <NotificationsBell />
      {canSeeAgenda && (
        <>
          <Box sx={{ display: { xs: 'none', sm: 'block' }, width: '1px', height: 26, bgcolor: 'divider', mx: 1 }} />
          <Button
            variant="contained"
            color="primary"
            startIcon={<AuroraIcon name="plus" size={18} strokeWidth={2.2} />}
            onClick={() => openAppointmentDialog()}
            data-tour="agenda-new"
            sx={{
              height: { xs: 34, sm: 38 },
              minHeight: { xs: 34, sm: 38 },
              minWidth: { xs: 34, sm: 64 },
              px: { xs: 1, md: 2.25 },
              borderRadius: '12px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              boxShadow: '0 6px 16px -6px rgba(21,153,139,.8)',
              '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 }, ml: { xs: 0, sm: -0.5 } },
            }}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              Novo agendamento
            </Box>
          </Button>
        </>
      )}
    </Stack>
  );
}
