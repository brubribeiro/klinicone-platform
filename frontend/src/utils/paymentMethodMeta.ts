export type PaymentMethodKind = 'CASH' | 'PIX' | 'DEBIT' | 'CREDIT' | 'OTHER';

export const PAYMENT_METHOD_KIND_OPTIONS: { value: PaymentMethodKind; label: string }[] = [
  { value: 'CASH', label: 'Dinheiro' },
  { value: 'PIX', label: 'PIX' },
  { value: 'DEBIT', label: 'Débito' },
  { value: 'CREDIT', label: 'Crédito' },
  { value: 'OTHER', label: 'Outro' },
];

export const CARD_BRAND_OPTIONS = [
  'Visa',
  'Mastercard',
  'Elo',
  'Amex',
  'Hipercard',
  'Outra',
] as const;

export function paymentMethodKindLabel(kind?: PaymentMethodKind | null): string {
  return PAYMENT_METHOD_KIND_OPTIONS.find((o) => o.value === kind)?.label ?? 'Outro';
}

export function isCardPaymentKind(kind?: PaymentMethodKind | null): boolean {
  return kind === 'DEBIT' || kind === 'CREDIT';
}

export function settlementDaysLabel(days: number): string {
  if (days <= 0) return 'Recebimento imediato';
  if (days === 1) return '1 dia útil para receber';
  return `${days} dias para receber`;
}

export function formatInstallmentsLabel(installments?: number | null): string | null {
  if (!installments || installments <= 1) return null;
  return `${installments}x`;
}
