import { Box, Paper, Stack, Typography } from '@mui/material';
import dayjs from 'dayjs';

import type { Appointment } from '../../types';
import { fontSizes } from '../../theme/fontSizes';
import { brl } from '../../utils/money';
import { ApplicationMapPreview } from '../application-map/ApplicationMapPreview';
import { EmptyBlock } from './EmptyBlock';
import { appointmentKindLabel, appointmentStatusAccent } from './patientChart';

function AppointmentRowCard({ appt }: { appt: Appointment }) {
  const accent = appointmentStatusAccent[appt.status] ?? 'primary.main';
  const obs = appt.clinicalNotes?.trim() || appt.notes?.trim();

  return (
    <Paper
      variant="outlined"
      sx={{ p: '16px 18px', borderRadius: '14px', bgcolor: 'grey.50', borderColor: 'divider' }}
    >
      <Stack direction="row" spacing={1.5} alignItems="stretch">
        <Box sx={{ width: 3, borderRadius: '3px', bgcolor: accent, flexShrink: 0, alignSelf: 'stretch' }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: fontSizes.md, fontWeight: 800 }} noWrap>
                {appt.procedure?.name ?? appointmentKindLabel[appt.kind] ?? 'Atendimento'}
              </Typography>
              <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }}>
                {dayjs(appt.startAt).format('DD/MM/YYYY [às] HH:mm')}
                {appt.professional?.name ? ` · ${appt.professional.name}` : ''}
              </Typography>
            </Box>
            {appt.procedure?.price != null && (
              <Typography sx={{ fontSize: fontSizes.md, fontWeight: 800, flexShrink: 0 }}>
                {brl.format(Number(appt.procedure.price))}
              </Typography>
            )}
          </Stack>
          {obs && (
            <Box
              sx={{
                mt: 1.25,
                pt: 1.25,
                borderTop: 1,
                borderColor: 'divider',
                fontSize: fontSizes.xs,
                color: 'text.secondary',
                lineHeight: 1.5,
              }}
            >
              <Box component="b" sx={{ color: 'text.disabled', fontSize: fontSizes['2xs'], letterSpacing: '0.3px' }}>
                OBSERVAÇÃO:{' '}
              </Box>
              {obs}
            </Box>
          )}
          {!!appt.applicationMap?.points?.length && <ApplicationMapPreview map={appt.applicationMap} />}
        </Box>
      </Stack>
    </Paper>
  );
}

export function PatientDrawerAppointmentsTab({ appointments }: { appointments?: Appointment[] }) {
  return (
    <Stack spacing={1.5}>
      {appointments && appointments.length > 0 ? (
        appointments.map((appt) => <AppointmentRowCard key={appt.id} appt={appt} />)
      ) : (
        <EmptyBlock message="Nenhum agendamento registrado." />
      )}
    </Stack>
  );
}
