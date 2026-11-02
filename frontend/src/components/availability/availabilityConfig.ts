import type { SxProps, Theme } from '@mui/material/styles';

import { formDialogPaperSx } from '../DialogCloseButton';
import { fontSizes } from '../../theme/fontSizes';
import type { WorkingHours } from '../../types';

export const DAYS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];

export const DAY_ABBR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export type DayScheduleEdit = {
  works: boolean;
  startTime: string;
  endTime: string;
};

export type Professional = { id: string; name: string };

export const DEFAULT_DAY: DayScheduleEdit = { works: false, startTime: '08:00', endTime: '18:00' };

export const UNAVAIL_REASON_SUGGESTIONS = [
  'Férias',
  'Folga',
  'Compromisso pessoal',
  'Consulta médica',
  'Capacitação',
] as const;

export const WEEK_PRESETS = [
  { label: 'Seg–Sex', days: [1, 2, 3, 4, 5] },
  { label: 'Seg–Sáb', days: [1, 2, 3, 4, 5, 6] },
  { label: 'Nenhum dia', days: [] },
];

export const PROFESSIONAL_COLORS = ['#15998B', '#5BA8DE', '#9B7BD4', '#E0915B', '#D46B8A', '#4FB3A8'];

export const UNAVAIL_DATETIME_FIELD_SX = {
  '& .MuiInputBase-input': {
    textAlign: 'left',
  },
  '& input[type="datetime-local"]::-webkit-datetime-edit': {
    textAlign: 'left',
  },
  '& input[type="datetime-local"]::-webkit-calendar-picker-indicator': {
    marginLeft: 0,
  },
} as const;

const DIALOG_MAX_WIDTH = 640;

export const CARD_HEADER_SX = {
  px: { xs: 2, sm: 2.75 },
  py: 2.25,
  minHeight: 73,
  display: 'flex',
  alignItems: 'center',
  borderBottom: 1,
  borderColor: 'divider',
} as const;

export const CARD_ROW_SX = {
  px: { xs: 2, sm: 2.75 },
  borderBottom: 1,
  borderColor: 'grey.100',
  '&:last-of-type': { borderBottom: 0 },
} as const;

export const SMALL_CHIP_SX = { height: 21, fontSize: fontSizes['2xs'], fontWeight: 700 } as const;

export const ROW_ACTION_SX = {
  width: 30,
  height: 30,
  flexShrink: 0,
  borderRadius: '9px',
  border: 1,
  borderColor: 'divider',
  color: 'text.secondary',
} as const;

export const EMPTY_HOURS: WorkingHours[] = [];

/** Paper dos diálogos de horário/bloqueio: tela cheia no mobile, 640px no desktop. */
export const availabilityDialogPaperSx = (isMobile: boolean): SxProps<Theme> =>
  formDialogPaperSx(isMobile, { maxWidth: DIALOG_MAX_WIDTH, height: 'min(86dvh, 620px)' });

/** Horário semanal: o paper cresce até caber os 7 dias; só então o miolo rola. */
export const workingHoursDialogPaperSx = (isMobile: boolean): SxProps<Theme> =>
  formDialogPaperSx(isMobile, { maxWidth: DIALOG_MAX_WIDTH, height: 'auto', maxHeight: '92dvh' });

export const AVAILABILITY_DIALOG_CONTENT_SX = {
  px: { xs: 2, sm: 3 },
  pb: { xs: 2, sm: 2.5 },
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  bgcolor: 'background.paper',
  // MUI zera o padding-top quando o content segue o DialogTitle; força o espaçamento
  '&.MuiDialogContent-root': { pt: { xs: 2.75, sm: 3 } },
} as const;
