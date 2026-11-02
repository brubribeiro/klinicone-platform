import { useEffect, useMemo, useRef } from 'react';
import type { UseFormSetValue } from 'react-hook-form';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';

import { availabilityApi } from '../../api/availability';
import { usersApi } from '../../api/users';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/usePermissions';
import type { Appointment } from '../../types';
import type { FormValues } from './appointmentFormModel';

/**
 * Disponibilidade de profissionais para o horário escolhido, seleção automática
 * em novos agendamentos e flags de conflito que bloqueiam o salvamento.
 */
export function useAppointmentProfessionals({
  open,
  formInitialized,
  appointment,
  appointmentDetail,
  durationMinutes,
  selectedDate,
  selectedStartTime,
  selectedProfessionalId,
  setValue,
}: {
  open: boolean;
  formInitialized: boolean;
  appointment?: Appointment | null;
  appointmentDetail?: Appointment;
  durationMinutes: number;
  selectedDate: string;
  selectedStartTime: string;
  selectedProfessionalId: string;
  setValue: UseFormSetValue<FormValues>;
}) {
  const { user } = useAuth();
  const { restrictToOwnAppointments } = usePermissions();
  const professionalManuallySelectedRef = useRef(false);

  const { data: appointmentProviders = [] } = useQuery({
    queryKey: ['users', 'appointment-providers'],
    queryFn: () => usersApi.listAppointmentProviders(),
    enabled: open,
  });

  const slotStart = useMemo(
    () => dayjs(`${selectedDate}T${selectedStartTime}`),
    [selectedDate, selectedStartTime],
  );
  const slotEnd = useMemo(
    () => slotStart.add(durationMinutes, 'minute'),
    [slotStart, durationMinutes],
  );
  const slotValid = slotStart.isValid() && slotEnd.isValid() && slotEnd.isAfter(slotStart);

  const {
    data: availableProfessionals = [],
    isLoading: loadingProfessionals,
    isFetching: fetchingProfessionals,
  } = useQuery({
    queryKey: [
      'available-professionals',
      selectedDate,
      selectedStartTime,
      durationMinutes,
      appointment?.id,
    ],
    queryFn: () =>
      availabilityApi.listAvailableProfessionals(
        slotStart.toISOString(),
        slotEnd.toISOString(),
        appointment?.id,
      ),
    enabled: open && slotValid && formInitialized,
    placeholderData: keepPreviousData,
  });

  const checkingAvailability = loadingProfessionals;
  const verifyingAvailability = fetchingProfessionals && !loadingProfessionals;

  const professionalOptions = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    for (const p of availableProfessionals) byId.set(p.id, p);

    const fallbacks = [appointmentDetail?.professional, appointment?.professional];
    for (const p of fallbacks) {
      if (p?.id && !byId.has(p.id)) byId.set(p.id, p);
    }

    if (selectedProfessionalId) {
      const fromProviders = appointmentProviders.find((p) => p.id === selectedProfessionalId);
      if (fromProviders && !byId.has(fromProviders.id)) byId.set(fromProviders.id, fromProviders);
    }

    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [
    availableProfessionals,
    appointment,
    appointmentDetail,
    selectedProfessionalId,
    appointmentProviders,
  ]);

  const assignedProfessional = useMemo(() => {
    if (appointment?.professional) return appointment.professional;
    const id = selectedProfessionalId;
    if (!id) return undefined;
    return (
      appointmentProviders.find((p) => p.id === id) ??
      availableProfessionals.find((p) => p.id === id)
    );
  }, [appointment?.professional, selectedProfessionalId, appointmentProviders, availableProfessionals]);

  const selectedProfessional = useMemo(
    () => professionalOptions.find((p) => p.id === selectedProfessionalId),
    [professionalOptions, selectedProfessionalId],
  );

  const selectedPerformsAppointments = useMemo(() => {
    if (!selectedProfessionalId) return false;
    return appointmentProviders.some((p) => p.id === selectedProfessionalId);
  }, [selectedProfessionalId, appointmentProviders]);

  const loggedUserCannotBeScheduled =
    !!restrictToOwnAppointments && !!user && user.providesAppointments === false;

  useEffect(() => {
    if (!open || appointment) return;
    professionalManuallySelectedRef.current = false;
  }, [open, appointment]);

  useEffect(() => {
    if (!open || appointment) return;

    if (restrictToOwnAppointments && user) {
      if (loggedUserCannotBeScheduled) {
        setValue('professionalId', '');
        return;
      }
      if (!slotValid) return;
      if (fetchingProfessionals && availableProfessionals.length === 0) return;
      if (availableProfessionals.some((p) => p.id === user.id)) {
        setValue('professionalId', user.id);
      } else {
        setValue('professionalId', '');
      }
      return;
    }

    if (!slotValid) return;
    if (fetchingProfessionals && availableProfessionals.length === 0) return;

    if (selectedProfessionalId && (fetchingProfessionals || professionalManuallySelectedRef.current)) {
      return;
    }

    if (availableProfessionals.length === 0) {
      setValue('professionalId', '');
      return;
    }

    if (!selectedProfessionalId) {
      setValue('professionalId', availableProfessionals[0].id);
      return;
    }

    const currentStillAvailable = availableProfessionals.some(
      (p) => p.id === selectedProfessionalId,
    );
    if (!currentStillAvailable) {
      setValue('professionalId', availableProfessionals[0].id);
    }
  }, [
    open,
    appointment,
    restrictToOwnAppointments,
    user,
    slotValid,
    fetchingProfessionals,
    availableProfessionals,
    selectedProfessionalId,
    loggedUserCannotBeScheduled,
    setValue,
  ]);

  const noProfessionalAvailable =
    !appointment &&
    slotValid &&
    !checkingAvailability &&
    !fetchingProfessionals &&
    !loggedUserCannotBeScheduled &&
    !selectedProfessionalId;

  const timeOrProfessionalChanged = useMemo(() => {
    if (!appointment) return true;
    const start = dayjs(`${selectedDate}T${selectedStartTime}`);
    const end = start.add(durationMinutes, 'minute');
    return (
      !start.isSame(appointment.startAt) ||
      !end.isSame(appointment.endAt) ||
      selectedProfessionalId !== appointment.professionalId
    );
  }, [
    appointment,
    selectedDate,
    selectedStartTime,
    durationMinutes,
    selectedProfessionalId,
  ]);

  const scheduleSlotBlocked =
    slotValid &&
    !fetchingProfessionals &&
    !!selectedProfessionalId &&
    !availableProfessionals.some((p) => p.id === selectedProfessionalId);

  const requiresValidProvider = !appointment || timeOrProfessionalChanged;

  const professionalSlotConflict =
    !fetchingProfessionals &&
    ((scheduleSlotBlocked && timeOrProfessionalChanged) ||
      (requiresValidProvider && !!selectedProfessionalId && !selectedPerformsAppointments));

  const blockingMessage = loggedUserCannotBeScheduled
    ? 'Seu usuário não realiza atendimentos e não pode receber agendamentos.'
    : professionalSlotConflict && !selectedPerformsAppointments
      ? 'Selecione um profissional que realiza atendimentos.'
      : professionalSlotConflict
        ? 'Este profissional já tem agendamento ativo no mesmo horário.'
        : noProfessionalAvailable
          ? 'Nenhum profissional disponível para este horário.'
          : null;

  return {
    restrictToOwnAppointments: !!restrictToOwnAppointments,
    user,
    appointmentProviders,
    slotEnd,
    slotValid,
    checkingAvailability,
    verifyingAvailability,
    professionalOptions,
    assignedProfessional,
    selectedProfessional,
    selectedPerformsAppointments,
    loggedUserCannotBeScheduled,
    noProfessionalAvailable,
    professionalSlotConflict,
    requiresValidProvider,
    blockingMessage,
    markManualSelection: () => {
      professionalManuallySelectedRef.current = true;
    },
  };
}

export type AppointmentProfessionals = ReturnType<typeof useAppointmentProfessionals>;
