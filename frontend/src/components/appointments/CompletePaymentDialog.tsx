import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  MenuItem,
  Stack,
  TextField,
  Typography,
  alpha,
} from '@mui/material';
import PaymentIcon from '@mui/icons-material/Payment';
import dayjs from 'dayjs';

import { fontSizes } from '../../theme/fontSizes';
import type { PaymentMethodEntry } from '../../types';
import { DialogHeader, dialogActionsBorderSx, dialogPaperSx, dialogSimpleContentSx } from '../DialogCloseButton';
import { brl } from './appointmentFormModel';
import { LabeledField } from './AppointmentFormSection';
import { PromotionPriceLines, type PromotionSummary } from './AppointmentSummary';
import {
  PaymentCaptureFields,
  emptyPaymentCapture,
  paymentCaptureToPayload,
} from '../payment-methods/PaymentCaptureFields';

/** Forma de pagamento (e mês de competência) ao concluir um atendimento que gera receita. */
export function CompletePaymentDialog({
  open,
  isMobile,
  patientName,
  procedureName,
  isPackage,
  amount,
  promotion,
  paymentMethods,
  appointmentMonthKey,
  isPending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  isMobile: boolean;
  patientName?: string;
  procedureName?: string;
  isPackage: boolean;
  amount: number;
  /** Promoção do dia aplicada à receita (valor cheio e desconto). */
  promotion?: PromotionSummary;
  paymentMethods: PaymentMethodEntry[];
  /** Mês (YYYY-MM) do agendamento; habilita o mês de referência quando é passado. */
  appointmentMonthKey: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: (data: {
    paymentMethodId: string;
    referenceMonth: string;
    installments?: number;
    cardBrand?: string;
    authorizationCode?: string;
  }) => void;
}) {
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [referenceMonth, setReferenceMonth] = useState('');
  const [capture, setCapture] = useState(emptyPaymentCapture);

  useEffect(() => {
    if (!open) return;
    setPaymentMethodId('');
    setReferenceMonth('');
    setCapture(emptyPaymentCapture);
  }, [open]);

  const selectedMethod = paymentMethods.find((pm) => pm.id === paymentMethodId);

  const currentMonthKey = dayjs().format('YYYY-MM');
  const isOldAppointment = !!appointmentMonthKey && appointmentMonthKey < currentMonthKey;

  const referenceMonthOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    if (!appointmentMonthKey) return opts;
    const end = dayjs().startOf('month');
    let m = dayjs(`${appointmentMonthKey}-01`).startOf('month');
    // Do mês do agendamento até o mês atual (inclusive)
    while (m.isBefore(end) || m.isSame(end, 'month')) {
      const label = m.format('MMMM [de] YYYY').replace(/^./, (c) => c.toUpperCase());
      opts.push({
        value: m.format('YYYY-MM'),
        label: m.isSame(end, 'month') ? `${label} (atual)` : label,
      });
      m = m.add(1, 'month');
    }
    return opts;
  }, [appointmentMonthKey]);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { ...dialogPaperSx(isMobile), ...(isMobile ? {} : { maxWidth: 480 }) } }}
    >
      <DialogHeader
        onClose={onCancel}
        title="Registrar no financeiro"
        subtitle="Este agendamento será lançado como receita do dia"
        subtitleWrap
      />
      <DialogContent sx={dialogSimpleContentSx}>
        <Box
          sx={{
            p: 2,
            mb: 2.75,
            borderRadius: '14px',
            border: '1px solid',
            borderColor: (t) => alpha(t.palette.primary.main, 0.22),
            bgcolor: (t) => alpha(t.palette.primary.main, 0.07),
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                borderRadius: '11px',
                flexShrink: 0,
                bgcolor: 'background.paper',
                color: 'primary.main',
                border: '1px solid',
                borderColor: (t) => alpha(t.palette.primary.main, 0.22),
              }}
            >
              <PaymentIcon fontSize="small" />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: fontSizes.md, fontWeight: 800, lineHeight: 1.35 }}>
                {patientName ?? 'Paciente'}
              </Typography>
              <Typography noWrap sx={{ fontSize: fontSizes.xs, color: 'text.secondary', lineHeight: 1.35 }}>
                {procedureName ?? 'Atendimento'}
              </Typography>
            </Box>
          </Stack>
          {promotion && (
            <Box
              sx={{
                mt: 1.5,
                pt: 1.5,
                borderTop: '1px dashed',
                borderColor: (t) => alpha(t.palette.primary.main, 0.22),
              }}
            >
              <PromotionPriceLines promotion={promotion} />
            </Box>
          )}
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{
              mt: promotion ? 0.75 : 1.5,
              pt: promotion ? 0 : 1.5,
              borderTop: promotion ? 'none' : '1px dashed',
              borderColor: (t) => alpha(t.palette.primary.main, 0.22),
            }}
          >
            <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary' }}>
              {isPackage ? 'Receita do pacote ao confirmar' : 'Receita ao confirmar'}
            </Typography>
            <Typography sx={{ fontSize: fontSizes.xl, fontWeight: 800, color: 'primary.dark' }}>
              {amount > 0 ? brl.format(amount) : '—'}
            </Typography>
          </Stack>
        </Box>
        <LabeledField label="Forma de pagamento" required>
          <TextField
            select
            value={paymentMethodId}
            onChange={(e) => {
              setPaymentMethodId(e.target.value);
              setCapture(emptyPaymentCapture);
            }}
            fullWidth
            SelectProps={{
              displayEmpty: true,
              renderValue: (val) => {
                const m = paymentMethods.find((pm) => pm.id === val);
                return m ? (
                  `${m.name}${Number(m.feePercent) > 0 ? ` (${Number(m.feePercent)}%)` : ''}`
                ) : (
                  <Typography component="span" variant="body2" sx={{ color: 'text.disabled' }}>
                    Selecione uma forma de pagamento
                  </Typography>
                );
              },
            }}
          >
            {paymentMethods.filter((m) => m.active).map((m) => (
              <MenuItem key={m.id} value={m.id}>
                {m.name}{Number(m.feePercent) > 0 ? ` (${Number(m.feePercent)}%)` : ''}
              </MenuItem>
            ))}
          </TextField>
        </LabeledField>
        {selectedMethod && (
          <Stack spacing={2.25} sx={{ mt: 2.25 }}>
            <PaymentCaptureFields
              kind={selectedMethod.kind}
              values={capture}
              onChange={(patch) => setCapture((prev) => ({ ...prev, ...patch }))}
            />
          </Stack>
        )}
        {isOldAppointment && (
          <Box sx={{ mt: 2.25 }}>
            <LabeledField label="Mês de referência">
              <TextField
                select
                value={referenceMonth}
                onChange={(e) => setReferenceMonth(e.target.value)}
                fullWidth
                SelectProps={{
                  displayEmpty: true,
                  renderValue: (val) => {
                    const opt = referenceMonthOptions.find((o) => o.value === val);
                    return opt ? (
                      opt.label
                    ) : (
                      <Typography component="span" variant="body2" sx={{ color: 'text.disabled' }}>
                        Selecione o mês de competência
                      </Typography>
                    );
                  },
                }}
              >
                {referenceMonthOptions.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </TextField>
            </LabeledField>
            <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', mt: 0.75, lineHeight: 1.4 }}>
              Use um mês passado para registrar agendamentos atrasados no financeiro correto.
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={dialogActionsBorderSx}>
        <Button
          variant="outlined"
          onClick={onCancel}
          sx={{
            bgcolor: 'background.paper',
            borderColor: 'divider',
            color: 'text.secondary',
            '&:hover': { bgcolor: 'grey.50', borderColor: 'divider' },
          }}
        >
          Cancelar
        </Button>
        <Button
          variant="contained"
          disabled={!paymentMethodId || isPending}
          onClick={() =>
            onConfirm({
              paymentMethodId,
              referenceMonth,
              ...paymentCaptureToPayload(capture),
            })
          }
          sx={{ boxShadow: (t) => `0 6px 16px -6px ${t.palette.primary.main}` }}
        >
          {isPending ? 'Salvando...' : 'Confirmar e registrar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
