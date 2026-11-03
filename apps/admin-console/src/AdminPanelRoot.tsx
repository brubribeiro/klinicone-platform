import { Box } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';

import { AuthProvider } from '../../../frontend/src/contexts/AuthContext';
import { AppDialogProvider } from '../../../frontend/src/contexts/AppDialogContext';
import { AppToastProvider } from '../../../frontend/src/contexts/AppToastContext';
import { DevEnvironmentBanner } from '../../../frontend/src/components/layout/DevEnvironmentBanner';
import { DEV_BAR_HEIGHT } from '../../../frontend/src/components/layout/layoutTheme';
import { isDevEnvironment } from '../../../frontend/src/utils/appEnv';

import AdminApp from './App';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

export function AdminPanelRoot() {
  const isDev = isDevEnvironment();
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <DevEnvironmentBanner />
      <Box sx={{ pt: isDev ? `${DEV_BAR_HEIGHT}px` : 0, minHeight: '100vh' }}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <AppDialogProvider>
              <AppToastProvider>
                <AdminApp />
              </AppToastProvider>
            </AppDialogProvider>
          </AuthProvider>
        </BrowserRouter>
      </Box>
    </GoogleOAuthProvider>
  );
}
