import { Box, Button, Chip, MenuItem, Stack, TextField, Typography, alpha } from '@mui/material';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';

import { fontSizes } from '../../theme/fontSizes';
import { formatDateOnlyFromApi } from '../../utils/dateOnly';
import type { Package, PatientPackage, Procedure } from '../../types';
import { brl } from './appointmentFormModel';
import { AppointmentFormSection, LabeledField } from './AppointmentFormSection';
import type { SectionControl } from './PatientSection';

export function PackageSection({
  section,
  isEditing,
  selectedProcedures,
  selectedPackageId,
  onSelectPackage,
  filteredPatientPackages,
  selectedPatientPkg,
  availableCatalogPackages,
  packageSessionsCount,
  paymentAmount,
  onOpenSessions,
  onScheduleRemaining,
  onBuyPackage,
}: {
  section: SectionControl;
  isEditing: boolean;
  selectedProcedures: Procedure[];
  selectedPackageId: string;
  onSelectPackage: (id: string) => void;
  filteredPatientPackages: PatientPackage[];
  selectedPatientPkg?: PatientPackage;
  availableCatalogPackages: Package[];
  packageSessionsCount: number;
  paymentAmount: number;
  onOpenSessions: () => void;
  onScheduleRemaining: (pkg: PatientPackage) => void;
  onBuyPackage: (pkg: Package) => void;
}) {
  const remainingSessions = selectedPatientPkg
    ? selectedPatientPkg.sessionsTotal - selectedPatientPkg.sessionsUsed
    : 0;
  const summary = [
    selectedPatientPkg ? (selectedPatientPkg.package?.name ?? 'Pacote') : 'Avulso',
    paymentAmount > 0 ? brl.format(paymentAmount) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <AppointmentFormSection
      {...section}
      title="Pacote e pagamento"
      summary={summary}
      action={
        selectedPackageId ? (
          <Button
            size="small"
            startIcon={<CalendarMonthIcon sx={{ fontSize: '1rem !important' }} />}
            onClick={onOpenSessions}
            sx={{
              minWidth: 0,
              px: 0.75,
              py: 0.25,
              fontSize: fontSizes.xs,
              fontWeight: 700,
              color: 'primary.main',
            }}
          >
            Ver sessões
            {packageSessionsCount > 0 ? ` (${packageSessionsCount})` : ''}
          </Button>
        ) : undefined
      }
    >
      <Box sx={{ mb: 1.5 }}>
        <LabeledField label="Pacote ativo do paciente">
          <TextField
            select
            value={selectedPackageId}
            onChange={(e) => onSelectPackage(e.target.value)}
            fullWidth
            disabled={filteredPatientPackages.length === 0}
            SelectProps={{
              displayEmpty: true,
              renderValue: (val) => {
                if (!val) {
                  return (
                    <Typography component="span" variant="body2" sx={{ color: 'text.disabled' }}>
                      {filteredPatientPackages.length === 0 ? 'Nenhum pacote ativo' : 'Nenhum (avulso)'}
                    </Typography>
                  );
                }
                const pp = filteredPatientPackages.find((p) => p.id === val);
                return pp
                  ? `${pp.package?.name ?? 'Pacote'} — ${pp.sessionsUsed}/${pp.sessionsTotal} sessões`
                  : '';
              },
            }}
            helperText={
              filteredPatientPackages.length === 0
                ? 'Este paciente não possui pacotes ativos'
                : selectedPatientPkg
                  ? `${selectedPatientPkg.sessionsUsed}/${selectedPatientPkg.sessionsTotal} sessões usadas${
                      selectedPatientPkg.expiresAt
                        ? ` · expira em ${formatDateOnlyFromApi(selectedPatientPkg.expiresAt)}`
                        : ''
                    }`
                  : 'Vincular este agendamento a um pacote ativo'
            }
          >
            <MenuItem value="">
              <em>Nenhum (avulso)</em>
            </MenuItem>
            {filteredPatientPackages.map((pp) => (
              <MenuItem key={pp.id} value={pp.id}>
                {pp.package?.name ?? 'Pacote'} — {pp.sessionsUsed}/{pp.sessionsTotal} sessões
              </MenuItem>
            ))}
          </TextField>
        </LabeledField>
      </Box>

      {selectedPatientPkg && !isEditing && remainingSessions > 1 && (
        <Button
          size="small"
          variant="outlined"
          startIcon={<CalendarMonthIcon />}
          onClick={() => onScheduleRemaining(selectedPatientPkg)}
          sx={{ mb: 1.5 }}
        >
          Agendar {remainingSessions} sessões restantes
        </Button>
      )}

      {filteredPatientPackages.length === 0 && availableCatalogPackages.length > 0 && (
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            Pacotes disponíveis para <strong>{selectedProcedures.map((p) => p.name).join(' + ')}</strong>
          </Typography>
          {availableCatalogPackages.map((pkg) => {
            const itemForProc = pkg.items?.find((i) => selectedProcedures.some((p) => p.id === i.procedureId));
            const sessions =
              pkg.type === 'SESSIONS' ? (itemForProc?.quantity ?? pkg.sessionCount) : pkg.sessionCount;
            const price = pkg.totalPrice
              ? brl.format(Number(pkg.totalPrice))
              : pkg.discountPercent
                ? `${Number(pkg.discountPercent)}% de desconto`
                : '';
            return (
              <Box
                key={pkg.id}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: (theme) => alpha(theme.palette.primary.main, 0.22),
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1.5,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600}>
                    {pkg.name}
                  </Typography>
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5 }}>
                    <Chip size="small" label={`${sessions} sessões`} color="primary" variant="outlined" />
                    {price && (
                      <Typography variant="caption" color="text.secondary">
                        {price}
                      </Typography>
                    )}
                  </Stack>
                </Box>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<AddShoppingCartIcon />}
                  onClick={() => onBuyPackage(pkg)}
                  sx={{ flexShrink: 0 }}
                >
                  Adquirir
                </Button>
              </Box>
            );
          })}
        </Stack>
      )}

      {filteredPatientPackages.length === 0 && availableCatalogPackages.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          Nenhum pacote disponível para este procedimento.
        </Typography>
      )}

      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed', borderColor: 'divider' }}
      >
        <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', lineHeight: 1.4 }}>
          Valor previsto · a forma de pagamento é informada ao concluir
        </Typography>
        <Typography sx={{ fontSize: fontSizes.md, fontWeight: 800, color: 'primary.dark', flexShrink: 0, ml: 1 }}>
          {paymentAmount > 0 ? brl.format(paymentAmount) : '—'}
        </Typography>
      </Stack>
    </AppointmentFormSection>
  );
}
