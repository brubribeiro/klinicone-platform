import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { ColorModeProvider } from '../../../frontend/src/contexts/ColorModeContext';
import { PrivacyPolicy } from '../../../frontend/src/pages/PrivacyPolicy';
import { TermsOfUse } from '../../../frontend/src/pages/TermsOfUse';
import { Landing } from './pages/Landing';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ColorModeProvider>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route
              path="/termos"
              element={<TermsOfUse backTo="/" backLabel="Voltar ao site" />}
            />
            <Route
              path="/privacidade"
              element={<PrivacyPolicy backTo="/" backLabel="Voltar ao site" />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ColorModeProvider>
  </React.StrictMode>,
);
