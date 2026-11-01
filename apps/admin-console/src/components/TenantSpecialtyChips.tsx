import { Box, alpha } from '@mui/material';

import { CLINIC_SPECIALTY_LABELS, type ClinicSpecialty } from '../../../../frontend/src/features/clinicSpecialties';
import { fontSizes } from '../../../../frontend/src/theme/fontSizes';

/** Chips somente leitura para especialidades da clínica. */
export function TenantSpecialtyChips({ specialties }: { specialties: string[] }) {
  if (!specialties.length) return null;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.65 }}>
      {specialties.map((key) => {
        const label = key in CLINIC_SPECIALTY_LABELS ? CLINIC_SPECIALTY_LABELS[key as ClinicSpecialty] : key;
        return (
          <Box
            key={key}
            component="span"
            sx={(t) => ({
              display: 'inline-block',
              fontSize: fontSizes.xs,
              fontWeight: 700,
              px: 1,
              py: 0.35,
              borderRadius: '8px',
              border: '1px solid',
              borderColor: alpha(t.palette.primary.main, 0.35),
              bgcolor: alpha(t.palette.primary.main, 0.1),
              color: 'primary.dark',
            })}
          >
            {label}
          </Box>
        );
      })}
    </Box>
  );
}
