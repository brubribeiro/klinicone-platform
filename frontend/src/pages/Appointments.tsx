import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { Box, Card, useMediaQuery, useTheme } from '@mui/material';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import type { DatesSetArg, DateSelectArg, EventClickArg, DateClickArg } from '@fullcalendar/core';

import { PageHeader } from '../components/PageHeader';
import { useUrlState, urlDate, urlEnum, urlList } from '../hooks/useUrlState';
import { AppointmentFormDialog } from '../components/appointments/AppointmentFormDialog';
import { usePermissions } from '../contexts/usePermissions';
import type { Appointment } from '../types';
import { useAgendaData } from '../components/appointments/useAgendaData';
import { useCalendarKeyboardScroll } from '../components/appointments/useCalendarKeyboardScroll';
import { PendingAppointmentsBanner } from '../components/appointments/PendingAppointmentsBanner';
import { AgendaToolbar } from '../components/appointments/AgendaToolbar';
import { AgendaStatusLegend } from '../components/appointments/AgendaStatusLegend';
import { AgendaCalendarSkeleton } from '../components/appointments/AgendaCalendarSkeleton';
import { agendaCalendarSx } from '../components/appointments/agendaCalendarSx';
import { AGENDA_VIEWS } from '../components/appointments/agendaConfig';
import { renderAgendaDayHeader, renderAgendaEventContent } from '../components/appointments/agendaCalendarContent';

const AGENDA_VIEW_CODEC = urlEnum(AGENDA_VIEWS.map((v) => v.view));

export function Appointments() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { has, restrictToOwnAppointments } = usePermissions();
  const canCreate = has('appointments:create');
  const calendarRef = useRef<FullCalendar | null>(null);
  const [currentView, setCurrentView] = useUrlState(
    'visao',
    isMobile ? 'timeGridDay' : 'timeGridWeek',
    AGENDA_VIEW_CODEC,
  );
  const [currentDate, setCurrentDate] = useUrlState('data', dayjs().format('YYYY-MM-DD'), urlDate);
  const [periodLabel, setPeriodLabel] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [defaultStart, setDefaultStart] = useState<Date | null>(null);
  const [defaultPatientId, setDefaultPatientId] = useState<string | null>(null);
  const [filterProfessionalIds] = useUrlState<string[]>('profissionais', [], urlList);

  const [range, setRange] = useState<{ from: string; to: string }>(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    return { from: from.toISOString(), to: to.toISOString() };
  });

  const { appointmentsLoading, pendingAppointments, events, isSlotBlocked } = useAgendaData(
    range,
    filterProfessionalIds,
  );

  const openNew = (start: Date | null = null, patientId: string | null = null) => {
    setEditing(null);
    setDefaultStart(start);
    setDefaultPatientId(patientId);
    setFormOpen(true);
  };

  const openEdit = (appt: Appointment) => {
    setEditing(appt);
    setDefaultStart(null);
    setFormOpen(true);
  };

  // Abre a modal automaticamente quando chega via "Novo agendamento" do header (?novo=1)
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('novo') === '1' && canCreate) {
      openNew(null, searchParams.get('paciente'));
      const next = new URLSearchParams(searchParams);
      next.delete('novo');
      next.delete('paciente');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, canCreate]);

  const handleDatesSet = (info: DatesSetArg) => {
    setRange({ from: info.start.toISOString(), to: info.end.toISOString() });
    setPeriodLabel(info.view.title);
    setCurrentView(info.view.type);
    setCurrentDate(dayjs(info.view.calendar.getDate()).format('YYYY-MM-DD'));
  };

  const handleSelect = (info: DateSelectArg) => {
    if (!canCreate) return;
    if (isSlotBlocked(info.start, info.end)) return;
    openNew(info.start);
  };

  const handleDateClick = (info: DateClickArg) => {
    if (!canCreate) return;
    openNew(info.date);
  };

  const handleEventClick = (info: EventClickArg) => {
    if (info.event.extendedProps?.holiday) return;
    if (info.event.extendedProps?.unavailability) return;
    const appt = info.event.extendedProps?.appointment as Appointment | undefined;
    if (!appt) return;
    openEdit(appt);
  };

  const handleCalendarKeyDown = useCalendarKeyboardScroll(calendarRef);
  const calendarApi = () => calendarRef.current?.getApi();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: { xs: 'calc(100vh - 100px)', md: 'calc(100vh - 128px)' },
      }}
    >
      <PageHeader
        title="Agenda"
        subtitle={
          restrictToOwnAppointments
            ? 'Sua agenda · feriados · indisponibilidades'
            : 'Agendamentos, feriados e bloqueios de indisponibilidade dos profissionais'
        }
      />

      <PendingAppointmentsBanner appointments={pendingAppointments} onOpen={openEdit} />

      <AgendaToolbar
        periodLabel={periodLabel}
        currentView={currentView}
        onPrev={() => calendarApi()?.prev()}
        onNext={() => calendarApi()?.next()}
        onToday={() => calendarApi()?.today()}
        onChangeView={(view) => calendarApi()?.changeView(view)}
      />

      <AgendaStatusLegend />

      <Card
        tabIndex={0}
        data-tour="agenda-calendar"
        role="region"
        aria-label="Calendário de agendamentos"
        onKeyDown={handleCalendarKeyDown}
        sx={agendaCalendarSx(theme)}
      >
        {appointmentsLoading && <AgendaCalendarSkeleton />}
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={currentView}
          initialDate={currentDate}
          locale={ptBrLocale}
          height="100%"
          scrollTime="08:00:00"
          headerToolbar={false}
          slotMinTime="07:00:00"
          slotMaxTime="22:00:00"
          slotDuration="00:30:00"
          allDaySlot
          nowIndicator
          weekends
          selectable
          selectMirror
          dayMaxEvents
          firstDay={1}
          events={events}
          datesSet={handleDatesSet}
          select={handleSelect}
          selectAllow={(info) => !isSlotBlocked(info.start, info.end)}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          dayHeaderContent={renderAgendaDayHeader}
          eventContent={(arg) => renderAgendaEventContent(arg, theme)}
        />
      </Card>

      <AppointmentFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setDefaultStart(null);
          setDefaultPatientId(null);
        }}
        appointment={editing}
        defaultStart={defaultStart}
        defaultPatientId={defaultPatientId}
      />
    </Box>
  );
}
