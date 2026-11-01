import { api } from './client';

export interface AssistantSource {
  file: string;
  section: string;
  excerpt: string;
}

export interface AssistantAnswer {
  /** false quando a documentação não cobre a pergunta (sem fontes). */
  covered: boolean;
  answer: string;
  sources: AssistantSource[];
}

export const assistantApi = {
  ask: async (question: string): Promise<AssistantAnswer> => {
    const { data } = await api.post<AssistantAnswer>('/assistant/ask', { question });
    return data;
  },
};
