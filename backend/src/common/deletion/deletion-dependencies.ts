import { ConflictException } from '@nestjs/common';

/** Código no corpo do 409 para o front reconhecer o diálogo de vínculos. */
export const DELETION_CONFLICT_CODE = 'DELETE_HAS_DEPENDENCIES';

/** Quantos nomes de exemplo vão na resposta por tipo de vínculo. */
export const DEPENDENCY_SAMPLE_SIZE = 10;

export interface DeletionDependency {
  /** Identificador estável do vínculo (ex.: `procedures`, `appointments`). */
  type: string;
  /** Rótulo para o usuário (ex.: "Procedimentos"). */
  label: string;
  count: number;
  /** Até DEPENDENCY_SAMPLE_SIZE nomes, sem repetição, em ordem alfabética. */
  names: string[];
  /** true: dá para desfazer o vínculo sem apagar o registro dependente. */
  unlinkable: boolean;
  /** O que acontece ao desvincular ou, se bloqueia, por quê. */
  note: string;
}

export interface DeletionConflictBody {
  statusCode: 409;
  error: 'Conflict';
  code: typeof DELETION_CONFLICT_CODE;
  message: string;
  canUnlink: boolean;
  dependencies: DeletionDependency[];
}

export class DeletionConflictException extends ConflictException {
  constructor(message: string, dependencies: DeletionDependency[], canUnlink: boolean) {
    const body: DeletionConflictBody = {
      statusCode: 409,
      error: 'Conflict',
      code: DELETION_CONFLICT_CODE,
      message,
      canUnlink,
      dependencies,
    };
    super(body);
  }
}

export function dependency(input: {
  type: string;
  label: string;
  count: number;
  names?: (string | null | undefined)[];
  unlinkable: boolean;
  note: string;
}): DeletionDependency {
  const names = [...new Set((input.names ?? []).filter((n): n is string => !!n?.trim()))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .slice(0, DEPENDENCY_SAMPLE_SIZE);
  return { ...input, names };
}

function summarize(deps: DeletionDependency[]): string {
  return deps.map((d) => `${d.label} (${d.count})`).join(', ');
}

/**
 * Decide se a exclusão pode seguir.
 * - Sem vínculos: segue.
 * - Algum vínculo que não dá para desfazer: 409 com `canUnlink: false`.
 * - Só vínculos desfazíveis e `unlink` falso: 409 com `canUnlink: true`
 *   (o front oferece "Desvincular e excluir").
 * Devolve os vínculos presentes para o service desfazê-los na transação.
 */
export function assertDeletable(
  subject: string,
  deps: DeletionDependency[],
  options: { unlink: boolean; blockedHint?: string },
): DeletionDependency[] {
  const present = deps.filter((d) => d.count > 0);
  if (present.length === 0) return present;

  const blocking = present.filter((d) => !d.unlinkable);
  if (blocking.length > 0) {
    const hint = options.blockedHint ? ` ${options.blockedHint}` : '';
    throw new DeletionConflictException(
      `Não é possível excluir ${subject}: há vínculos que não podem ser desfeitos — ${summarize(blocking)}.${hint}`,
      present,
      false,
    );
  }

  if (!options.unlink) {
    throw new DeletionConflictException(
      `Para excluir ${subject}, é preciso desfazer os vínculos: ${summarize(present)}.`,
      present,
      true,
    );
  }

  return present;
}

/** `?unlink=true` (ou `1`) na rota DELETE. */
export function parseUnlinkFlag(value: unknown): boolean {
  return value === true || value === 'true' || value === '1';
}
