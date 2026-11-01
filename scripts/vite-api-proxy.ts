import type { UserConfig } from 'vite';

/** Proxy `/api` → Nest local (compartilhado entre apps Vite). */
export const apiDevProxy: UserConfig['server'] = {
  proxy: {
    '/api': {
      target: 'http://localhost:3333',
      changeOrigin: true,
      secure: false,
    },
  },
};
