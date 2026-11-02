import { api } from './client';
import type { PlanLimits } from '../types';

export interface TenantPlanInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceCents: number | null;
  currency: string;
  limits: PlanLimits | null;
}

export interface TenantPlanUsage {
  activeUsers: number;
  patients: number;
  storageBytes: number;
  files: number;
}

export interface TenantPlanSummary {
  plan: TenantPlanInfo | null;
  usage: TenantPlanUsage;
  features: string[];
}

export const tenantPlanApi = {
  getSummary: async (): Promise<TenantPlanSummary> => {
    const { data } = await api.get<TenantPlanSummary>('/tenant/plan');
    return data;
  },
};
