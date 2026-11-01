import { api } from './client';
import type {
  ApplicationMap,
  Appointment,
  AppointmentKind,
  AppointmentStatus,
  PromotionQuote,
} from '../types';

export interface AppointmentPayload {
  patientId: string;
  procedureId?: string;
  professionalId: string;
  startAt: string;
  endAt: string;
  status?: AppointmentStatus;
  kind?: AppointmentKind;
  notes?: string;
  clinicalNotes?: string;
  paymentMethodId?: string;
  installments?: number;
  cardBrand?: string;
  authorizationCode?: string;
  /** Mês de competência da receita ("YYYY-MM"); usado para lançar agendamentos antigos. */
  referenceMonth?: string;
  patientPackageId?: string | null;
  extraMaterials?: { itemId: string; quantity: number }[];
  /** Só na edição; lista de pontos vazia apaga o mapa. */
  applicationMap?: ApplicationMap;
}

export const appointmentsBackfillFinance = async (): Promise<{ created: number }> => {
  const { data } = await api.post<{ created: number }>('/appointments/backfill-finance');
  return data;
};

export interface RecurrenceLimitResult {
  earliestDate: string | null;
  recurrenceDays: number | null;
  lastCompletedAt: string | null;
}

export const appointmentsApi = {
  list: async (from?: string, to?: string): Promise<Appointment[]> => {
    const { data } = await api.get<Appointment[]>('/appointments', {
      params: { from, to },
    });
    return data;
  },
  getRecurrenceLimit: async (
    patientId: string,
    procedureId: string,
    excludeId?: string,
  ): Promise<RecurrenceLimitResult> => {
    const { data } = await api.get<RecurrenceLimitResult>('/appointments/recurrence-limit', {
      params: { patientId, procedureId, excludeId },
    });
    return data;
  },
  /** Prévia da promoção do procedimento avulso no dia `date` (YYYY-MM-DD). */
  promotionPreview: async (procedureId: string, date: string): Promise<PromotionQuote> => {
    const { data } = await api.get<PromotionQuote>('/appointments/promotion-preview', {
      params: { procedureId, date },
    });
    return data;
  },
  findOne: async (id: string): Promise<Appointment> => {
    const { data } = await api.get<Appointment>(`/appointments/${id}`);
    return data;
  },
  create: async (payload: AppointmentPayload): Promise<Appointment> => {
    const { data } = await api.post<Appointment>('/appointments', payload);
    return data;
  },
  update: async (id: string, payload: Partial<AppointmentPayload>): Promise<Appointment> => {
    const { data } = await api.patch<Appointment>(`/appointments/${id}`, payload);
    return data;
  },
  pending: async (): Promise<Appointment[]> => {
    const { data } = await api.get<Appointment[]>('/appointments/pending');
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await api.delete(`/appointments/${id}`);
  },
  start: async (id: string): Promise<Appointment> => {
    const { data } = await api.patch<Appointment>(`/appointments/${id}/start`);
    return data;
  },
  finish: async (id: string): Promise<Appointment> => {
    const { data } = await api.patch<Appointment>(`/appointments/${id}/finish`);
    return data;
  },
  resume: async (id: string): Promise<Appointment> => {
    const { data } = await api.patch<Appointment>(`/appointments/${id}/resume`);
    return data;
  },
};
