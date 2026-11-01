import { Avatar, Box, Stack, Typography } from '@mui/material';

import type { PatientReliability, PatientWithHistory } from '../../api/patients';
import { fontSizes } from '../../theme/fontSizes';
import { maskPhone } from '../../utils/masks';
import { patientInitials } from '../../utils/patientPhoto';
import { ReliabilityBadge } from './ReliabilityBadge';
import { usePatientRecordAccess } from './usePatientRecordAccess';

export type PatientDrawerTab =
  | 'notes'
  | 'general'
  | 'appointments'
  | 'packages'
  | 'anamnesis'
  | 'fotos'
  | 'documents'
  | 'finance';

/** Identificação da paciente e abas em pílulas no topo da gaveta. */
export function PatientDrawerHeader({
  patient: data,
  reliability,
  tab,
  onTabChange: setTab,
}: {
  patient: PatientWithHistory;
  reliability?: PatientReliability;
  tab: PatientDrawerTab;
  onTabChange: (tab: PatientDrawerTab) => void;
}) {
  const { showDocuments, showFinance } = usePatientRecordAccess();

  return (
    <>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ pr: 6 }}>
        <Avatar
          src={data.photoUrl ?? undefined}
          alt={data.name}
          variant="rounded"
          sx={{
            width: 64,
            height: 64,
            borderRadius: '18px',
            fontSize: fontSizes['4xl'],
            fontWeight: 800,
            bgcolor: 'primary.main',
            color: '#fff',
            boxShadow: '0 8px 20px -6px rgba(16,40,37,.35)',
            flexShrink: 0,
          }}
        >
          {patientInitials(data.name)}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: fontSizes['2xs'],
              fontWeight: 700,
              color: 'primary.main',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Ficha do paciente
          </Typography>
          <Typography sx={{ fontSize: fontSizes['3xl'], fontWeight: 800, letterSpacing: '-0.02em' }} noWrap>
            {data.name}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
            {data.phone && (
              <Typography variant="body2" color="text.secondary" noWrap>
                {maskPhone(data.phone) || data.phone}
              </Typography>
            )}
            {reliability != null && (
              <ReliabilityBadge value={reliability.reliabilityPercent} variant="drawer" />
            )}
          </Stack>
        </Box>
      </Stack>

      {/* Abas em pílulas segmentadas */}
      <Box
        sx={{
          display: 'flex',
          gap: 0.75,
          mt: 2.25,
          p: 0.5,
          borderRadius: '12px',
          bgcolor: 'grey.100',
        }}
      >
        {(
          [
            { id: 'general', label: 'Resumo' },
            { id: 'anamnesis', label: 'Anamnese' },
            { id: 'appointments', label: 'Atendimentos' },
            { id: 'fotos', label: 'Fotos' },
            ...(showDocuments ? [{ id: 'documents', label: 'Documentos' }] : []),
            ...(showFinance ? [{ id: 'finance', label: 'Financeiro' }] : []),
          ] as { id: PatientDrawerTab; label: string }[]
        ).map((t) => {
          const active = tab === t.id;
          return (
            <Box
              key={t.id}
              component="button"
              type="button"
              onClick={() => setTab(t.id)}
              sx={{
                flex: 1,
                minWidth: 0,
                height: 38,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 0,
                cursor: 'pointer',
                px: 1,
                borderRadius: '9px',
                fontFamily: 'inherit',
                fontSize: fontSizes.xs,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                color: active ? 'primary.main' : 'text.secondary',
                bgcolor: active ? 'background.paper' : 'transparent',
                boxShadow: active ? '0 1px 3px rgba(16,40,37,0.12)' : 'none',
                transition: 'all 0.12s',
              }}
            >
              {t.label}
            </Box>
          );
        })}
      </Box>
    </>
  );
}
