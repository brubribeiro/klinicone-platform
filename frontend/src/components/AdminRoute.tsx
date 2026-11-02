import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Alert, Box } from '@mui/material';

import { usePermissions } from '../contexts/usePermissions';

interface AdminRouteProps {
  children: ReactNode;
  fallback?: string;
}

/** Rotas exclusivas do administrador da clínica (grupo Administrador). */
export function AdminRoute({ children, fallback = '/' }: AdminRouteProps) {
  const { isAdmin, permissions } = usePermissions();
  if (permissions.length === 0) return <Navigate to="/login" replace />;
  if (!isAdmin) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
        <Alert severity="warning">Apenas administradores da clínica podem acessar esta página.</Alert>
        <Navigate to={fallback} replace />
      </Box>
    );
  }
  return <>{children}</>;
}
