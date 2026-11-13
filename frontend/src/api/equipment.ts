import { api } from './client';
import type { Equipment } from '../types';
import { deleteWithUnlink } from './deletion';
import type { RemoveOptions } from '../utils/deletionConflict';

export interface EquipmentPayload {
  name: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: string;
  purchaseValue?: number;
  maintenanceValue?: number;
  maintenanceIntervalMonths?: number;
  maintenanceNotifyDaysBefore?: number;
  lastMaintenanceAt?: string;
  scheduledMaintenanceAt?: string;
  notes?: string;
  active?: boolean;
}

export const equipmentApi = {
  list: async (): Promise<Equipment[]> => {
    const { data } = await api.get<Equipment[]>('/equipment');
    return data;
  },
  dueSoon: async (days = 30): Promise<Equipment[]> => {
    const { data } = await api.get<Equipment[]>('/equipment/due-soon', { params: { days } });
    return data;
  },
  create: async (payload: EquipmentPayload): Promise<Equipment> => {
    const { data } = await api.post<Equipment>('/equipment', payload);
    return data;
  },
  update: async (id: string, payload: Partial<EquipmentPayload>): Promise<Equipment> => {
    const { data } = await api.patch<Equipment>(`/equipment/${id}`, payload);
    return data;
  },
  registerMaintenance: async (id: string): Promise<Equipment> => {
    const { data } = await api.post<Equipment>(`/equipment/${id}/maintenance`);
    return data;
  },
  remove: async (id: string, options?: RemoveOptions): Promise<void> => {
    await deleteWithUnlink(`/equipment/${id}`, options);
  },
};
