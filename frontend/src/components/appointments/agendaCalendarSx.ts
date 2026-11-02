import type { Theme } from '@mui/material';

import { fontSizes } from '../../theme/fontSizes';

// O FullCalendar roda com headerToolbar={false} (toolbar própria em AgendaToolbar),
// então aqui só há estilos da grade e dos eventos.
export function agendaCalendarSx(theme: Theme) {
  return {
    flex: 1,
    p: { xs: 0.75, sm: 1.5, md: 2.5 },
    minHeight: 0,
    outline: 'none',
    position: 'relative',
    '&:focus-visible': {
      boxShadow: `0 0 0 2px ${theme.palette.primary.main}`,
    },
    '& .fc': {
      height: '100% !important',
      fontFamily: theme.typography.fontFamily,
    },
    '& .fc-theme-standard td, & .fc-theme-standard th, & .fc-theme-standard .fc-scrollgrid':
      {
        borderColor: theme.palette.divider,
      },
    '& .fc .fc-col-header-cell': {
      backgroundColor: theme.palette.background.paper,
      padding: '10px 0',
    },
    '& .fc .fc-col-header-cell-cushion': {
      color: theme.palette.text.secondary,
      fontWeight: 600,
      fontSize: fontSizes.xs,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      padding: 0,
    },
    '& .fc .fc-daygrid-day-number, & .fc .fc-timegrid-axis-cushion': {
      color: theme.palette.text.secondary,
      fontSize: fontSizes.md,
    },
    '& .fc .fc-day-today': {
      backgroundColor: `${theme.palette.mode === 'dark' ? theme.palette.primary.main + '14' : '#EDF8F7'} !important`,
    },
    '& .fc .fc-timegrid-slot': {
      height: '2.7em',
    },
    '& .fc .fc-timegrid-slot-label-cushion, & .fc .fc-timegrid-axis-cushion': {
      fontSize: fontSizes.xs,
      fontWeight: 600,
      color: theme.palette.text.secondary,
    },
    '& .fc .fc-timegrid-now-indicator-line': {
      borderColor: theme.palette.primary.main,
    },
    '& .fc .fc-timegrid-now-indicator-arrow': {
      borderColor: theme.palette.primary.main,
    },
    '& .fc-event': {
      padding: 0,
      cursor: 'pointer',
      fontSize: fontSizes.xs,
      fontWeight: 600,
      borderRadius: '12px',
      border: 'none',
      overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(16,40,37,.06)',
    },
    '& .fc .fc-event-main': {
      padding: 0,
    },
    '& .fc-dayGridMonth-view .fc-event, & .fc-dayGridMonth-view .fc-daygrid-event': {
      borderRadius: 8,
      boxShadow: 'none',
    },
    '& .fc-dayGridMonth-view .fc-event .fc-event-main': {
      padding: '1px 4px',
    },
    '& .fc-timeGridWeek-view, & .fc-timeGridDay-view': {
      '& .fc-event, & .fc-timegrid-event, & .fc-v-event, & .fc-daygrid-event, & .fc-daygrid-block-event':
        {
          borderRadius: '12px !important',
          border: 'none !important',
          overflow: 'hidden',
        },
    },
    '& .fc-event:hover': {
      filter: 'brightness(0.95)',
    },
    '& .fc .fc-highlight': {
      backgroundColor: 'rgba(10, 186, 181, 0.15)',
    },
    '& .fc .fc-event.fc-holiday-nacional, & .fc .fc-event.fc-holiday-municipal': {
      fontSize: fontSizes.xs,
      fontWeight: 600,
      cursor: 'default',
    },
    '& .fc-event.fc-holiday-nacional:hover, & .fc-event.fc-holiday-municipal:hover': {
      filter: 'none',
    },
    '& .fc .fc-event.fc-unavailability': {
      fontSize: fontSizes.xs,
      fontWeight: 600,
      cursor: 'default',
      opacity: 0.95,
    },
    '& .fc-event.fc-unavailability:hover': {
      filter: 'none',
    },
    // "+N mais": pílula discreta sobre o excedente de simultâneos (semana/dia) e no fim da célula (mês).
    '& .fc .fc-timegrid-more-link': {
      backgroundColor: theme.palette.background.paper,
      border: `1px solid ${theme.palette.primary.main}`,
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(16,40,37,.18)',
      color: theme.palette.primary.main,
      cursor: 'pointer',
      fontSize: fontSizes['3xs'],
      fontWeight: 800,
      whiteSpace: 'nowrap',
      zIndex: 5,
    },
    '& .fc .fc-timegrid-more-link-inner': {
      padding: '2px 4px',
    },
    '& .fc .fc-daygrid-more-link': {
      color: theme.palette.primary.main,
      fontSize: fontSizes['2xs'],
      fontWeight: 800,
      padding: '0 4px',
    },
    '& .fc .fc-more-popover': {
      minWidth: 220,
      maxWidth: 'min(320px, 90vw)',
      zIndex: 20,
      backgroundColor: theme.palette.background.paper,
      border: `1px solid ${theme.palette.divider}`,
      borderRadius: '12px',
      boxShadow: theme.shadows[8],
      overflow: 'hidden',
    },
    '& .fc .fc-more-popover .fc-popover-header': {
      backgroundColor: theme.palette.action.hover,
      color: theme.palette.text.primary,
      fontSize: fontSizes.xs,
      fontWeight: 700,
      padding: '6px 10px',
    },
    '& .fc .fc-more-popover .fc-popover-body': {
      maxHeight: 280,
      overflowY: 'auto',
      padding: '6px',
    },
    // No popover os cards não têm altura de grade: deixa crescer para mostrar paciente e procedimento.
    '& .fc .fc-more-popover .fc-timegrid-event': {
      position: 'relative',
      minHeight: 46,
      marginBottom: '4px',
    },
    '& .fc .fc-all-day': {
      minHeight: 28,
    },
    '& .fc-view-harness-active .fc-scroller': {
      overflowY: 'auto !important',
      overflowX: 'auto !important',
    },
  } as const;
}
