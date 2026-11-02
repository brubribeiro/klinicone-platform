import { api } from './client';
import type { PlanLimits } from '../types';

/** Plano ativo como aparece na landing (`GET /public/plans`, sem login). */
export interface PublicPlan {
  name: string;
  slug: string;
  description: string | null;
  priceCents: number | null;
  currency: string;
  features: string[];
  limits: PlanLimits | null;
}

export const publicApi = {
  listPlans: async (): Promise<PublicPlan[]> => {
    const { data } = await api.get<PublicPlan[]>('/public/plans');
    return data;
  },
};
