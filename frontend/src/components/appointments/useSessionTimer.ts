import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { appointmentsApi } from '../../api/appointments';
import { useAppToast } from '../../contexts/AppToastContext';
import { getApiErrorMessage } from '../../utils/apiError';
import type { Appointment } from '../../types';
import { invalidateAppointmentListQueries } from './appointmentCache';

/** Cronômetro opcional da sessão (iniciar / pausar / retomar) de um agendamento existente. */
export function useSessionTimer({
  open,
  appointment,
  appointmentDetail,
  onStarted,
}: {
  open: boolean;
  appointment?: Appointment | null;
  appointmentDetail?: Appointment;
  onStarted: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isInProgress =
    appointmentDetail?.status === 'IN_PROGRESS' || appointment?.status === 'IN_PROGRESS';
  const hasStartedAt = !!(appointmentDetail?.startedAt ?? appointment?.startedAt);
  const hasFinishedAt = !!(appointmentDetail?.finishedAt ?? appointment?.finishedAt);
  const canStartSession =
    !!appointment &&
    (appointment.status === 'SCHEDULED' || appointment.status === 'CONFIRMED') &&
    !hasStartedAt;
  const showSessionControls = !!appointment && (canStartSession || isInProgress || hasStartedAt);

  const startTimer = useCallback((startedAt: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const calc = () => Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    setElapsed(calc());
    timerRef.current = setInterval(() => setElapsed(calc()), 1000);
  }, []);

  useEffect(() => {
    if (!open) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    const detail = appointmentDetail ?? appointment;
    if (detail?.startedAt && !detail?.finishedAt) {
      startTimer(detail.startedAt);
    } else if (detail?.startedAt && detail?.finishedAt) {
      setElapsed(Math.floor((new Date(detail.finishedAt).getTime() - new Date(detail.startedAt).getTime()) / 1000));
    } else {
      setElapsed(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open, appointmentDetail, appointment, startTimer]);

  const startMutation = useMutation({
    mutationFn: () => appointmentsApi.start(appointment!.id),
    onSuccess: (saved) => {
      invalidateAppointmentListQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ['appointment', saved.id] });
      if (saved.startedAt) startTimer(saved.startedAt);
      onStarted();
      toast.success('Atendimento iniciado.');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Não foi possível iniciar o atendimento.'));
    },
  });

  const pauseMutation = useMutation({
    mutationFn: () => appointmentsApi.finish(appointment!.id),
    onSuccess: (saved) => {
      if (timerRef.current) clearInterval(timerRef.current);
      invalidateAppointmentListQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ['appointment', saved.id] });
      toast.success('Atendimento pausado.');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Não foi possível pausar o atendimento.'));
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () => appointmentsApi.resume(appointment!.id),
    onSuccess: (saved) => {
      invalidateAppointmentListQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ['appointment', saved.id] });
      if (saved.startedAt) startTimer(saved.startedAt);
      toast.success('Atendimento retomado.');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Não foi possível retomar o atendimento.'));
    },
  });

  const stopTimerIfRunning = useCallback(async () => {
    if (!appointment) return;
    const detail = appointmentDetail ?? appointment;
    if (detail.status === 'IN_PROGRESS' && !detail.finishedAt) {
      await appointmentsApi.finish(appointment.id);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [appointment, appointmentDetail]);

  return {
    elapsed,
    isInProgress,
    hasStartedAt,
    hasFinishedAt,
    canStartSession,
    canFinishSession: isInProgress,
    showSessionControls,
    startMutation,
    pauseMutation,
    resumeMutation,
    stopTimerIfRunning,
  };
}

export type SessionTimer = ReturnType<typeof useSessionTimer>;
