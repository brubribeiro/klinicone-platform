import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { packagesApi } from '../../api/packages';
import { useAppToast } from '../../contexts/AppToastContext';
import { getApiErrorMessage } from '../../utils/apiError';
import type { Package, PatientPackage, PaymentMethodEntry, Procedure } from '../../types';
import { DialogHeader } from '../DialogCloseButton';
import { FieldAdornment } from '../FieldAdornment';
import { brl } from './appointmentFormModel';

function suggestedTotal(pkg: Package, procedures: Procedure[]) {
  const sumPrice = (pkg.items ?? []).reduce((sum, item) => {
    const p = procedures.find((pr) => pr.id === item.procedureId);
    return sum + (p ? Number(p.price) * item.quantity : 0);
  }, 0);
  if (pkg.totalPrice) return Number(pkg.totalPrice);
  if (pkg.discountPercent) return sumPrice * (1 - Number(pkg.discountPercent) / 100);
  return sumPrice;
}

/** Vincula um pacote do catálogo ao paciente a partir do agendamento. */
export function SellPackageDialog({
  pkg,
  patientId,
  patientName,
  procedures,
  paymentMethods,
  onClose,
  onCreated,
}: {
  /** Pacote escolhido; o diálogo fica aberto enquanto estiver definido. */
  pkg: Package | null;
  patientId: string;
  patientName?: string;
  procedures: Procedure[];
  paymentMethods: PaymentMethodEntry[];
  onClose: () => void;
  onCreated: (created: PatientPackage) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [totalPaid, setTotalPaid] = useState(0);

  const { data: saleQuote } = useQuery({
    queryKey: ['package-sale-quote', pkg?.id],
    queryFn: () => packagesApi.saleQuote(pkg!.id),
    enabled: !!pkg,
  });
  const promotion = saleQuote?.promotion ? saleQuote : null;

  // Recalcula só ao escolher outro pacote ou ao chegar a cotação, para não sobrescrever o
  // valor digitado. Com promoção ativa vinculada ao pacote, sugere o preço promocional.
  useEffect(() => {
    if (!pkg) return;
    setTotalPaid(promotion ? promotion.finalPrice : suggestedTotal(pkg, procedures));
  }, [pkg, saleQuote]);

  useEffect(() => {
    if (pkg) setPaymentMethodId('');
  }, [pkg]);

  const handleConfirm = async () => {
    if (!pkg || !patientId) return;
    try {
      const created = await packagesApi.createPatientPackage({
        patientId,
        packageId: pkg.id,
        totalPaid,
        ...(paymentMethodId ? { paymentMethodId } : {}),
      });
      queryClient.invalidateQueries({ queryKey: ['patient-packages-active'] });
      queryClient.invalidateQueries({ queryKey: ['patient-packages'] });
      onCreated(created);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao vincular pacote'));
    }
  };

  return (
    <Dialog open={!!pkg} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogHeader
        onClose={onClose}
        title="Adquirir pacote"
        subtitle="Vincular pacote ao paciente selecionado"
        icon={<AddShoppingCartIcon fontSize="small" />}
      />
      <DialogContent>
        {pkg && (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2">
              Vincular o pacote <strong>{pkg.name}</strong> ao paciente <strong>{patientName}</strong>.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {pkg.sessionCount} sessões
              {pkg.validityDays ? ` · Validade: ${pkg.validityDays} dias` : ' · Sem validade'}
            </Typography>

            {promotion?.promotion && (
              <Alert severity="success" sx={{ py: 0.5 }}>
                Promoção <strong>{promotion.promotion.name}</strong>: de{' '}
                {brl.format(promotion.originalPrice)} por{' '}
                <strong>{brl.format(promotion.finalPrice)}</strong> (−{brl.format(promotion.discount)}).
              </Alert>
            )}

            <Alert severity="info" sx={{ py: 0.5 }}>
              O pagamento será registrado ao concluir o primeiro agendamento. Você pode informar
              o pagamento agora, se preferir.
            </Alert>

            <TextField
              type="number"
              label="Valor acordado"
              value={totalPaid}
              onChange={(e) => setTotalPaid(Number(e.target.value))}
              fullWidth
              inputProps={{ step: '0.01', min: 0 }}
              InputProps={{
                startAdornment: <FieldAdornment position="start">R$</FieldAdornment>,
              }}
            />

            <Typography variant="subtitle2" color="text.secondary">
              Pagamento antecipado (opcional)
            </Typography>

            <TextField
              select
              label="Método de pagamento"
              value={paymentMethodId}
              onChange={(e) => setPaymentMethodId(e.target.value)}
              fullWidth
              helperText="Deixe em branco para cobrar ao concluir o agendamento"
            >
              <MenuItem value="">—</MenuItem>
              {paymentMethods.filter((m) => m.active).map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.name}{Number(m.feePercent) > 0 ? ` (${Number(m.feePercent)}%)` : ''}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" disabled={!pkg} onClick={() => void handleConfirm()}>
          Vincular pacote
        </Button>
      </DialogActions>
    </Dialog>
  );
}
