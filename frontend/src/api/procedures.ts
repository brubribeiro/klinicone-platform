import { api } from './client';
import type { Procedure } from '../types';
import { deleteWithUnlink } from './deletion';
import type { RemoveOptions } from '../utils/deletionConflict';

export interface ProcedureMaterialInput {
  itemId: string;
  quantity: number;
}

export interface ProcedurePayload {
  name: string;
  description?: string;
  category?: string;
  durationMinutes: number;
  price: number;
  active?: boolean;
  recurrenceDays?: number | null;
  applicationMap?: boolean;
  materials?: ProcedureMaterialInput[];
  equipments?: { equipmentId: string; costPerUse: number }[];
}

export const proceduresApi = {
  list: async (): Promise<Procedure[]> => {
    const { data } = await api.get<Procedure[]>('/procedures');
    return data;
  },
  findOne: async (id: string): Promise<Procedure> => {
    const { data } = await api.get<Procedure>(`/procedures/${id}`);
    return data;
  },
  create: async (payload: ProcedurePayload): Promise<Procedure> => {
    const { data } = await api.post<Procedure>('/procedures', payload);
    return data;
  },
  update: async (id: string, payload: ProcedurePayload): Promise<Procedure> => {
    const { data } = await api.patch<Procedure>(`/procedures/${id}`, payload);
    return data;
  },
  remove: async (id: string, options?: RemoveOptions): Promise<void> => {
    await deleteWithUnlink(`/procedures/${id}`, options);
  },
};
