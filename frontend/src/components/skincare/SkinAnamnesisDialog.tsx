import { Box, Dialog, GlobalStyles, Typography, useMediaQuery, useTheme } from '@mui/material';

import { DialogCloseButton } from '../DialogCloseButton';
import { fontSizes } from '../../theme/fontSizes';
import type { SkincareRoutine } from '../../types';
import { SkinAnamnesisWizard, type SkinPatient } from './SkinAnamnesisWizard';

interface SkinAnamnesisDialogProps {
  open: boolean;
  onClose: () => void;
  patient: SkinPatient | null;
  /** Abre uma rotina já salva em vez de iniciar uma nova anamnese. */
  routine?: SkincareRoutine | null;
}

/** Na impressão (Imprimir / PDF) sai só a rotina: o app e os botões ficam de fora. */
const PRINT_STYLES = {
  '@media print': {
    'body > #root, .MuiBackdrop-root, [data-noprint]': { display: 'none !important' },
    'body': { background: '#fff !important' },
    '.skin-dialog, .skin-dialog .MuiDialog-container, .skin-dialog .MuiDialog-paper, .skin-dialog [data-print-scroll]': {
      position: 'static !important',
      display: 'block !important',
      overflow: 'visible !important',
      height: 'auto !important',
      maxHeight: 'none !important',
      maxWidth: 'none !important',
      margin: '0 !important',
      boxShadow: 'none !important',
      background: '#fff !important',
    },
    '[data-print-flat]': { boxShadow: 'none !important' },
  },
} as const;

export function SkinAnamnesisDialog({ open, onClose, patient, routine }: SkinAnamnesisDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog
      open={open && !!patient}
      onClose={onClose}
      className="skin-dialog"
      // Acima da gaveta da paciente (PatientDetailDrawer usa zIndex.modal + 1).
      sx={{ zIndex: (t) => t.zIndex.modal + 2 }}
      maxWidth={false}
      fullWidth
      // Menor que a modal de baixo (agendamento: 1120px / 94dvh) para ler como camada sobreposta.
      PaperProps={{
        sx: {
          width: isMobile ? 'calc(100% - 24px)' : 'calc(100% - 40px)',
          maxWidth: isMobile ? 'none' : 1008,
          height: isMobile ? 'calc(100dvh - 48px)' : 'min(85dvh, 756px)',
          maxHeight: isMobile ? 'calc(100dvh - 48px)' : '85dvh',
          m: isMobile ? 1.5 : 2.5,
          bgcolor: 'background.default',
          borderRadius: isMobile ? '16px' : '20px',
          boxShadow: '0 24px 80px -12px rgba(0,0,0,.55), 0 0 0 1px rgba(0,0,0,.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
      }}
      slotProps={{ backdrop: { sx: { bgcolor: 'rgba(7,18,17,.6)', backdropFilter: 'blur(3px)' } } }}
    >
      {open && <GlobalStyles styles={PRINT_STYLES} />}
      <Box
        data-noprint="1"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          px: { xs: 2, sm: 2.75 },
          py: 2,
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Box sx={{ lineHeight: 1.3, minWidth: 0 }}>
          <Typography component="h2" sx={{ fontSize: fontSizes.xl, fontWeight: 800 }}>
            Anamnese de pele
          </Typography>
          <Typography noWrap sx={{ fontSize: fontSizes.xs, color: 'text.secondary', fontWeight: 600 }}>
            {patient?.name}
          </Typography>
        </Box>
        <DialogCloseButton onClose={onClose} sx={{ width: 38, height: 38, borderRadius: '11px' }} />
      </Box>
      <Box data-print-scroll="1" sx={{ flex: 1, overflowY: 'auto' }}>
        {patient && <SkinAnamnesisWizard key={routine?.id ?? 'new'} patient={patient} routine={routine} />}
      </Box>
    </Dialog>
  );
}
