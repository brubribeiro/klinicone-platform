import { api } from './client';
import type { AnamnesisKind, AnamnesisQuestion, AnamnesisQuestionType, PublicAnamnesisForm } from '../types';

export interface AnamnesisQuestionPayload {
  kind: AnamnesisKind;
  label: string;
  type: AnamnesisQuestionType;
  options?: string[];
  section?: string | null;
  placeholder?: string | null;
  required?: boolean;
  active?: boolean;
}

export const anamnesisApi = {
  listQuestions: async (kind: AnamnesisKind): Promise<AnamnesisQuestion[]> => {
    const { data } = await api.get<AnamnesisQuestion[]>('/anamnesis/questions', { params: { kind } });
    return data;
  },
  createQuestion: async (payload: AnamnesisQuestionPayload): Promise<AnamnesisQuestion> => {
    const { data } = await api.post<AnamnesisQuestion>('/anamnesis/questions', payload);
    return data;
  },
  updateQuestion: async (id: string, payload: Partial<Omit<AnamnesisQuestionPayload, 'kind'>>): Promise<AnamnesisQuestion> => {
    const { data } = await api.patch<AnamnesisQuestion>(`/anamnesis/questions/${id}`, payload);
    return data;
  },
  reorderQuestions: async (kind: AnamnesisKind, ids: string[]): Promise<AnamnesisQuestion[]> => {
    const { data } = await api.patch<AnamnesisQuestion[]>('/anamnesis/questions/reorder', { kind, ids });
    return data;
  },
  /** Gera um link novo para a paciente (revoga o anterior). */
  createLink: async (patientId: string): Promise<{ token: string; expiresAt: string }> => {
    const { data } = await api.post<{ token: string; expiresAt: string }>('/anamnesis/links', { patientId });
    return data;
  },
  getPublicForm: async (token: string): Promise<PublicAnamnesisForm> => {
    const { data } = await api.get<PublicAnamnesisForm>(`/public/anamnesis/${encodeURIComponent(token)}`);
    return data;
  },
  submitPublic: async (token: string, answers: Record<string, unknown>): Promise<void> => {
    await api.post(`/public/anamnesis/${encodeURIComponent(token)}`, { answers });
  },
};
