import { useState } from 'react';
import { Button, Stack } from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

import type { PatientWithHistory } from '../../api/patients';
import { usePermissions } from '../../contexts/usePermissions';
import { PatientSkinRoutinesCard } from '../skincare/PatientSkinRoutinesCard';
import { AnamnesisView, hasAnamnesisData } from './AnamnesisView';
import { PatientMeasurementsCard } from './PatientMeasurementsCard';
import { SendAnamnesisLinkDialog } from './SendAnamnesisLinkDialog';

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
  const [sendOpen, setSendOpen] = useState(false);
  const canSend = has('patients:edit');
  return (
    <Stack spacing={2}>
      {has('routines:view') && (
        <PatientSkinRoutinesCard
          patient={{ id: patient.id, name: patient.name, phone: patient.phone, email: patient.email }}
        />
      )}
      <PatientMeasurementsCard patient={patient} canEdit={has('patients:edit')} />
      {(onEdit || canSend) && (
        <Stack direction="row" justifyContent="flex-end" flexWrap="wrap" gap={1}>
          {canSend && (
            <Button variant="outlined" size={buttonSize} startIcon={<WhatsAppIcon />} onClick={() => setSendOpen(true)}>
              Enviar para a paciente preencher
            </Button>
          )}
          {onEdit && (
            <Button variant="contained" size={buttonSize} startIcon={<EditOutlinedIcon />} onClick={onEdit}>
              {hasAnamnesisData(patient.anamnesis) ? 'Editar anamnese' : 'Preencher anamnese'}
            </Button>
          )}
        </Stack>
      )}
      <AnamnesisView anamnesis={patient.anamnesis} />
      {canSend && (
        <SendAnamnesisLinkDialog
          open={sendOpen}
          onClose={() => setSendOpen(false)}
          patient={{ id: patient.id, name: patient.name, phone: patient.phone }}
        />
      )}
    </Stack>
  );
}
