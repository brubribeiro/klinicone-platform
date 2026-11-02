import { api } from './client';
import type { MessageDispatch, MessageTemplate, MessageTrigger } from '../types';

export interface MessageTemplatePayload {
  name: string;
  category?: string | null;
  trigger?: MessageTrigger;
  active?: boolean;
  content: string;
  procedureId?: string | null;
}

export const messagesApi = {
  list: async (): Promise<MessageTemplate[]> => {
    const { data } = await api.get<MessageTemplate[]>('/messages');
    return data;
  },
  create: async (payload: MessageTemplatePayload): Promise<MessageTemplate> => {
    const { data } = await api.post<MessageTemplate>('/messages', payload);
    return data;
  },
  update: async (id: string, payload: Partial<MessageTemplatePayload>): Promise<MessageTemplate> => {
    const { data } = await api.patch<MessageTemplate>(`/messages/${id}`, payload);
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await api.delete(`/messages/${id}`);
  },
  listPendingDispatches: async (): Promise<MessageDispatch[]> => {
    const { data } = await api.get<MessageDispatch[]>('/messages/dispatches/pending');
    return data;
  },
  markDispatchSent: async (id: string): Promise<MessageDispatch> => {
    const { data } = await api.patch<MessageDispatch>(`/messages/dispatches/${id}/sent`);
    return data;
  },
  recordManualDispatch: async (payload: {
    templateId: string;
    patientId: string;
    appointmentId?: string | null;
    phone?: string | null;
    renderedMessage: string;
  }): Promise<MessageDispatch> => {
    const { data } = await api.post<MessageDispatch>('/messages/dispatches/manual', payload);
    return data;
  },
};
