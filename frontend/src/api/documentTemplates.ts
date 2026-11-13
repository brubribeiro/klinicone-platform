import { api } from './client';
import type { DocumentTemplate } from '../types';
import { deleteWithUnlink } from './deletion';
import type { RemoveOptions } from '../utils/deletionConflict';

export interface DocumentTemplatePayload {
  name: string;
  category?: string | null;
  content: string;
  active?: boolean;
}

export const documentTemplatesApi = {
  list: async (): Promise<DocumentTemplate[]> => {
    const { data } = await api.get<DocumentTemplate[]>('/document-templates');
    return data;
  },

  create: async (payload: DocumentTemplatePayload): Promise<DocumentTemplate> => {
    const { data } = await api.post<DocumentTemplate>('/document-templates', payload);
    return data;
  },

  update: async (id: string, payload: Partial<DocumentTemplatePayload>): Promise<DocumentTemplate> => {
    const { data } = await api.patch<DocumentTemplate>(`/document-templates/${id}`, payload);
    return data;
  },

  remove: async (id: string, options?: RemoveOptions): Promise<void> => {
    await deleteWithUnlink(`/document-templates/${id}`, options);
  },
};
