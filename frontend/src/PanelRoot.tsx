import { BrowserRouter } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';

import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { AppDialogProvider } from './contexts/AppDialogContext';
import { AppToastProvider } from './contexts/AppToastContext';
import { AppointmentDialogProvider } from './contexts/AppointmentDialogContext';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

/** App logado da clínica — raiz do host `app.*` (deploy separado da landing e do admin). */
export function PanelRoot() {
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
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
    </GoogleOAuthProvider>
  );
}
