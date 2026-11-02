import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';

import { useAuth } from '../contexts/AuthContext';

/**
 * Área /admin: só o super-admin, e só fora de uma clínica (durante o "Entrar como"
 * ele volta pelo botão da faixa). Usuário de clínica é mandado para o app da clínica.
 */
export function SuperAdminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.panelSelectionPending) return <Navigate to="/escolher-painel" replace />;
  if (!user.isSuperAdmin || user.tenantId) return <Navigate to="/" replace />;
  return <>{children}</>;
}
