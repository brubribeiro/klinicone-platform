import { Box, Button, Card, CardContent, Skeleton, Stack, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { Link as RouterLink } from 'react-router-dom';

import type { Appointment, AppointmentStatus } from '../../types';
import { fontSizes } from '../../theme/fontSizes';
import { clickableProps } from '../../utils/a11y';
import { appointmentProcedureLabel } from '../../utils/appointmentProcedures';
import { DashboardEmptyState } from './DashboardEmptyState';

const statusLabelDashboard: Partial<Record<AppointmentStatus, string>> = {
  SCHEDULED: 'Agendado',
  CONFIRMED: 'Confirmado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Faltou',
};

// Pills de status no estilo Aurora (fundo tint suave + texto colorido).
const AGENDA_PILL_SX: Record<string, { bgcolor: string; color: string }> = {
  SCHEDULED: { bgcolor: 'rgba(201,138,18,.16)', color: '#C98A12' },
  CONFIRMED: { bgcolor: 'rgba(17,168,147,.15)', color: '#11A893' },
  COMPLETED: { bgcolor: 'rgba(46,125,214,.15)', color: '#3787DE' },
  NO_SHOW: { bgcolor: 'rgba(214,90,90,.14)', color: '#D65A5A' },
  CANCELLED: { bgcolor: 'rgba(120,134,130,.16)', color: '#7C8B87' },
};

interface WeekAgendaCardProps {
  appointments: Appointment[];
  loading: boolean;
  /** Sem permissão de agenda, a lista não abre a modal nem mostra "Ver tudo". */
  canSeeAgenda: boolean;
  onOpen: (appointment: Appointment) => void;
}

/** Card "Agenda para os próximos dias": agendamentos restantes da semana. */
export function WeekAgendaCard({ appointments, loading, canSeeAgenda, onOpen }: WeekAgendaCardProps) {
  return (
    <Card sx={{ display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ p: { xs: 2, sm: 2.75 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: fontSizes.xl, fontWeight: 700 }}>Agenda para os próximos dias</Typography>
          {canSeeAgenda && (
            <Button size="small" component={RouterLink} to="/agenda" sx={{ fontWeight: 700 }}>
              Ver tudo
            </Button>
          )}
        </Stack>
        {loading ? (
          <Stack spacing={1.5}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rounded" height={44} />
            ))}
          </Stack>
        ) : appointments.length === 0 ? (
          <DashboardEmptyState message="Sem agendamentos nesta semana." />
        ) : (
          <Stack spacing={0.5} sx={{ maxHeight: 260, overflowY: 'auto', pr: 0.5, mr: -0.5 }}>
            {appointments.map((a) => (
              <Stack
                key={a.id}
                direction="row"
                alignItems="center"
                spacing={1.5}
                {...(canSeeAgenda && clickableProps(() => onOpen(a)))}
                sx={{
                  px: 1,
                  py: 1.25,
                  borderRadius: 2,
                  cursor: canSeeAgenda ? 'pointer' : 'default',
                  '&:hover': canSeeAgenda ? { bgcolor: 'grey.50' } : undefined,
                }}
              >
                <Box sx={{ width: 46, flexShrink: 0, textAlign: 'center', lineHeight: 1.15 }}>
                  <Typography
                    sx={{
                      fontSize: fontSizes['3xs'],
                      fontWeight: 700,
                      color: 'text.secondary',
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                    }}
                  >
                    {dayjs(a.startAt).format('ddd')}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: fontSizes.sm,
                      fontWeight: 800,
                      color: 'text.primary',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {dayjs(a.startAt).format('HH:mm')}
                  </Typography>
                </Box>
                <Box sx={{ width: 3, height: 34, borderRadius: 3, bgcolor: 'primary.main', flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: fontSizes.md, fontWeight: 700 }}>
                    {a.patient?.name ?? 'Paciente'}
                  </Typography>
                  <Typography noWrap sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }}>
                    {[appointmentProcedureLabel(a) || 'Procedimento', a.professional?.name]
                      .filter(Boolean)
                      .join(' · ')}
                  </Typography>
                </Box>
                <Box
                  component="span"
                  sx={{
                    flexShrink: 0,
                    fontSize: fontSizes['2xs'],
                    fontWeight: 700,
                    px: 1.25,
                    py: 0.5,
                    borderRadius: '8px',
                    whiteSpace: 'nowrap',
                    ...(AGENDA_PILL_SX[a.status] ?? AGENDA_PILL_SX.CANCELLED),
                  }}
                >
                  {statusLabelDashboard[a.status as AppointmentStatus] ?? a.status}
                </Box>
              </Stack>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
