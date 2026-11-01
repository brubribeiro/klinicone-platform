import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { ExternalRedirect } from './ExternalRedirect';
import { adminConsoleUrl } from '../utils/appUrls';

/** Área da clínica: exige login; o super-admin só entra pelo "Entrar como" do painel. */
export function PrivateRoute({ children }: { children: ReactNode }) {
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
  // Super-admin no painel da plataforma (sem clínica na sessão)
  if (user.isSuperAdmin && !user.tenantId) {
    return <ExternalRedirect href={adminConsoleUrl('/clinicas')} />;
  }
  return <>{children}</>;
}
