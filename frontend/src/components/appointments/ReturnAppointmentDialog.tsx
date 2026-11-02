import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';

import { appointmentsApi } from '../../api/appointments';
import { availabilityApi } from '../../api/availability';
import { useAppToast } from '../../contexts/AppToastContext';
import { getApiErrorMessage } from '../../utils/apiError';
import {
  computeEarliestRecurrenceDate,
  formatRecurrenceEarliestLabel,
  isDateBeforeRecurrenceEarliest,
} from '../../utils/appointmentRecurrence';
import type { Appointment, Procedure } from '../../types';
import {
  resolveReturnProcedures,
  returnRecurrenceDays,
  totalDurationMinutes,
} from '../../utils/appointmentProcedures';
import { DialogHeader } from '../DialogCloseButton';
import { invalidateAppointmentListQueries } from './appointmentCache';

/** Sugere e cria o retorno logo após concluir um procedimento. */
export function ReturnAppointmentDialog({
  pendingReturn,
  procedures,
  fallbackProcedures,
  onClose,
}: {
  /** Atendimento concluído; o diálogo fica aberto enquanto estiver definido. */
  pendingReturn: Appointment | null;
  procedures: Procedure[];
  fallbackProcedures: Procedure[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const open = !!pendingReturn;
  const [returnDate, setReturnDate] = useState('');
  const [returnStartTime, setReturnStartTime] = useState('');
  const [returnCreateError, setReturnCreateError] = useState<string | null>(null);

  // O retorno repete todos os procedimentos do atendimento concluído.
  const returnProcedures = useMemo(
    () => (pendingReturn ? resolveReturnProcedures(pendingReturn, procedures, fallbackProcedures) : []),
    [pendingReturn, procedures, fallbackProcedures],
  );
  const returnProcedureIds = returnProcedures.map((p) => p.id);
  const recurrenceDays = returnRecurrenceDays(returnProcedures);
  const durationMinutes = returnProcedures.length
    ? totalDurationMinutes(returnProcedures, returnProcedureIds)
    : 60;

  const returnMinDate = useMemo(() => {
    if (!pendingReturn || !recurrenceDays) return null;
    return computeEarliestRecurrenceDate(pendingReturn.startAt, recurrenceDays);
  }, [pendingReturn, recurrenceDays]);

  const returnDateTooEarly =
    !!returnMinDate && !!returnDate && isDateBeforeRecurrenceEarliest(returnDate, returnMinDate);

  const returnDateTime = useMemo(
    () => (returnDate && returnStartTime ? dayjs(`${returnDate}T${returnStartTime}`) : null),
    [returnDate, returnStartTime],
  );

  const returnProfessionalId = pendingReturn?.professionalId ?? pendingReturn?.professional?.id ?? '';

  const returnSlotEnd = useMemo(
    () =>
      returnDateTime?.isValid()
        ? returnDateTime.add(durationMinutes, 'minute')
        : null,
    [returnDateTime, durationMinutes],
  );

  const returnSlotValid =
    !!returnDateTime?.isValid() && !!returnSlotEnd?.isValid() && returnSlotEnd.isAfter(returnDateTime);

  const { data: returnAvailableProfessionals = [], isLoading: loadingReturnAvailability } = useQuery({
    queryKey: [
      'return-available-professionals',
      returnDate,
      returnStartTime,
      durationMinutes,
    ],
    queryFn: () =>
      availabilityApi.listAvailableProfessionals(
        returnDateTime!.toISOString(),
        returnSlotEnd!.toISOString(),
      ),
    enabled: open && returnSlotValid,
  });

  const returnProfessionalAvailable = useMemo(() => {
    if (!returnProfessionalId || !returnSlotValid) return false;
    if (loadingReturnAvailability) return true;
    return returnAvailableProfessionals.some((p) => p.id === returnProfessionalId);
  }, [returnProfessionalId, returnSlotValid, loadingReturnAvailability, returnAvailableProfessionals]);

  useEffect(() => {
    if (!pendingReturn) {
      setReturnDate('');
      setReturnStartTime('');
      setReturnCreateError(null);
      return;
    }
    const suggested = dayjs(pendingReturn.startAt).add(recurrenceDays ?? 7, 'day');
    setReturnDate(suggested.format('YYYY-MM-DD'));
    setReturnStartTime(suggested.format('HH:mm'));
    setReturnCreateError(null);
  }, [pendingReturn, recurrenceDays]);

  const createReturnMutation = useMutation({
    mutationFn: async () => {
      if (!pendingReturn || !returnDate || !returnStartTime) return;
      const professionalId = pendingReturn.professionalId ?? pendingReturn.professional?.id;
      if (!professionalId || returnProcedureIds.length === 0) {
        throw new Error('Dados do atendimento incompletos para agendar o retorno.');
      }
      const returnStart = dayjs(`${returnDate}T${returnStartTime}`);
      if (!returnStart.isValid()) {
        throw new Error('Data ou horário do retorno inválido.');
      }
      if (returnMinDate && isDateBeforeRecurrenceEarliest(returnDate, returnMinDate)) {
        throw new Error(
          `Retorno só pode ser agendado a partir de ${formatRecurrenceEarliestLabel(returnMinDate)}.`,
        );
      }
      return appointmentsApi.create({
        patientId: pendingReturn.patientId,
        procedureIds: returnProcedureIds,
        procedureId: returnProcedureIds[0],
        professionalId,
        startAt: returnStart.toISOString(),
        endAt: returnStart.add(durationMinutes, 'minute').toISOString(),
        status: 'SCHEDULED',
        kind: 'RETURN',
        notes: recurrenceDays
          ? 'Retorno automático sugerido'
          : 'Retorno agendado manualmente',
      });
    },
    onSuccess: () => {
      invalidateAppointmentListQueries(queryClient);
      onClose();
      toast.success('Retorno agendado.');
    },
    onError: (err: unknown) => {
      const message = getApiErrorMessage(err, 'Não foi possível agendar o retorno.');
      setReturnCreateError(message);
      toast.error(message);
    },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogHeader
        onClose={onClose}
        title="Agendar retorno?"
        subtitle="Confirme a data do próximo atendimento"
        icon={<EventRepeatIcon fontSize="small" />}
      />
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {pendingReturn && recurrenceDays ? (
            <Typography variant="body2">
              Intervalo de retorno: <strong>{recurrenceDays} dias</strong>.
              {returnMinDate ? (
                <>
                  {' '}
                  Só é possível agendar a partir de{' '}
                  <strong>{formatRecurrenceEarliestLabel(returnMinDate)}</strong>.
                </>
              ) : null}
            </Typography>
          ) : pendingReturn ? (
            <Typography variant="body2" color="text.secondary">
              {returnProcedures.length > 1 ? 'Estes procedimentos não têm' : 'Este procedimento não tem'}{' '}
              intervalo de retorno cadastrado. Escolha manualmente a data
              e o horário do retorno.
            </Typography>
          ) : null}
          {returnCreateError && <Alert severity="error">{returnCreateError}</Alert>}
          {!loadingReturnAvailability &&
            returnSlotValid &&
            returnProfessionalId &&
            !returnProfessionalAvailable && (
              <Alert severity="warning">
                O profissional não está disponível neste horário (expediente, folga ou conflito).
                Escolha outra data ou horário.
              </Alert>
            )}
          {returnDateTooEarly && returnMinDate && (
            <Alert severity="warning">
              A data deve ser a partir de {formatRecurrenceEarliestLabel(returnMinDate)}.
            </Alert>
          )}
          <TextField
            type="date"
            label="Data do retorno"
            value={returnDate}
            onChange={(e) => {
              setReturnDate(e.target.value);
              setReturnCreateError(null);
            }}
            fullWidth
            required
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: returnMinDate ?? undefined }}
            error={returnDateTooEarly}
            helperText={
              returnMinDate
                ? `Disponível a partir de ${formatRecurrenceEarliestLabel(returnMinDate)}`
                : undefined
            }
          />
          <TextField
            type="time"
            label="Horário"
            value={returnStartTime}
            onChange={(e) => {
              setReturnStartTime(e.target.value);
              setReturnCreateError(null);
            }}
            fullWidth
            required
            InputLabelProps={{ shrink: true }}
          />
          {returnDateTime?.isValid() && returnProcedures.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              {returnProcedures.map((p) => p.name).join(' + ')} · {durationMinutes} min · mesmo
              profissional e {returnProcedures.length > 1 ? 'procedimentos' : 'procedimento'} do
              atendimento concluído.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Agora não</Button>
        <Button
          variant="contained"
          startIcon={<EventRepeatIcon />}
          disabled={
            createReturnMutation.isPending ||
            loadingReturnAvailability ||
            !returnDate ||
            !returnStartTime ||
            !returnSlotValid ||
            !returnProfessionalAvailable ||
            returnDateTooEarly
          }
          onClick={() => {
            setReturnCreateError(null);
            createReturnMutation.mutate();
          }}
        >
          {createReturnMutation.isPending ? 'Criando...' : 'Criar retorno'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
