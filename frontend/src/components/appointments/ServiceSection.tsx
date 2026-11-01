import { Controller, type Control } from 'react-hook-form';
import {
  Autocomplete,
  Box,
  Chip,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';

import { fontSizes } from '../../theme/fontSizes';
import type { AppointmentKind, Procedure } from '../../types';
import { brl, kindOptions, type FormValues } from './appointmentFormModel';
import { AppointmentFormSection, LabeledField } from './AppointmentFormSection';
import type { SectionControl } from './PatientSection';
import type { AppointmentProfessionals } from './useAppointmentProfessionals';

export function ServiceSection({
  section,
  control,
  selectedKind,
  procedureOptions,
  selectedProcedures,
  totalDurationMinutes,
  professionals,
}: {
  section: SectionControl;
  control: Control<FormValues>;
  selectedKind: AppointmentKind;
  procedureOptions: Procedure[];
  selectedProcedures: Procedure[];
  totalDurationMinutes: number;
  professionals: AppointmentProfessionals;
}) {
  const {
    restrictToOwnAppointments,
    user,
    slotValid,
    checkingAvailability,
    verifyingAvailability,
    professionalOptions,
    assignedProfessional,
    selectedProfessional,
    selectedPerformsAppointments,
    loggedUserCannotBeScheduled,
    noProfessionalAvailable,
    professionalSlotConflict,
    markManualSelection,
  } = professionals;

  const kindLabel = kindOptions.find((o) => o.value === selectedKind)?.label;
  const professionalName = restrictToOwnAppointments
    ? (assignedProfessional?.name ?? user?.name)
    : selectedProfessional?.name;
  const procedureSummary =
    selectedKind === 'PROCEDURE'
      ? selectedProcedures.length > 0
        ? selectedProcedures.map((p) => p.name).join(' + ')
        : 'Procedimento não selecionado'
      : kindLabel;
  const summary = [procedureSummary, professionalName ?? 'Sem profissional'].join(' · ');

  const totalPrice = selectedProcedures.reduce((sum, p) => sum + Number(p.price ?? 0), 0);
  const maxRecurrenceDays = selectedProcedures.reduce<number | null>((max, p) => {
    if (p.recurrenceDays == null) return max;
    return max == null ? p.recurrenceDays : Math.max(max, p.recurrenceDays);
  }, null);

  return (
    <AppointmentFormSection {...section} title="Procedimento e profissional" summary={summary}>
      <Stack spacing={2}>
        <Controller
          name="kind"
          control={control}
          render={({ field }) => (
            <ToggleButtonGroup
              exclusive
              fullWidth
              value={field.value}
              onChange={(_, val) => val && field.onChange(val)}
              size="small"
              sx={{
                bgcolor: 'grey.100',
                p: '4px',
                borderRadius: '11px',
                gap: '4px',
                '& .MuiToggleButton-root': {
                  flex: 1,
                  py: 0.75,
                  border: 'none',
                  borderRadius: '8px !important',
                  fontWeight: 700,
                  fontSize: fontSizes.sm,
                  textTransform: 'none',
                  color: 'text.secondary',
                  '&.Mui-selected': {
                    bgcolor: 'background.paper',
                    color: 'primary.main',
                    boxShadow: '0 1px 3px rgba(16,40,37,.14)',
                    '&:hover': { bgcolor: 'background.paper' },
                  },
                },
              }}
            >
              {kindOptions.map((opt) => (
                <ToggleButton key={opt.value} value={opt.value}>
                  {opt.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}
        />

        <Controller
          name="procedureIds"
          control={control}
          rules={{
            validate: (value) =>
              selectedKind !== 'PROCEDURE' || (value?.length ?? 0) > 0 || 'Selecione ao menos um procedimento',
          }}
          render={({ field, fieldState }) => (
            <LabeledField label="Procedimentos" required={selectedKind === 'PROCEDURE'}>
              <Autocomplete
                multiple
                disableCloseOnSelect
                options={procedureOptions}
                getOptionLabel={(p) => p.name}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                value={procedureOptions.filter((p) => field.value.includes(p.id))}
                onChange={(_, value) => field.onChange(value.map((p) => p.id))}
                disabled={selectedKind !== 'PROCEDURE'}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip {...getTagProps({ index })} key={option.id} label={option.name} size="small" />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={field.value.length === 0 ? 'Selecione um ou mais procedimentos' : undefined}
                    error={!!fieldState.error}
                    helperText={
                      fieldState.error?.message ??
                      (selectedProcedures.length > 1
                        ? 'Duração total somada no horário do agendamento'
                        : undefined)
                    }
                  />
                )}
              />
            </LabeledField>
          )}
        />
        {selectedKind === 'PROCEDURE' && (
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {[
              `${totalDurationMinutes} min${selectedProcedures.length > 1 ? ' (total)' : ''}`,
              `Retorno: ${maxRecurrenceDays ?? '—'} dias`,
              selectedProcedures.length > 0 ? brl.format(totalPrice) : 'R$ —',
            ].map((label) => (
              <Box
                key={label}
                component="span"
                sx={{
                  fontSize: fontSizes.xs,
                  fontWeight: 700,
                  color: 'text.secondary',
                  px: 1.25,
                  py: 0.6,
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'grey.50',
                }}
              >
                {label}
              </Box>
            ))}
          </Stack>
        )}

        {restrictToOwnAppointments ? (
          <LabeledField label="Profissional">
            <TextField
              value={
                checkingAvailability && slotValid
                  ? 'Verificando disponibilidade...'
                  : (assignedProfessional?.name ?? user?.name ?? '—')
              }
              fullWidth
              InputProps={{ readOnly: true }}
              helperText={
                loggedUserCannotBeScheduled
                  ? 'Seu usuário não realiza atendimentos'
                  : professionalSlotConflict
                    ? 'Este profissional já possui agendamento neste horário'
                    : noProfessionalAvailable
                      ? 'Nenhum profissional disponível neste horário'
                      : 'Agendamento vinculado ao seu usuário'
              }
              error={loggedUserCannotBeScheduled || noProfessionalAvailable || professionalSlotConflict}
            />
          </LabeledField>
        ) : (
          <Controller
            name="professionalId"
            control={control}
            rules={{ required: 'Selecione um profissional' }}
            render={({ field, fieldState }) => (
              <LabeledField label="Profissional" required>
                <TextField
                  {...field}
                  value={professionalOptions.some((p) => p.id === field.value) ? field.value : ''}
                  onChange={(event) => {
                    markManualSelection();
                    field.onChange(event);
                  }}
                  select
                  fullWidth
                  disabled={!slotValid || (checkingAvailability && professionalOptions.length === 0)}
                  error={!!fieldState.error || noProfessionalAvailable || professionalSlotConflict}
                  helperText={
                    fieldState.error?.message ??
                    (professionalSlotConflict && !selectedPerformsAppointments
                      ? 'Selecione um profissional que realiza atendimentos'
                      : professionalSlotConflict
                        ? 'Este profissional já possui agendamento neste horário'
                        : noProfessionalAvailable
                          ? 'Nenhum profissional disponível neste horário'
                          : verifyingAvailability && slotValid
                            ? 'Atualizando disponibilidade...'
                            : checkingAvailability && slotValid && professionalOptions.length === 0
                              ? 'Verificando disponibilidade...'
                              : 'Lista conforme a data e o horário escolhidos')
                  }
                >
                  {checkingAvailability && slotValid && professionalOptions.length === 0 ? (
                    <MenuItem disabled value="">
                      Verificando disponibilidade...
                    </MenuItem>
                  ) : professionalOptions.length === 0 ? (
                    <MenuItem disabled value="">
                      Nenhum profissional disponível
                    </MenuItem>
                  ) : (
                    professionalOptions.map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.name}
                      </MenuItem>
                    ))
                  )}
                </TextField>
              </LabeledField>
            )}
          />
        )}
      </Stack>
    </AppointmentFormSection>
  );
}
