import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ColorModeProvider } from './contexts/ColorModeContext';
import { PanelRoot } from './PanelRoot';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

document.title = 'Mila Barreto - Plataforma';
const robots = document.createElement('meta');
robots.name = 'robots';
robots.content = 'noindex';
document.head.appendChild(robots);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ColorModeProvider>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <PanelRoot />
      </QueryClientProvider>
    </ColorModeProvider>
  </React.StrictMode>,
);
