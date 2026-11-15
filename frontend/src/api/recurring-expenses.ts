import { api } from './client';
import type { ExpenseType, RecurringExpense } from '../types';
import { deleteWithUnlink } from './deletion';
import type { RemoveOptions } from '../utils/deletionConflict';

export interface RecurringExpensePayload {
  name: string;
  description?: string;
  amount: number;
  category?: string;
  expenseType: ExpenseType;
  dueDay: number;
  active?: boolean;
}

export interface GenerateResult {
  generated: number;
  items: string[];
  month: string;
}

export interface HourlyCostSummary {
  hourlyCost: number;
  recurringExpensesMonthly: number;
  recurringFixedMonthly: number;
  financeExpensesMonthly: number;
  financeFixedMonthly: number;
  includeVariable: boolean;
  weeklyHours: number;
  monthlyHours: number;
  primaryProfessional: { id: string; name: string } | null;
}

export interface HourlyCostSettings {
  includeVariable: boolean;
}

export const recurringExpensesApi = {
  list: async (): Promise<RecurringExpense[]> => {
    const { data } = await api.get<RecurringExpense[]>('/recurring-expenses');
    return data;
  },
  getHourlyCostSettings: async (): Promise<HourlyCostSettings> => {
    const { data } = await api.get<HourlyCostSettings>('/recurring-expenses/hourly-cost-settings');
    return data;
  },

  updateHourlyCostSettings: async (includeVariable: boolean): Promise<HourlyCostSettings> => {
    const { data } = await api.patch<HourlyCostSettings>(
      '/recurring-expenses/hourly-cost-settings',
      { includeVariable },
    );
    return data;
  },

  getHourlyCostSummary: async (includeVariable: boolean): Promise<HourlyCostSummary> => {
    const { data } = await api.get<HourlyCostSummary>('/recurring-expenses/hourly-cost-summary', {
      params: { includeVariable: includeVariable ? 'true' : 'false' },
    });
    return data;
  },
  create: async (payload: RecurringExpensePayload): Promise<RecurringExpense> => {
    const { data } = await api.post<RecurringExpense>('/recurring-expenses', payload);
    return data;
  },
  update: async (
    id: string,
    payload: Partial<RecurringExpensePayload>,
  ): Promise<RecurringExpense> => {
    const { data } = await api.patch<RecurringExpense>(`/recurring-expenses/${id}`, payload);
    return data;
  },
  remove: async (id: string, options?: RemoveOptions): Promise<void> => {
    await deleteWithUnlink(`/recurring-expenses/${id}`, options);
  },
  generate: async (year?: number, month?: number): Promise<GenerateResult> => {
    const { data } = await api.post<GenerateResult>('/recurring-expenses/generate', null, {
      params: { year, month },
    });
    return data;
  },
};
