import { useMemo, useState } from 'react';
import { Box, Button, IconButton, Paper, Stack, Typography, alpha } from '@mui/material';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import dayjs from 'dayjs';

import type { Appointment } from '../../types';
import { fontSizes } from '../../theme/fontSizes';
import { brl } from '../../utils/money';
import { ApplicationMapPreview } from '../application-map/ApplicationMapPreview';
import { EmptyBlock } from './EmptyBlock';
import { appointmentKindLabel, appointmentStatusAccent } from './patientChart';

const APPTS_PAGE_SIZE = 6;

function isApptPaid(a: Appointment) {
  return !!a.financeGenerated || !!(a.financialEntries && a.financialEntries.length > 0);
}

export function PatientAppointmentsTab({ appointments }: { appointments: Appointment[] }) {
  const [page, setPage] = useState(0);
  const [payFilter, setPayFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const filtered = useMemo(() => {
    let list = appointments;
    if (payFilter === 'paid') list = list.filter(isApptPaid);
    else if (payFilter === 'unpaid') list = list.filter((a) => !isApptPaid(a));
    return [...list].sort((a, b) => {
      const d = dayjs(a.startAt).valueOf() - dayjs(b.startAt).valueOf();
      return sortDir === 'asc' ? d : -d;
    });
  }, [appointments, payFilter, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / APPTS_PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const rows = filtered.slice(current * APPTS_PAGE_SIZE, current * APPTS_PAGE_SIZE + APPTS_PAGE_SIZE);

  return (
    <Stack spacing={1.5}>
      {/* Filtros */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" spacing={1} useFlexGap>
        <Box sx={{ display: 'inline-flex', gap: 0.5, p: 0.5, borderRadius: '10px', bgcolor: 'grey.100' }}>
          {([
            { k: 'all', l: 'Todos' },
            { k: 'paid', l: 'Pago' },
            { k: 'unpaid', l: 'Não pago' },
          ] as const).map((o) => {
            const active = payFilter === o.k;
            return (
              <Box
                key={o.k}
                component="button"
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setPayFilter(o.k);
                  setPage(0);
                }}
                sx={{
                  border: 0,
                  cursor: 'pointer',
                  px: 1.5,
                  py: 0.65,
                  borderRadius: '8px',
                  fontFamily: 'inherit',
                  fontSize: fontSizes.xs,
                  fontWeight: 700,
                  color: active ? 'primary.main' : 'text.secondary',
                  bgcolor: active ? 'background.paper' : 'transparent',
                  boxShadow: active ? '0 1px 3px rgba(16,40,37,0.12)' : 'none',
                }}
              >
                {o.l}
              </Box>
            );
          })}
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={<ArrowUpwardRoundedIcon sx={{ fontSize: 15, transform: sortDir === 'desc' ? 'rotate(180deg)' : 'none' }} />}
          onClick={() => {
            setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
            setPage(0);
          }}
          sx={{
            height: 34,
            borderRadius: '9px',
            bgcolor: 'background.paper',
            borderColor: 'divider',
            color: 'text.secondary',
            fontWeight: 700,
            fontSize: fontSizes.xs,
            '&:hover': { bgcolor: 'grey.50', borderColor: 'divider' },
          }}
        >
          {sortDir === 'desc' ? 'Mais recentes' : 'Mais antigos'}
        </Button>
      </Stack>

      {filtered.length === 0 ? (
        <EmptyBlock
          message={
            appointments.length === 0
              ? 'Nenhum agendamento registrado.'
              : 'Nenhum agendamento com esse filtro.'
          }
        />
      ) : (
        rows.map((appt) => <AppointmentRowCard key={appt.id} appt={appt} />)
      )}
      {pageCount > 1 && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ pt: 0.5 }}>
          <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', fontWeight: 600 }}>
            {current * APPTS_PAGE_SIZE + 1}–{Math.min((current + 1) * APPTS_PAGE_SIZE, filtered.length)} de{' '}
            {filtered.length}
          </Typography>
          <Stack direction="row" spacing={0.75}>
            <IconButton
              aria-label="Página anterior"
              size="small"
              disabled={current === 0}
              onClick={() => setPage((v) => Math.max(0, v - 1))}
              sx={{ border: 1, borderColor: 'divider', borderRadius: '9px' }}
            >
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
            <IconButton
              aria-label="Próxima página"
              size="small"
              disabled={current >= pageCount - 1}
              onClick={() => setPage((v) => Math.min(pageCount - 1, v + 1))}
              sx={{ border: 1, borderColor: 'divider', borderRadius: '9px' }}
            >
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}

function AppointmentRowCard({ appt }: { appt: Appointment }) {
  const accent = appointmentStatusAccent[appt.status] ?? 'primary.main';
  const income = appt.financialEntries?.[0];
  const paid = !!appt.financeGenerated || !!income;
  const value = income ? Number(income.amount) : (appt.procedure as any)?.price;
  const paymentName = income?.paymentMethod?.name;
  const adminNotes = appt.notes?.trim();
  const clinicalNotes = appt.clinicalNotes?.trim();

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
            {value != null && (
              <Typography sx={{ fontSize: fontSizes.md, fontWeight: 800, flexShrink: 0 }}>
                {brl.format(Number(value))}
              </Typography>
            )}
          </Stack>

          {/* Pagamento */}
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                fontSize: fontSizes['2xs'],
                fontWeight: 800,
                px: 1,
                py: 0.35,
                borderRadius: '8px',
                color: paid ? 'success.dark' : 'warning.dark',
                bgcolor: (t) => alpha(paid ? t.palette.success.main : t.palette.warning.main, 0.16),
              }}
            >
              {paid ? 'Pago' : 'Não pago'}
            </Box>
            {paid && paymentName && (
              <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', fontWeight: 600 }}>
                via {paymentName}
              </Typography>
            )}
          </Stack>

          {(adminNotes || clinicalNotes) && (
            <Box sx={{ mt: 1.25, pt: 1.25, borderTop: 1, borderColor: 'divider' }}>
              {adminNotes && (
                <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', lineHeight: 1.5 }}>
                  <Box component="b" sx={{ color: 'text.disabled', fontSize: fontSizes['2xs'], letterSpacing: '0.3px' }}>
                    OBSERVAÇÃO:{' '}
                  </Box>
                  {adminNotes}
                </Typography>
              )}
              {clinicalNotes && (
                <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', lineHeight: 1.5, mt: adminNotes ? 0.75 : 0 }}>
                  <Box component="b" sx={{ color: 'text.disabled', fontSize: fontSizes['2xs'], letterSpacing: '0.3px' }}>
                    ANOTAÇÃO CLÍNICA:{' '}
                  </Box>
                  {clinicalNotes}
                </Typography>
              )}
            </Box>
          )}

          {!!appt.applicationMap?.points?.length && <ApplicationMapPreview map={appt.applicationMap} />}
        </Box>
      </Stack>
    </Paper>
  );
}
