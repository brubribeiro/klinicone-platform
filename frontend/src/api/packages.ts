import { api } from './client';
import type { Package, PackageStats, PatientPackage, PromotionQuote } from '../types';

export interface PackageItemInput {
  procedureId: string;
  quantity: number;
  sortOrder?: number;
}

export interface PackagePayload {
  name: string;
  description?: string;
  type: 'COMBO' | 'SESSIONS';
  totalPrice?: number | null;
  discountPercent?: number | null;
  validityDays?: number | null;
  active?: boolean;
  highlight?: string | null;
  items: PackageItemInput[];
}

export interface PatientPackagePayload {
  patientId: string;
  packageId: string;
  totalPaid?: number;
  paymentMethodId?: string;
  notes?: string;
}

export const packagesApi = {
  list: async (): Promise<Package[]> => {
    const { data } = await api.get<Package[]>('/packages');
    return data;
  },
  getStats: async (): Promise<PackageStats> => {
    const { data } = await api.get<PackageStats>('/packages/stats/summary');
    return data;
  },
  findOne: async (id: string): Promise<Package> => {
    const { data } = await api.get<Package>(`/packages/${id}`);
    return data;
  },
  /** Preço de venda hoje, com a promoção ativa vinculada ao pacote. */
  saleQuote: async (id: string): Promise<PromotionQuote> => {
    const { data } = await api.get<PromotionQuote>(`/packages/${id}/sale-quote`);
    return data;
  },
  create: async (payload: PackagePayload): Promise<Package> => {
    const { data } = await api.post<Package>('/packages', payload);
    return data;
  },
  update: async (id: string, payload: Partial<PackagePayload>): Promise<Package> => {
    const { data } = await api.patch<Package>(`/packages/${id}`, payload);
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await api.delete(`/packages/${id}`);
  },

  listPatientPackages: async (patientId?: string): Promise<PatientPackage[]> => {
    const params = patientId ? { patientId } : {};
    const { data } = await api.get<PatientPackage[]>('/packages/patient-packages/list', { params });
    return data;
  },
  listActiveForPatient: async (patientId: string): Promise<PatientPackage[]> => {
    const { data } = await api.get<PatientPackage[]>(`/packages/patient-packages/active/${patientId}`);
    return data;
  },
  findPatientPackage: async (id: string): Promise<PatientPackage> => {
    const { data } = await api.get<PatientPackage>(`/packages/patient-packages/${id}`);
    return data;
  },
  createPatientPackage: async (payload: PatientPackagePayload): Promise<PatientPackage> => {
    const { data } = await api.post<PatientPackage>('/packages/patient-packages', payload);
    return data;
  },
  updatePatientPackage: async (
    id: string,
    payload: { status?: string; notes?: string },
  ): Promise<PatientPackage> => {
    const { data } = await api.patch<PatientPackage>(`/packages/patient-packages/${id}`, payload);
    return data;
  },
};
