import { useState } from 'react';
import { Box, Collapse, IconButton, Stack, Typography } from '@mui/material';

import { AuroraIcon } from '../AuroraIcon';
import type { Appointment } from '../../types';
import { fontSizes } from '../../theme/fontSizes';
import { clickableProps } from '../../utils/a11y';
import { kindLabel } from './agendaConfig';

interface PendingAppointmentsBannerProps {
  appointments: Appointment[];
  onOpen: (appointment: Appointment) => void;
}

/** Aviso recolhível com os agendamentos que têm pendência; some ao ser dispensado. */
export function PendingAppointmentsBanner({ appointments, onOpen }: PendingAppointmentsBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (appointments.length === 0 || dismissed) return null;

  return (
    <Box
      data-tour="agenda-pending"
      sx={{
        mb: 1.5,
        borderRadius: '13px',
        border: '1px solid',
        borderColor: 'rgba(194,90,76,.32)',
        bgcolor: 'rgba(194,90,76,.07)',
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.25}
        sx={{ px: 2, py: 1.35, cursor: 'pointer' }}
        {...clickableProps(() => setExpanded((v) => !v))}
        aria-expanded={expanded}
      >
        <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: '#C25A4C', flexShrink: 0 }} />
        <Typography sx={{ flex: 1, fontSize: fontSizes.md, fontWeight: 700 }}>
          {appointments.length} agendamento{appointments.length > 1 ? 's' : ''} com pendência
        </Typography>
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          aria-label={expanded ? 'Recolher' : 'Expandir'}
          sx={{
            color: 'text.secondary',
            transform: expanded ? 'rotate(180deg)' : 'none',
            transition: 'transform 150ms ease',
          }}
        >
          <AuroraIcon name="chevronDown" size={16} strokeWidth={2} />
        </IconButton>
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            setDismissed(true);
          }}
          aria-label="Dispensar"
          sx={{ color: 'text.secondary' }}
        >
          <AuroraIcon name="close" size={16} strokeWidth={2} />
        </IconButton>
      </Stack>
      <Collapse in={expanded}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, px: 2, pb: 1.75, pt: 0.25 }}>
          {appointments.map((a) => (
            <Box
              key={a.id}
              {...clickableProps(() => onOpen(a))}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.25,
                py: 0.85,
                borderRadius: '10px',
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'rgba(194,90,76,.25)',
                cursor: 'pointer',
                '&:hover': { borderColor: '#C25A4C' },
              }}
            >
              <Box
                component="span"
                sx={{
                  fontSize: fontSizes.xs,
                  fontWeight: 800,
                  color: '#C25A4C',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                {new Date(a.startAt).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}{' '}
                {new Date(a.startAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </Box>
              <Box component="span" sx={{ fontSize: fontSizes.xs, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {a.patient?.name ?? 'Paciente'}
              </Box>
              <Box component="span" sx={{ fontSize: fontSizes.xs, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                · {a.procedure?.name ?? kindLabel[a.kind] ?? a.kind}
              </Box>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}
