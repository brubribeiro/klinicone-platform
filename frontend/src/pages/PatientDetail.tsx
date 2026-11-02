import { useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Button, CircularProgress, Paper, Tab, Tabs, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import { useQuery } from '@tanstack/react-query';

import { packagesApi } from '../api/packages';
import { AnamnesisFormDialog } from '../components/patients/AnamnesisFormDialog';
import { PatientAnamnesisSection } from '../components/patients/PatientAnamnesisSection';
import { PatientAppointmentsTab } from '../components/patients/PatientAppointmentsTab';
import { PatientDocumentsTab } from '../components/patients/PatientDocumentsTab';
import { PatientFinanceTab } from '../components/patients/PatientFinanceTab';
import { PatientOverviewTab } from '../components/patients/PatientOverviewTab';
import { PatientPackagesTab } from '../components/patients/PatientPackagesTab';
import { PatientPhotosGallery } from '../components/patients/PatientPhotosGallery';
import { PatientSummarySidebar } from '../components/patients/PatientSummarySidebar';
import { usePatientChart } from '../components/patients/usePatientChart';
import { usePatientRecordAccess } from '../components/patients/usePatientRecordAccess';
import { useAppointmentDialog } from '../contexts/AppointmentDialogContext';
import { usePermissions } from '../contexts/usePermissions';
import { fontSizes } from '../theme/fontSizes';

type DetailTab = 'general' | 'appointments' | 'packages' | 'anamnesis' | 'fotos' | 'documents' | 'finance';

export function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { has } = usePermissions();
  const canEdit = has('patients:edit');
  const { showDocuments, showFinance } = usePatientRecordAccess();
  const { openAppointmentDialog } = useAppointmentDialog();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<DetailTab>((searchParams.get('tab') as DetailTab) || 'general');
  const [anamnesisOpen, setAnamnesisOpen] = useState(false);

  const { data, isLoading, reliability } = usePatientChart(id);

  const { data: patientPackages = [] } = useQuery({
    queryKey: ['patient-packages', id],
    queryFn: () => packagesApi.listPatientPackages(id!),
    enabled: !!id,
  });

  // ?tab=documents/finance sem módulo ou permissão cai na visão geral
  const activeTab: DetailTab =
    (tab === 'documents' && !showDocuments) || (tab === 'finance' && !showFinance) ? 'general' : tab;

  const activePackagesCount = useMemo(
    () => patientPackages.filter((p) => p.status === 'ACTIVE').length,
    [patientPackages],
  );

  if (isLoading && !data) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" sx={{ minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{ p: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/pacientes')}>
          Voltar para pacientes
        </Button>
        <Typography sx={{ mt: 2 }}>Paciente não encontrado.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Button
        variant="outlined"
        startIcon={<ChevronLeftIcon />}
        onClick={() => navigate(`/pacientes?ficha=${id}`)}
        sx={{
          mb: 2.5,
          height: 38,
          borderRadius: '11px',
          bgcolor: 'background.paper',
          borderColor: 'divider',
          color: 'text.secondary',
          fontWeight: 700,
          '&:hover': { bgcolor: 'grey.50', borderColor: 'divider' },
        }}
      >
        Voltar para pacientes
      </Button>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '320px 1fr' },
          gap: { xs: 2, md: 3 },
          alignItems: 'start',
        }}
      >
        <PatientSummarySidebar
          patient={data}
          reliability={reliability}
          onSchedule={() => openAppointmentDialog({ patientId: id })}
        />

        {/* Conteúdo */}
        <Box sx={{ minWidth: 0 }}>
          <Paper variant="outlined" sx={{ borderColor: 'divider', borderRadius: '16px', overflow: 'hidden' }}>
            <Tabs
              value={activeTab}
              onChange={(_, value: DetailTab) => setTab(value)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                px: { xs: 1, sm: 2 },
                minHeight: 48,
                borderBottom: 1,
                borderColor: 'divider',
                '& .MuiTab-root': { minHeight: 48, minWidth: 0, px: 1.5, textTransform: 'none', fontWeight: 600, fontSize: fontSizes.md },
                // 7 abas com ícone só cabem na coluna a partir de ~1700px; abaixo disso, só o texto (sem rolagem em 1440px)
                '@media (max-width: 1699.95px)': { '& .MuiTab-iconWrapper': { display: 'none' } },
              }}
            >
              <Tab value="general" label="Visão geral" icon={<PersonOutlineIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
              <Tab value="appointments" label="Agendamentos" icon={<EventNoteOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
              <Tab value="packages" label="Pacotes" icon={<ViewInArIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
              <Tab value="anamnesis" label="Anamnese" icon={<AssignmentOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
              <Tab value="fotos" label="Fotos" icon={<PhotoLibraryOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
              {showDocuments && (
                <Tab value="documents" label="Documentos" icon={<DescriptionOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
              )}
              {showFinance && (
                <Tab value="finance" label="Financeiro" icon={<PaidOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
              )}
            </Tabs>

            <Box sx={{ minHeight: 300, p: { xs: 2, sm: 2.75 } }}>
            {activeTab === 'general' && <PatientOverviewTab patient={data} activePackagesCount={activePackagesCount} />}
            {activeTab === 'appointments' && <PatientAppointmentsTab appointments={data.appointments ?? []} />}
            {activeTab === 'packages' && <PatientPackagesTab patientPackages={patientPackages} />}
            {activeTab === 'anamnesis' && (
              <PatientAnamnesisSection patient={data} onEdit={canEdit ? () => setAnamnesisOpen(true) : undefined} />
            )}
            {activeTab === 'fotos' && (
              <PatientPhotosGallery patientId={id!} canEdit={canEdit} showTitle={false} />
            )}
            {activeTab === 'documents' && <PatientDocumentsTab patientId={id!} patientName={data.name} />}
            {activeTab === 'finance' && <PatientFinanceTab patientId={id!} />}
            </Box>
          </Paper>
        </Box>
      </Box>

      <AnamnesisFormDialog
        open={anamnesisOpen}
        patientId={id ?? null}
        onClose={() => setAnamnesisOpen(false)}
      />
    </Box>
  );
}
