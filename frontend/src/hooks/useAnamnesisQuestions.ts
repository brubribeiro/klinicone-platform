import { useQuery } from '@tanstack/react-query';

import { anamnesisApi } from '../api/anamnesis';
import type { AnamnesisKind } from '../types';

/** Perguntas cadastradas da clínica (ativas e inativas), na ordem do formulário. */
export function useAnamnesisQuestions(kind: AnamnesisKind, enabled = true) {
  return useQuery({
    queryKey: ['anamnesis-questions', kind],
    queryFn: () => anamnesisApi.listQuestions(kind),
    staleTime: 5 * 60_000,
    enabled,
  });
}
