import { Button, Stack } from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';

import type { PatientWithHistory } from '../../api/patients';
import { usePermissions } from '../../contexts/usePermissions';
import { PatientSkinRoutinesCard } from '../skincare/PatientSkinRoutinesCard';
import { AnamnesisView, hasAnamnesisData } from './AnamnesisView';
import { PatientMeasurementsCard } from './PatientMeasurementsCard';

/** Aba "Anamnese" da ficha completa e da gaveta: rotinas de skincare, medidas corporais, botão de edição e respostas. */
export function PatientAnamnesisSection({
  patient,
  onEdit,
  buttonSize,
}: {
  patient: PatientWithHistory;
  onEdit?: () => void;
  buttonSize?: 'small';
}) {
  const { has } = usePermissions();
  return (
    <Stack spacing={2}>
      {has('routines:view') && (
        <PatientSkinRoutinesCard
          patient={{ id: patient.id, name: patient.name, phone: patient.phone, email: patient.email }}
        />
      )}
      <PatientMeasurementsCard patient={patient} canEdit={has('patients:edit')} />
      {onEdit && (
        <Stack direction="row" justifyContent="flex-end">
          <Button variant="contained" size={buttonSize} startIcon={<EditOutlinedIcon />} onClick={onEdit}>
            {hasAnamnesisData(patient.anamnesis) ? 'Editar anamnese' : 'Preencher anamnese'}
          </Button>
        </Stack>
      )}
      <AnamnesisView anamnesis={patient.anamnesis} />
    </Stack>
  );
}
