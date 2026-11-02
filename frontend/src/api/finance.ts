import { api } from './client';
import type { FinancialEntry, FinancialType } from '../types';

export interface FinancialEntryPayload {
  type: FinancialType;
  description: string;
  amount: number;
  paymentMethodId?: string;
  installments?: number;
  cardBrand?: string;
  authorizationCode?: string;
  category?: string;
  paidAt?: string;
  dueDate?: string;
  patientId?: string;
  appointmentId?: string;
}

export interface FinanceSummary {
  totalIncome: number;
  totalNetIncome: number;
  totalFees: number;
  totalExpense: number;
  balance: number;
  netBalance: number;
}

export const financeApi = {
  list: async (
    from?: string,
    to?: string,
    pendingInvoice?: boolean,
    expenseType?: 'FIXED' | 'VARIABLE',
    patientId?: string,
  ): Promise<FinancialEntry[]> => {
    const { data } = await api.get<FinancialEntry[]>('/finance', {
      params: {
        from,
        to,
        pendingInvoice: pendingInvoice ? 'true' : undefined,
        expenseType,
        patientId,
      },
    });
    return data;
  },
  listUpcomingUnpaidExpenses: async (from?: string, to?: string): Promise<FinancialEntry[]> => {
    const { data } = await api.get<FinancialEntry[]>('/finance/upcoming-expenses', {
      params: { from, to },
    });
    return data;
  },
  setInvoiceIssued: async (id: string, issued: boolean): Promise<FinancialEntry> => {
    const { data } = await api.patch<FinancialEntry>(`/finance/${id}/invoice`, { issued });
    return data;
  },
  summary: async (from?: string, to?: string): Promise<FinanceSummary> => {
    const { data } = await api.get<FinanceSummary>('/finance/summary', { params: { from, to } });
    return data;
  },
  markPaid: async (id: string, paid: boolean): Promise<FinancialEntry> => {
    const { data } = await api.patch<FinancialEntry>(`/finance/${id}/paid`, { paid });
    return data;
  },
  create: async (payload: FinancialEntryPayload): Promise<FinancialEntry> => {
    const { data } = await api.post<FinancialEntry>('/finance', payload);
    return data;
  },
  update: async (id: string, payload: Partial<FinancialEntryPayload>): Promise<FinancialEntry> => {
    const { data } = await api.patch<FinancialEntry>(`/finance/${id}`, payload);
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await api.delete(`/finance/${id}`);
  },
};
