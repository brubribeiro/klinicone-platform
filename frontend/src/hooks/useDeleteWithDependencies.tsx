import { useCallback } from 'react';
import { useAppDialog } from '../contexts/AppDialogContext';
import { useAppToast } from '../contexts/AppToastContext';
import { DeletionDependenciesList } from '../components/DeletionDependenciesList';
import { getApiErrorMessage } from '../utils/apiError';
import { getDeletionConflict, type RemoveOptions } from '../utils/deletionConflict';

export type DeleteWithDependenciesOptions = {
  /** Título dos diálogos (ex.: "Excluir equipamento"). */
  title: string;
  /** Pergunta inicial (ex.: `Excluir "Laser X"?`). */
  message: string;
  remove: (options: RemoveOptions) => Promise<unknown>;
  successMessage: string;
  errorMessage: string;
  onDeleted?: () => void;
};

/**
 * Exclusão padrão com vínculos: confirma, tenta excluir e, se a API responder 409 com
 * os vínculos, mostra a lista e oferece "Desvincular e excluir" (ou explica o bloqueio).
 * Resolve `true` quando o registro foi excluído.
 */
export function useDeleteWithDependencies() {
  const { confirm } = useAppDialog();
  const toast = useAppToast();

  return useCallback(
    async (opts: DeleteWithDependenciesOptions): Promise<boolean> => {
      const ok = await confirm({
        title: opts.title,
        message: `${opts.message} Esta ação não pode ser desfeita.`,
        confirmLabel: 'Excluir',
        confirmColor: 'error',
      });
      if (!ok) return false;

      const finish = () => {
        toast.success(opts.successMessage);
        opts.onDeleted?.();
        return true;
      };

      try {
        await opts.remove({});
        return finish();
      } catch (err) {
        const conflict = getDeletionConflict(err);
        if (!conflict) {
          toast.error(getApiErrorMessage(err, opts.errorMessage));
          return false;
        }

        const unlink = await confirm({
          title: opts.title,
          subtitle: conflict.canUnlink ? 'Há registros atrelados' : undefined,
          message: conflict.canUnlink
            ? 'Os registros abaixo estão atrelados. Ao desvincular, eles continuam salvos e só perdem a ligação; depois a exclusão é feita.'
            : conflict.message,
          content: <DeletionDependenciesList dependencies={conflict.dependencies} />,
          confirmLabel: 'Desvincular e excluir',
          confirmColor: 'error',
          disableConfirm: !conflict.canUnlink,
          blockedMessage: 'Alguns vínculos fazem parte do histórico e não podem ser desfeitos.',
        });
        if (!unlink) return false;

        try {
          await opts.remove({ unlink: true });
          return finish();
        } catch (err2) {
          toast.error(getApiErrorMessage(err2, opts.errorMessage));
          return false;
        }
      }
    },
    [confirm, toast],
  );
}
