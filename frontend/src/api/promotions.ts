import { api } from './client';
import type { Promotion } from '../types';
import { deleteWithUnlink } from './deletion';
import type { RemoveOptions } from '../utils/deletionConflict';

export interface CreatePromotionPayload {
  name: string;
  description?: string;
  commemorativeDate?: string;
  startAt: string;
  endAt: string;
  discountType: 'PERCENTAGE' | 'FIXED' | 'COMBO';
  discountValue: number;
  active?: boolean;
  procedureIds?: string[];
  packageIds?: string[];
}

export type UpdatePromotionPayload = Partial<CreatePromotionPayload>;

export const promotionsApi = {
  list: async (): Promise<Promotion[]> => {
    const { data } = await api.get<Promotion[]>('/promotions');
    return data;
  },

  get: async (id: string): Promise<Promotion> => {
    const { data } = await api.get<Promotion>(`/promotions/${id}`);
    return data;
  },

  create: async (payload: CreatePromotionPayload): Promise<Promotion> => {
    const { data } = await api.post<Promotion>('/promotions', payload);
    return data;
  },

  update: async (id: string, payload: UpdatePromotionPayload): Promise<Promotion> => {
    const { data } = await api.patch<Promotion>(`/promotions/${id}`, payload);
    return data;
  },

  remove: async (id: string, options?: RemoveOptions): Promise<void> => {
    await deleteWithUnlink(`/promotions/${id}`, options);
  },
};
