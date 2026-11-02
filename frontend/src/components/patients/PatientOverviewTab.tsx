import { Box, Paper, Stack, Typography, alpha } from '@mui/material';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import dayjs from 'dayjs';
import type { ReactNode } from 'react';

import type { PatientWithHistory } from '../../api/patients';
import type { Appointment } from '../../types';
import { fontSizes } from '../../theme/fontSizes';
import { useAnamnesisQuestions } from '../../hooks/useAnamnesisQuestions';

function HeaderIcon({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        borderRadius: 1.5,
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
        color: 'primary.main',
        flexShrink: 0,
      }}
    >
      {children}
    </Box>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2.5, borderColor: 'divider', bgcolor: 'background.paper', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.5 }}>
        <HeaderIcon>{icon}</HeaderIcon>
        <Typography variant="subtitle2" fontWeight={700} letterSpacing="-0.01em">
          {title}
        </Typography>
      </Stack>
      {children}
    </Paper>
  );
}

function HighlightCard({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub?: string | null }) {
  return (
    <Box sx={{ p: 2, borderRadius: '14px', border: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '9px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
            color: 'primary.main',
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', fontWeight: 600 }}>{label}</Typography>
      </Stack>
      <Typography sx={{ fontSize: fontSizes.xl, fontWeight: 800, mt: 1 }}>{value}</Typography>
      {sub && (
        <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }} noWrap>
          {sub}
        </Typography>
      )}
    </Box>
  );
}

export function PatientOverviewTab({
  patient: data,
  activePackagesCount,
}: {
  patient: PatientWithHistory;
  activePackagesCount: number;
}) {
  const appts: Appointment[] = data.appointments ?? [];
  const now = dayjs();
  const upcoming = [...appts]
    .filter((a) => dayjs(a.startAt).isAfter(now) && a.status !== 'CANCELLED' && a.status !== 'NO_SHOW')
    .sort((a, b) => dayjs(a.startAt).valueOf() - dayjs(b.startAt).valueOf())[0];
  const last = [...appts]
    .filter((a) => a.status === 'COMPLETED')
    .sort((a, b) => dayjs(b.startAt).valueOf() - dayjs(a.startAt).valueOf())[0];

  const anamnesis: Record<string, any> = data.anamnesis ?? {};
  const { data: questions = [] } = useAnamnesisQuestions('GENERAL');
  const boolFields = questions.filter((q) => q.active && q.type === 'BOOLEAN');
  const activeConditions = boolFields.filter((f) => !!anamnesis[f.key]);
  const allergyEntries = [
    { label: 'Alergia a medicamentos', v: anamnesis.alergiasMedicamentos },
    { label: 'Outras alergias', v: anamnesis.alergiasOutras },
    { label: 'Alergia a cosméticos', v: anamnesis.alergiaCosmeticos },
  ].filter((x) => x.v && String(x.v).trim());
  const hasAlerts = activeConditions.length > 0 || allergyEntries.length > 0;

  return (
    <Stack spacing={2.5}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
        <HighlightCard
          icon={<EventNoteOutlinedIcon sx={{ fontSize: 18 }} />}
          label="Próximo agendamento"
          value={upcoming ? dayjs(upcoming.startAt).format('DD/MM/YYYY [às] HH:mm') : '—'}
          sub={upcoming?.procedure?.name}
        />
        <HighlightCard
          icon={<AssignmentOutlinedIcon sx={{ fontSize: 18 }} />}
          label="Último atendimento"
          value={last ? dayjs(last.startAt).format('DD/MM/YYYY') : '—'}
          sub={last?.procedure?.name}
        />
        <HighlightCard
          icon={<ViewInArIcon sx={{ fontSize: 18 }} />}
          label="Pacotes ativos"
          value={String(activePackagesCount)}
        />
      </Box>

      {hasAlerts && (
        <SectionCard title="Alertas clínicos" icon={<AssignmentOutlinedIcon sx={{ fontSize: 18 }} />}>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {activeConditions.map((c) => (
              <Box
                key={c.key}
                component="span"
                sx={{
                  fontSize: fontSizes.xs,
                  fontWeight: 700,
                  px: 1.25,
                  py: 0.5,
                  borderRadius: '8px',
                  color: 'warning.dark',
                  bgcolor: (t) => alpha(t.palette.warning.main, 0.16),
                }}
              >
                {c.label}
              </Box>
            ))}
            {allergyEntries.map((a) => (
              <Box
                key={a.label}
                component="span"
                sx={{
                  fontSize: fontSizes.xs,
                  fontWeight: 700,
                  px: 1.25,
                  py: 0.5,
                  borderRadius: '8px',
                  color: 'error.dark',
                  bgcolor: (t) => alpha(t.palette.error.main, 0.14),
                }}
              >
                {a.label}: {String(a.v)}
              </Box>
            ))}
          </Stack>
        </SectionCard>
      )}

      {data.notes?.trim() && (
        <SectionCard title="Observações do cadastro" icon={<DescriptionOutlinedIcon sx={{ fontSize: 18 }} />}>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {data.notes.trim()}
          </Typography>
        </SectionCard>
      )}

      {!hasAlerts && !data.notes?.trim() && !upcoming && !last && (
        <Typography variant="body2" color="text.secondary">
          Sem informações adicionais para exibir.
        </Typography>
      )}
    </Stack>
  );
}
