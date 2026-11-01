import { Box, Button, CircularProgress, Drawer, IconButton, Stack, alpha, useTheme } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import AddIcon from '@mui/icons-material/Add';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { PatientPhotosGallery } from './PatientPhotosGallery';
import { PatientAnamnesisSection } from './PatientAnamnesisSection';
import { PatientDocumentsTab } from './PatientDocumentsTab';
import { PatientFinanceTab } from './PatientFinanceTab';
import { PatientDrawerAppointmentsTab } from './PatientDrawerAppointmentsTab';
import { PatientDrawerHeader, type PatientDrawerTab } from './PatientDrawerHeader';
import { PatientDrawerSummaryTab } from './PatientDrawerSummaryTab';
import { PatientWhatsAppButton } from './PatientWhatsAppButton';
import { usePatientChart } from './usePatientChart';
import { usePatientRecordAccess } from './usePatientRecordAccess';
import { usePermissions } from '../../contexts/usePermissions';
import { useAppointmentDialog } from '../../contexts/AppointmentDialogContext';

interface PatientDetailDrawerProps {
  patientId: string | null;
  onClose: () => void;
  defaultTab?: PatientDrawerTab;
  highlightAppointmentId?: string | null;
  onEditAnamnesis?: (patientId: string) => void;
}

export function PatientDetailDrawer({
  patientId,
  onClose,
  defaultTab = 'general',
  onEditAnamnesis,
}: PatientDetailDrawerProps) {
  const [tab, setTab] = useState<PatientDrawerTab>(defaultTab);
  const navigate = useNavigate();
  const theme = useTheme();
  const { has } = usePermissions();
  const canEdit = has('patients:edit');
  const { showDocuments, showFinance } = usePatientRecordAccess();
  const { openAppointmentDialog } = useAppointmentDialog();

  const { data, isLoading, reliability } = usePatientChart(patientId);

  useEffect(() => {
    if (patientId) setTab(defaultTab);
  }, [patientId, defaultTab]);

  const handleClose = () => {
    setTab(defaultTab);
    onClose();
  };

  return (
    <Drawer
      anchor="right"
      open={!!patientId}
      onClose={handleClose}
      sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}
      ModalProps={{
        sx: { zIndex: (theme) => theme.zIndex.modal + 1 },
      }}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 840 },
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper',
        },
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          borderBottom: 1,
          borderColor: 'divider',
          position: 'relative',
          px: 3,
          pt: 3,
          pb: 2.5,
          background: (theme) =>
            `linear-gradient(150deg, ${alpha(theme.palette.primary.main, 0.12)}, transparent 70%)`,
        }}
      >
        <IconButton
          onClick={handleClose}
          aria-label="Fechar ficha"
          size="small"
          sx={{ position: 'absolute', top: 18, right: 18, width: 36, height: 36, borderRadius: '10px', border: 1, borderColor: 'divider', bgcolor: 'background.paper', color: 'text.secondary' }}
        >
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>

        {isLoading && !data && (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress size={28} />
          </Box>
        )}

        {data && (
          <PatientDrawerHeader patient={data} reliability={reliability} tab={tab} onTabChange={setTab} />
        )}
      </Box>

      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: { xs: 2, sm: 3 },
          py: 2.5,
          bgcolor: 'background.paper',
        }}
      >
        {isLoading && (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        )}

        {data && tab === 'general' && <PatientDrawerSummaryTab patient={data} />}

        {data && tab === 'anamnesis' && (
          <PatientAnamnesisSection
            patient={data}
            onEdit={onEditAnamnesis ? () => onEditAnamnesis(data.id) : undefined}
            buttonSize="small"
          />
        )}

        {data && tab === 'appointments' && <PatientDrawerAppointmentsTab appointments={data.appointments} />}

        {data && tab === 'fotos' && (
          <PatientPhotosGallery
            patientId={data.id}
            canEdit={canEdit}
            readOnly
            showTitle={false}
            onAddClick={() => {
              handleClose();
              navigate(`/pacientes/${data.id}?tab=fotos`);
            }}
          />
        )}

        {data && tab === 'documents' && showDocuments && (
          <PatientDocumentsTab
            patientId={data.id}
            patientName={data.name}
            onLeave={handleClose}
            viewerZIndex={theme.zIndex.modal + 2}
          />
        )}

        {data && tab === 'finance' && showFinance && <PatientFinanceTab patientId={data.id} />}
      </Box>

      {data && (
        <Stack
          direction="row"
          spacing={1.25}
          sx={{
            flexShrink: 0,
            px: 3,
            py: 2,
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'grey.50',
          }}
        >
          <Button
            variant="outlined"
            startIcon={<OpenInFullIcon sx={{ fontSize: 17 }} />}
            onClick={() => {
              handleClose();
              navigate(`/pacientes/${patientId}`);
            }}
            sx={{
              flex: 1,
              height: 38,
              borderRadius: '12px',
              bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
              borderColor: 'primary.main',
              color: 'primary.main',
              fontWeight: 700,
              '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.16), borderColor: 'primary.main' },
            }}
          >
            Ficha completa
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon sx={{ fontSize: 18 }} />}
            onClick={() => {
              handleClose();
              openAppointmentDialog({ patientId: patientId ?? undefined });
            }}
            sx={{ height: 38, px: 2.25, borderRadius: '12px', fontWeight: 700, boxShadow: (t) => `0 6px 16px -6px ${t.palette.primary.main}` }}
          >
            Agendar
          </Button>
          {data.phone && (
            <PatientWhatsAppButton phone={data.phone} name={data.name} sx={{ borderRadius: '12px', bgcolor: 'background.paper' }} />
          )}
        </Stack>
      )}
    </Drawer>
  );
}
