/// <reference types="vitest" />
import { readFileSync } from 'fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

import { apiDevProxy } from '../scripts/vite-api-proxy';

const appVersion = readFileSync(path.resolve(__dirname, '../VERSION'), 'utf8').trim();

/** Painel da clínica — servido em `/painel` (deploy separado da landing e do console admin). */
export default defineConfig({
  base: '/painel',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: false,
  },
  server: {
    port: 5174,
    allowedHosts: true,
    hmr: {
      host: 'localhost',
      protocol: 'ws',
    },
    ...apiDevProxy,
  },
});
