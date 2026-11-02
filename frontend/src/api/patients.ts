import { api } from './client';
import type {
  Patient,
  Appointment,
  PatientSex,
  PatientReferralSource,
  PatientStats,
  PatientPhoto,
  PatientPhotoPhase,
  PatientMeasurement,
} from '../types';

export interface PatientPayload {
  name: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  /** M = masculino, F = feminino; null ou string vazia limpa ao editar */
  sex?: PatientSex | '' | null;
  document?: string;
  /** 8 dígitos; ao editar, string vazia limpa o CEP salvo no backend */
  cep?: string;
  addressStreet?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;
  addressNumber?: string;
  addressComplement?: string;
  address?: string;
  notes?: string;
  /** null ou string vazia limpa ao editar */
  referralSource?: PatientReferralSource | '' | null;
  referralSourceOther?: string;
  anamnesis?: Record<string, any>;
}

export type PatientWithHistory = Patient & {
  appointments: Appointment[];
  visits?: number;
  lastVisit?: string | null;
  totalSpent?: number;
};

export const patientsApi = {
  list: async (search?: string): Promise<Patient[]> => {
    const { data } = await api.get<Patient[]>('/patients', { params: { search } });
    return data;
  },
  stats: async (): Promise<PatientStats> => {
    const { data } = await api.get<PatientStats>('/patients/stats');
    return data;
  },
  findOne: async (id: string): Promise<PatientWithHistory> => {
    const { data } = await api.get<PatientWithHistory>(`/patients/${id}`);
    return data;
  },
  create: async (payload: PatientPayload): Promise<Patient> => {
    const { data } = await api.post<Patient>('/patients', payload);
    return data;
  },
  update: async (id: string, payload: PatientPayload): Promise<Patient> => {
    const { data } = await api.patch<Patient>(`/patients/${id}`, payload);
    return data;
  },
  updateAnamnesis: async (id: string, anamnesis: Record<string, unknown>): Promise<Patient> => {
    const { data } = await api.patch<Patient>(`/patients/${id}`, { anamnesis });
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await api.delete(`/patients/${id}`);
  },

  uploadPhoto: async (id: string, file: File): Promise<Patient> => {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await api.post<Patient>(`/patients/${id}/photo`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  removePhoto: async (id: string): Promise<Patient> => {
    const { data } = await api.delete<Patient>(`/patients/${id}/photo`);
    return data;
  },

  getPhotoAccessUrl: async (id: string): Promise<string> => {
    const { data } = await api.get<{ url: string }>(`/patients/${id}/photo-url`);
    return data.url;
  },
  getReliability: async (id: string): Promise<PatientReliability> => {
    const { data } = await api.get<PatientReliability>(`/patients/${id}/reliability`);
    return data;
  },

  listPhotos: async (id: string): Promise<PatientPhoto[]> => {
    const { data } = await api.get<PatientPhoto[]>(`/patients/${id}/photos`);
    return data;
  },
  addPhoto: async (
    id: string,
    file: File,
    meta: { appointmentId: string; phase: PatientPhotoPhase; label?: string; pairId?: string; takenAt?: string },
  ): Promise<PatientPhoto> => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('appointmentId', meta.appointmentId);
    fd.append('phase', meta.phase);
    if (meta.label) fd.append('label', meta.label);
    if (meta.pairId) fd.append('pairId', meta.pairId);
    if (meta.takenAt) fd.append('takenAt', meta.takenAt);
    const { data } = await api.post<PatientPhoto>(`/patients/${id}/photos`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  removePhoto2: async (id: string, photoId: string): Promise<void> => {
    await api.delete(`/patients/${id}/photos/${photoId}`);
  },
  listMeasurements: async (id: string): Promise<PatientMeasurement[]> => {
    const { data } = await api.get<PatientMeasurement[]>(`/patients/${id}/measurements`);
    return data;
  },
  createMeasurement: async (id: string, payload: PatientMeasurementPayload): Promise<PatientMeasurement> => {
    const { data } = await api.post<PatientMeasurement>(`/patients/${id}/measurements`, payload);
    return data;
  },
  updateMeasurement: async (
    id: string,
    measurementId: string,
    payload: PatientMeasurementPayload,
  ): Promise<PatientMeasurement> => {
    const { data } = await api.patch<PatientMeasurement>(`/patients/${id}/measurements/${measurementId}`, payload);
    return data;
  },
  removeMeasurement: async (id: string, measurementId: string): Promise<void> => {
    await api.delete(`/patients/${id}/measurements/${measurementId}`);
  },
};

export interface PatientMeasurementPayload {
  measuredAt?: string;
  appointmentId?: string | null;
  weightKg?: number | null;
  heightCm?: number | null;
  waistCm?: number | null;
  abdomenCm?: number | null;
  hipCm?: number | null;
  notes?: string | null;
}

export interface PatientReliability {
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
  reliabilityPercent: number;
}
