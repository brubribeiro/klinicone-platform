import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ColorModeProvider } from '../../../frontend/src/contexts/ColorModeContext';

import { AdminPanelRoot } from './AdminPanelRoot';

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
        <AdminPanelRoot />
      </QueryClientProvider>
    </ColorModeProvider>
  </React.StrictMode>,
);
