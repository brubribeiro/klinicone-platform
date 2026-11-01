import { useEffect, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, TextField, Typography } from '@mui/material';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import dayjs from 'dayjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../api/admin';
import { useAppToast } from '../../../../frontend/src/contexts/AppToastContext';
import { getApiErrorMessage } from '../../../../frontend/src/utils/apiError';
import { DialogHeader, dialogActionsBorderSx } from '../../../../frontend/src/components/DialogCloseButton';
import { LabeledField } from '../../../../frontend/src/components/LabeledField';
import { fontSizes } from '../../../../frontend/src/theme/fontSizes';
import { formatDateTime } from './adminUi';
import type { PlatformAnnouncement } from '../../../../frontend/src/types';

const INPUT_FORMAT = 'YYYY-MM-DDTHH:mm';

/** Próxima hora cheia (ou a data já agendada). */
const initialValue = (a: PlatformAnnouncement | null) =>
  (a?.scheduledAt ? dayjs(a.scheduledAt) : dayjs().add(1, 'hour').startOf('hour')).format(INPUT_FORMAT);

interface Props {
  announcement: PlatformAnnouncement | null;
  onClose: () => void;
}

/** Agendar o envio (horário local do navegador; o servidor confere a cada minuto). */
export function AnnouncementScheduleDialog({ announcement, onClose }: Props) {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const [value, setValue] = useState('');

  const mutation = useMutation({
    mutationFn: (when: string) => adminApi.scheduleAnnouncement(announcement!.id, dayjs(when).toISOString()),
    onSuccess: (a) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      toast.success(`Envio agendado para ${formatDateTime(a.scheduledAt)}.`);
      onClose();
    },
  });
  const resetMutation = mutation.reset;

  useEffect(() => {
    if (!announcement) return;
    setValue(initialValue(announcement));
    resetMutation();
  }, [announcement, resetMutation]);

  const parsed = dayjs(value);
  const invalid = !value || !parsed.isValid() || !parsed.isAfter(dayjs());

  return (
    <Dialog open={!!announcement} onClose={onClose} maxWidth="xs" fullWidth>
      <Box
        component="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!invalid) mutation.mutate(value);
        }}
      >
        <DialogHeader
          onClose={onClose}
          title="Agendar envio"
          subtitle={announcement?.title}
          icon={<EventOutlinedIcon fontSize="small" />}
        />
        <DialogContent sx={{ '&.MuiDialogContent-root': { pt: 2.5 } }}>
          <LabeledField label="Enviar em">
            <TextField
              type="datetime-local"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputProps={{ 'aria-label': 'Enviar em', min: dayjs().format(INPUT_FORMAT) }}
              error={!!value && invalid}
              helperText={value && invalid ? 'Escolha uma data e hora no futuro' : 'No fuso horário do seu navegador'}
              fullWidth
              autoFocus
            />
          </LabeledField>
          <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', mt: 1.5 }}>
            Até lá você ainda pode editar o texto ou cancelar o agendamento.
          </Typography>
          {mutation.error && (
            <Alert severity="error" variant="outlined" sx={{ mt: 2 }}>
              {getApiErrorMessage(mutation.error, 'Não foi possível agendar.')}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={dialogActionsBorderSx}>
          <Button onClick={onClose} type="button" disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={invalid || mutation.isPending}>
            {mutation.isPending ? 'Agendando…' : 'Agendar'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
