import { api } from './client';
import type { PaymentMethodEntry, PaymentMethodKind } from '../types';

export interface CreatePaymentMethodPayload {
  name: string;
  kind?: PaymentMethodKind;
  settlementDays?: number;
  feePercent?: number;
  active?: boolean;
}

export type UpdatePaymentMethodPayload = Partial<CreatePaymentMethodPayload>;

export const paymentMethodsApi = {
  list: async (): Promise<PaymentMethodEntry[]> => {
    const { data } = await api.get<PaymentMethodEntry[]>('/payment-methods');
    return data;
  },

  get: async (id: string): Promise<PaymentMethodEntry> => {
    const { data } = await api.get<PaymentMethodEntry>(`/payment-methods/${id}`);
    return data;
  },

  create: async (payload: CreatePaymentMethodPayload): Promise<PaymentMethodEntry> => {
    const { data } = await api.post<PaymentMethodEntry>('/payment-methods', payload);
    return data;
  },

  update: async (id: string, payload: UpdatePaymentMethodPayload): Promise<PaymentMethodEntry> => {
    const { data } = await api.patch<PaymentMethodEntry>(`/payment-methods/${id}`, payload);
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/payment-methods/${id}`);
  },
};
