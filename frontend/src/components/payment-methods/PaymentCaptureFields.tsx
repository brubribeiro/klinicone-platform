import { MenuItem, TextField } from '@mui/material';

import { LabeledField } from '../LabeledField';
import { CARD_BRAND_OPTIONS, isCardPaymentKind, type PaymentMethodKind } from '../../utils/paymentMethodMeta';

export interface PaymentCaptureValues {
  installments: string;
  cardBrand: string;
  authorizationCode: string;
}

export const emptyPaymentCapture: PaymentCaptureValues = {
  installments: '',
  cardBrand: '',
  authorizationCode: '',
};

interface Props {
  kind?: PaymentMethodKind | null;
  values: PaymentCaptureValues;
  onChange: (patch: Partial<PaymentCaptureValues>) => void;
  /** Crédito parcelado: sugere parcelas > 1 */
  allowInstallments?: boolean;
}

/** Campos opcionais de maquininha (bandeira, parcelas, NSU) para cartão. */
export function PaymentCaptureFields({ kind, values, onChange, allowInstallments = true }: Props) {
  if (!isCardPaymentKind(kind)) return null;

  return (
    <>
      <LabeledField label="Bandeira">
        <TextField
          select
          fullWidth
          value={values.cardBrand}
          onChange={(e) => onChange({ cardBrand: e.target.value })}
          SelectProps={{ displayEmpty: true }}
        >
          <MenuItem value="">
            <em>Opcional</em>
          </MenuItem>
          {CARD_BRAND_OPTIONS.map((brand) => (
            <MenuItem key={brand} value={brand}>
              {brand}
            </MenuItem>
          ))}
        </TextField>
      </LabeledField>

      {allowInstallments && kind === 'CREDIT' && (
        <LabeledField label="Parcelas">
          <TextField
            type="number"
            fullWidth
            placeholder="1 = à vista"
            value={values.installments}
            onChange={(e) => onChange({ installments: e.target.value })}
            inputProps={{ min: 1, max: 24, step: 1 }}
          />
        </LabeledField>
      )}

      <LabeledField label="NSU / autorização">
        <TextField
          fullWidth
          placeholder="Opcional — comprovante da maquininha"
          value={values.authorizationCode}
          onChange={(e) => onChange({ authorizationCode: e.target.value })}
          inputProps={{ maxLength: 64 }}
        />
      </LabeledField>
    </>
  );
}

export function paymentCaptureToPayload(values: PaymentCaptureValues) {
  const installmentsRaw = values.installments.trim();
  const installments =
    installmentsRaw && Number(installmentsRaw) > 1 ? Number(installmentsRaw) : undefined;
  const cardBrand = values.cardBrand.trim() || undefined;
  const authorizationCode = values.authorizationCode.trim() || undefined;
  return { installments, cardBrand, authorizationCode };
}
