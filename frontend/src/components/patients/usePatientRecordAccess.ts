import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/usePermissions';

/** Abas Documentos/Financeiro da ficha: dependem do módulo do plano e da permissão de leitura. */
export function usePatientRecordAccess() {
  const { user } = useAuth();
  const { has } = usePermissions();
  const features = user?.features ?? [];
  return {
    showDocuments: features.includes('documents') && has('documents:view'),
    showFinance: features.includes('finance') && has('finance:view'),
  };
}
