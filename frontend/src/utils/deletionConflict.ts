/** Espelha `backend/src/common/deletion/deletion-dependencies.ts`. */
export const DELETION_CONFLICT_CODE = 'DELETE_HAS_DEPENDENCIES';

export interface DeletionDependency {
  type: string;
  label: string;
  count: number;
  names: string[];
  /** true: o vínculo é desfeito sem apagar o registro dependente. */
  unlinkable: boolean;
  note: string;
}

export interface DeletionConflict {
  code: typeof DELETION_CONFLICT_CODE;
  message: string;
  canUnlink: boolean;
  dependencies: DeletionDependency[];
}

/** Opções aceitas pelas funções `remove` da API que suportam desvincular. */
export type RemoveOptions = { unlink?: boolean };

/** Retorna o 409 de vínculos de uma resposta de erro do axios, ou null. */
export function getDeletionConflict(err: unknown): DeletionConflict | null {
  const res = (err as { response?: { status?: number; data?: unknown } } | null)?.response;
  const data = res?.data as Partial<DeletionConflict> | undefined;
  if (res?.status !== 409 || data?.code !== DELETION_CONFLICT_CODE) return null;
  if (!Array.isArray(data.dependencies)) return null;
  return {
    code: DELETION_CONFLICT_CODE,
    message: data.message ?? '',
    canUnlink: !!data.canUnlink,
    dependencies: data.dependencies,
  };
}
