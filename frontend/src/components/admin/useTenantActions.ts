import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/admin';
import { useAuth } from '../../contexts/AuthContext';
import { useAppDialog } from '../../contexts/AppDialogContext';
import { useAppToast } from '../../contexts/AppToastContext';
import { clinicPanelUrl } from '../../utils/appUrls';
import { getApiErrorMessage } from '../../utils/apiError';
import type { AdminTenant } from '../../types';

type TenantRef = Pick<AdminTenant, 'id' | 'name' | 'active'>;

/** Suspender, reativar e "Entrar como" uma clínica, sempre com confirmação. */
export function useTenantActions() {
  const queryClient = useQueryClient();
  const { enterTenant } = useAuth();
  const { confirm } = useAppDialog();
  const toast = useAppToast();

  const refresh = (id: string) => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'tenants'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'tenant', id] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
  };

  const statusMutation = useMutation({
    mutationFn: ({ tenant, active }: { tenant: TenantRef; active: boolean }) =>
      active ? adminApi.reactivateTenant(tenant.id) : adminApi.suspendTenant(tenant.id),
    onSuccess: (_data, { tenant, active }) => {
      refresh(tenant.id);
      toast.success(active ? `${tenant.name} reativada.` : `${tenant.name} suspensa.`);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível alterar o status da clínica.')),
  });

  const enterMutation = useMutation({
    mutationFn: (tenant: TenantRef) => enterTenant(tenant.id),
    onSuccess: () => {
      window.location.href = clinicPanelUrl('/');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível entrar na clínica.')),
  });

  const suspend = async (tenant: TenantRef) => {
    const ok = await confirm({
      title: 'Suspender clínica',
      message: `Suspender ${tenant.name}?`,
      details: [
        'Os usuários da clínica perdem o acesso na hora, inclusive quem estiver logado.',
        'Ao tentar entrar, eles veem o aviso de clínica suspensa.',
        'Nenhum dado é apagado; dá para reativar quando quiser.',
      ],
      confirmLabel: 'Suspender',
      confirmColor: 'error',
    });
    if (ok) statusMutation.mutate({ tenant, active: false });
  };

  const reactivate = async (tenant: TenantRef) => {
    const ok = await confirm({
      title: 'Reativar clínica',
      message: `Reativar ${tenant.name}? Os usuários dela voltam a conseguir entrar.`,
      confirmLabel: 'Reativar',
    });
    if (ok) statusMutation.mutate({ tenant, active: true });
  };

  const enter = async (tenant: TenantRef) => {
    const ok = await confirm({
      title: 'Entrar como a clínica',
      message: `Entrar em ${tenant.name} como administrador?`,
      details: [
        'Você verá e poderá alterar os dados da clínica.',
        'A entrada fica registrada na auditoria da plataforma.',
        ...(tenant.active ? [] : ['A clínica está suspensa: os usuários dela continuam sem acesso.']),
      ],
      confirmLabel: 'Entrar',
    });
    if (ok) enterMutation.mutate(tenant);
  };

  return {
    suspend,
    reactivate,
    enter,
    pending: statusMutation.isPending || enterMutation.isPending,
  };
}
