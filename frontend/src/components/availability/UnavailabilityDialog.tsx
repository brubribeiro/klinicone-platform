import type { ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
  type SxProps,
  type Theme,
} from '@mui/material';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';

import { DialogHeader, dialogActionsBorderSx } from '../DialogCloseButton';
import { LabeledField } from '../LabeledField';
import { fontSizes } from '../../theme/fontSizes';
import { AvailabilityShortcutToggles, availabilityShortcutToggleSx } from './AvailabilityShortcutToggles';
import {
  AVAILABILITY_DIALOG_CONTENT_SX,
  UNAVAIL_DATETIME_FIELD_SX,
  UNAVAIL_REASON_SUGGESTIONS,
  availabilityDialogPaperSx,
  type Professional,
} from './availabilityConfig';
import { apiMessageOf } from './availabilityUtils';
import { useUnavailabilityForm } from './useUnavailabilityForm';

const FIELD_STACK_GAP = 1.25;

const PERIOD_MODE_TOGGLE_SX: SxProps<Theme> = [
  availabilityShortcutToggleSx,
  {
    width: '100%',
    '& .MuiToggleButtonGroup-grouped': { flex: 1, py: 0.85 },
  },
];

export function UnavailabilityDialog({
  open,
  onClose,
  professionals,
  defaultUserId,
  canChooseProfessional,
}: {
  open: boolean;
  onClose: () => void;
  professionals: Professional[];
  defaultUserId: string;
  canChooseProfessional: boolean;
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const {
    allDay,
    startAt,
    endAt,
    startDate,
    endDate,
    reason,
    userId,
    setReason,
    setUserId,
    setEndAt,
    setEndDate,
    changeStartAt,
    changeStartDate,
    switchMode,
    presets,
    dateRangeInvalid,
    datetimeRangeInvalid,
    formInvalid,
    periodError,
    periodPreview,
    mutation,
    handleSubmit,
  } = useUnavailabilityForm(open, defaultUserId, onClose);
  const professionalName = professionals.find((p) => p.id === userId)?.name;
  const reasonShortcutValue = (UNAVAIL_REASON_SUGGESTIONS as readonly string[]).includes(reason) ? reason : '';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      fullScreen={isMobile}
      PaperProps={{ sx: availabilityDialogPaperSx(isMobile) }}
    >
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
      >
        <DialogHeader
          onClose={onClose}
          isMobile={isMobile}
          title="Novo bloqueio"
          subtitle={
            professionalName
              ? `Bloqueio na agenda de ${professionalName}`
              : 'Bloqueie horários na agenda'
          }
          icon={<EventBusyOutlinedIcon fontSize="small" />}
        />
        <DialogContent sx={AVAILABILITY_DIALOG_CONTENT_SX}>
          <Stack spacing={1.75}>
            {canChooseProfessional && professionals.length > 1 && (
              <LabeledField label="Profissional">
                <TextField
                  select
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  inputProps={{ 'aria-label': 'Profissional' }}
                  fullWidth
                >
                  {professionals.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </TextField>
              </LabeledField>
            )}

            <LabeledField label="Motivo">
              <Stack spacing={FIELD_STACK_GAP}>
                <TextField
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex.: Congresso, férias, almoço estendido..."
                  inputProps={{ 'aria-label': 'Motivo' }}
                  fullWidth
                />
                <AvailabilityShortcutToggles
                  options={UNAVAIL_REASON_SUGGESTIONS.map((s) => ({ label: s, value: s }))}
                  value={reasonShortcutValue}
                  onChange={setReason}
                />
              </Stack>
            </LabeledField>

            <LabeledField label="Período">
              <Stack spacing={FIELD_STACK_GAP}>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  size="small"
                  value={allDay ? 'allDay' : 'partial'}
                  onChange={(_, val) => {
                    if (val === 'allDay') switchMode(true);
                    if (val === 'partial') switchMode(false);
                  }}
                  sx={PERIOD_MODE_TOGGLE_SX}
                >
                  <ToggleButton value="partial">Horário específico</ToggleButton>
                  <ToggleButton value="allDay">Dia(s) inteiro(s)</ToggleButton>
                </ToggleButtonGroup>
                <AvailabilityShortcutToggles
                  options={presets.map((p) => ({ label: p.label, value: p.label }))}
                  value=""
                  onChange={(val) => presets.find((p) => p.label === val)?.onClick()}
                />
              </Stack>
            </LabeledField>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.75 }}>
              {allDay ? (
                <>
                  <LabeledField label="Início">
                    <TextField
                      type="date"
                      value={startDate}
                      onChange={(e) => changeStartDate(e.target.value)}
                      inputProps={{ 'aria-label': 'Início' }}
                      fullWidth
                      error={dateRangeInvalid}
                    />
                  </LabeledField>
                  <LabeledField label="Fim">
                    <TextField
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      inputProps={{ 'aria-label': 'Fim' }}
                      fullWidth
                      error={dateRangeInvalid}
                    />
                  </LabeledField>
                </>
              ) : (
                <>
                  <LabeledField label="Início">
                    <TextField
                      type="datetime-local"
                      value={startAt}
                      onChange={(e) => changeStartAt(e.target.value)}
                      inputProps={{ 'aria-label': 'Início' }}
                      fullWidth
                      error={datetimeRangeInvalid}
                      sx={UNAVAIL_DATETIME_FIELD_SX}
                    />
                  </LabeledField>
                  <LabeledField label="Fim">
                    <TextField
                      type="datetime-local"
                      value={endAt}
                      onChange={(e) => setEndAt(e.target.value)}
                      inputProps={{ 'aria-label': 'Fim' }}
                      fullWidth
                      error={datetimeRangeInvalid}
                      sx={UNAVAIL_DATETIME_FIELD_SX}
                    />
                  </LabeledField>
                </>
              )}
            </Box>

            {periodError ? (
              <PeriodNotice tone="error" visible>
                {periodError}
              </PeriodNotice>
            ) : (
              <PeriodNotice tone="primary" visible={!!periodPreview}>
                Será bloqueado:{' '}
                <Box component="strong" sx={{ color: 'text.primary' }}>
                  {periodPreview ?? '—'}
                </Box>
              </PeriodNotice>
            )}

            {mutation.isError && (
              <Alert severity="error" variant="outlined">
                {apiMessageOf(mutation.error, 'Erro ao salvar')}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ ...dialogActionsBorderSx, flexShrink: 0 }}>
          <Button onClick={onClose} type="button" disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button variant="contained" type="submit" disabled={mutation.isPending || formInvalid}>
            {mutation.isPending ? 'Salvando…' : 'Criar bloqueio'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function PeriodNotice({ tone, visible, children }: { tone: 'primary' | 'error'; visible: boolean; children: ReactNode }) {
  const Icon = tone === 'error' ? ReportProblemOutlinedIcon : EventAvailableOutlinedIcon;
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.375}
      sx={{
        px: 1.875,
        py: 1.25,
        borderRadius: '12px',
        border: 1,
        bgcolor: (t) => alpha(t.palette[tone].main, 0.08),
        borderColor: (t) => alpha(t.palette[tone].main, 0.2),
        visibility: visible ? 'visible' : 'hidden',
      }}
    >
      <Icon sx={{ fontSize: 18, color: `${tone}.main`, flexShrink: 0 }} />
      <Typography sx={{ fontSize: fontSizes.sm, color: 'text.secondary', fontWeight: 500, lineHeight: 1.4 }}>
        {children}
      </Typography>
    </Stack>
  );
}
