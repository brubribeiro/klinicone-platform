import { useMemo } from 'react';
import { useTheme } from '@mui/material';
import type { EventInput } from '@fullcalendar/core';
import { useQueries, useQuery } from '@tanstack/react-query';

import { appointmentsApi } from '../../api/appointments';
import { availabilityApi } from '../../api/availability';
import { usersApi } from '../../api/users';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/usePermissions';
import type { UnavailabilityCalendarItem } from '../../types';
import { buildBrazilCaieirasHolidayEvents } from '../../utils/brazilCaieirasHolidays';
import {
  buildUnavailabilityCalendarEvents,
  filterUnavailabilityInRange,
  slotOverlapsUnavailability,
} from '../../utils/unavailabilityCalendar';
import { slotOverlapsProfessionalAppointment } from '../../utils/appointmentScheduling';
import { appointmentProcedureLabel } from '../../utils/appointmentProcedures';
import { categoryColorFor, kindLabel, statusColors, toDarkEvent } from './agendaConfig';

/**
 * Dados da Agenda no intervalo visível: agendamentos, pendências, indisponibilidades e feriados,
 * já convertidos em eventos do FullCalendar.
 */
export function useAgendaData(range: { from: string; to: string }, filterProfessionalIds: string[]) {
  const theme = useTheme();
  const { user } = useAuth();
  const { restrictToOwnAppointments } = usePermissions();

  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery({
    queryKey: ['appointments', 'range', range.from, range.to],
    queryFn: () => appointmentsApi.list(range.from, range.to),
  });

  const { data: activeUsers = [] } = useQuery({
    queryKey: ['users', 'appointment-providers'],
    queryFn: () => usersApi.listAppointmentProviders(),
    enabled: !restrictToOwnAppointments,
  });

  const { data: pendingAppointments = [] } = useQuery({
    queryKey: ['appointments', 'pending'],
    queryFn: () => appointmentsApi.pending(),
    refetchInterval: 5 * 60_000,
  });

  const unavailabilityUserIds = useMemo(() => {
    if (restrictToOwnAppointments) {
      if (!user || user.providesAppointments === false) return [];
      return [user.id];
    }
    return activeUsers.map((u) => u.id);
  }, [restrictToOwnAppointments, user, activeUsers]);

  const unavailabilityQueries = useQueries({
    queries: unavailabilityUserIds.map((userId) => ({
      queryKey: ['unavailability', userId],
      queryFn: () => availabilityApi.listUnavailability(userId),
      enabled: !!userId,
    })),
  });

  const unavailabilityItems = useMemo<UnavailabilityCalendarItem[]>(() => {
    const merged = unavailabilityUserIds.flatMap((userId, index) => {
      const rows = unavailabilityQueries[index]?.data ?? [];
      const userName = restrictToOwnAppointments
        ? (user?.name ?? '')
        : (activeUsers.find((u) => u.id === userId)?.name ?? '');
      return rows.map((row) => ({
        ...row,
        user: { id: userId, name: userName },
      }));
    });
    return filterUnavailabilityInRange(merged, range.from, range.to);
  }, [
    unavailabilityUserIds,
    unavailabilityQueries,
    restrictToOwnAppointments,
    user?.name,
    activeUsers,
    range.from,
    range.to,
  ]);

  const filteredAppointments = useMemo(
    () =>
      filterProfessionalIds.length > 0
        ? appointments.filter((a) => filterProfessionalIds.includes(a.professionalId))
        : appointments,
    [appointments, filterProfessionalIds],
  );

  const appointmentEvents = useMemo<EventInput[]>(
    () =>
      filteredAppointments.map((a) => {
        const tag = kindLabel[a.kind] ? `[${kindLabel[a.kind]}] ` : '';
        const serviceName = appointmentProcedureLabel(a);
        const catColor = categoryColorFor(serviceName || a.kind || '');
        const statusColor = statusColors[a.status]?.border ?? theme.palette.primary.main;
        return {
          id: a.id,
          title: `${tag}${a.patient?.name ?? 'Paciente'} · ${serviceName}`,
          start: a.startAt,
          end: a.endAt,
          backgroundColor: `${catColor}1A`,
          borderColor: catColor,
          textColor: theme.palette.text.primary,
          extendedProps: {
            appointment: a,
            catColor,
            statusColor,
            sessionLabel:
              a.patientPackageId && a.patientPackage?.sessionsTotal && a.sessionIndex
                ? `Sessão ${a.sessionIndex}/${a.patientPackage.sessionsTotal}`
                : null,
          },
        };
      }),
    [filteredAppointments, theme.palette.text.primary, theme.palette.primary.main],
  );

  const isDark = theme.palette.mode === 'dark';

  const holidayEvents = useMemo(() => {
    const evs = buildBrazilCaieirasHolidayEvents(range.from, range.to);
    return isDark ? evs.map(toDarkEvent) : evs;
  }, [range.from, range.to, isDark]);

  const unavailabilityEvents = useMemo(() => {
    const evs = buildUnavailabilityCalendarEvents(unavailabilityItems, !restrictToOwnAppointments);
    return isDark ? evs.map(toDarkEvent) : evs;
  }, [unavailabilityItems, restrictToOwnAppointments, isDark]);

  const events = useMemo<EventInput[]>(
    () => [...holidayEvents, ...unavailabilityEvents, ...appointmentEvents],
    [holidayEvents, unavailabilityEvents, appointmentEvents],
  );

  /** Slot bloqueado por indisponibilidade ou, na agenda própria, por outro agendamento do profissional. */
  const isSlotBlocked = (start: Date, end: Date) =>
    slotOverlapsUnavailability(start, end, unavailabilityItems) ||
    (restrictToOwnAppointments &&
      !!user &&
      slotOverlapsProfessionalAppointment(start, end, appointments, user.id));

  return { appointmentsLoading, pendingAppointments, events, isSlotBlocked };
}
