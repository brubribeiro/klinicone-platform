import { Box, type Theme } from '@mui/material';
import type { DayHeaderContentArg, EventContentArg } from '@fullcalendar/core';

import { AuroraIcon } from '../AuroraIcon';
import type { Appointment } from '../../types';
import { fontSizes } from '../../theme/fontSizes';
import { appointmentProcedureLabel } from '../../utils/appointmentProcedures';

/** Cabeçalho dos dias: só o dia da semana no mês; dia da semana + número (hoje destacado) nas demais visões. */
export function renderAgendaDayHeader(arg: DayHeaderContentArg) {
  const weekday = arg.date
    .toLocaleDateString('pt-BR', { weekday: 'short' })
    .replace('.', '');
  if (arg.view.type === 'dayGridMonth') {
    return (
      <Box
        sx={{
          fontSize: fontSizes['2xs'],
          fontWeight: 700,
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.4px',
          py: 0.75,
        }}
      >
        {weekday}
      </Box>
    );
  }
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.4,
        py: 0.6,
      }}
    >
      <Box
        sx={{
          fontSize: fontSizes['3xs'],
          fontWeight: 700,
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.4px',
        }}
      >
        {weekday}
      </Box>
      <Box
        sx={{
          minWidth: 30,
          height: 30,
          px: 0.75,
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: fontSizes.md,
          fontWeight: 800,
          ...(arg.isToday
            ? { bgcolor: 'primary.main', color: '#fff' }
            : { color: 'text.primary' }),
        }}
      >
        {arg.date.getDate()}
      </Box>
    </Box>
  );
}

/** Conteúdo dos eventos: agendamentos com barra de categoria e bolinha de status; feriados e bloqueios só com o título. */
export function renderAgendaEventContent(arg: EventContentArg, theme: Theme) {
  const appt = arg.event.extendedProps.appointment as Appointment | undefined;
  const procedureLabel =
    appt && (appt.procedure || appt.appointmentProcedures?.length) ? appointmentProcedureLabel(appt) : '';
  const isMonth = arg.view.type === 'dayGridMonth';
  const barColor = arg.event.borderColor || theme.palette.primary.main;
  const statusColor = (arg.event.extendedProps.statusColor as string) || barColor;
  if (appt) {
    if (isMonth) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, minWidth: 0, px: 0.25 }}>
          <Box
            sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: barColor, flexShrink: 0 }}
          />
          <Box component="span" sx={{ fontWeight: 700, fontSize: fontSizes['2xs'], flexShrink: 0 }}>
            {arg.timeText}
          </Box>
          <Box
            component="span"
            sx={{
              fontWeight: 700,
              fontSize: fontSizes['2xs'],
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {appt.patient?.name ?? 'Paciente'}
          </Box>
        </Box>
      );
    }
    return (
      <Box
        sx={{
          position: 'relative',
          height: '100%',
          overflow: 'hidden',
          borderRadius: '12px',
          boxShadow: `inset 4px 0 0 ${barColor}`,
          pl: '11px',
          pr: '14px',
          pt: '7px',
          pb: '4px',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 13,
            height: 13,
            borderRadius: '50%',
            bgcolor: statusColor,
            border: '2px solid',
            borderColor: 'background.paper',
          }}
        />
        <Box sx={{ minWidth: 0, lineHeight: 1.25 }}>
          <Box sx={{ fontSize: fontSizes['3xs'], fontWeight: 700, opacity: 0.9 }}>
            {arg.timeText}
          </Box>
          <Box
            sx={{
              fontSize: fontSizes.xs,
              fontWeight: 800,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {appt.patient?.name ?? 'Paciente'}
          </Box>
          {arg.event.extendedProps.sessionLabel ? (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                mt: '2px',
                maxWidth: '100%',
                px: '5px',
                py: '1px',
                borderRadius: '6px',
                bgcolor: `${barColor}26`,
                color: barColor,
                fontSize: fontSizes['3xs'],
                fontWeight: 800,
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
                lineHeight: 1.4,
              }}
            >
              <AuroraIcon name="pacotes" size={10} />
              <Box
                component="span"
                sx={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {arg.event.extendedProps.sessionLabel as string}
              </Box>
            </Box>
          ) : (
            procedureLabel && (
              <Box
                sx={{
                  fontSize: fontSizes['3xs'],
                  opacity: 0.82,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {procedureLabel}
              </Box>
            )
          )}
        </Box>
      </Box>
    );
  }
  return (
    <Box
      sx={{
        px: 0.5,
        fontSize: fontSizes['2xs'],
        fontWeight: 600,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {arg.event.title}
    </Box>
  );
}
