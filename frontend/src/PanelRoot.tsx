import { Box } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';

import App from './App';
import { DevEnvironmentBanner } from './components/layout/DevEnvironmentBanner';
import { DEV_BAR_HEIGHT } from './components/layout/layoutTheme';
import { AuthProvider } from './contexts/AuthContext';
import { AppDialogProvider } from './contexts/AppDialogContext';
import { AppToastProvider } from './contexts/AppToastContext';
import { AppointmentDialogProvider } from './contexts/AppointmentDialogContext';
import { isDevEnvironment } from './utils/appEnv';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

/** App logado da clínica — raiz do host `app.*` (deploy separado da landing e do admin). */
export function PanelRoot() {
  const isDev = isDevEnvironment();
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <DevEnvironmentBanner />
      <Box sx={{ pt: isDev ? `${DEV_BAR_HEIGHT}px` : 0, minHeight: '100vh' }}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <AppDialogProvider>
              <AppToastProvider>
                <AppointmentDialogProvider>
                  <App />
                </AppointmentDialogProvider>
              </AppToastProvider>
            </AppDialogProvider>
          </AuthProvider>
        </BrowserRouter>
      </Box>
    </GoogleOAuthProvider>
  );
}
