/// <reference types="vitest" />
import { readFileSync } from 'fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

import { apiDevProxy } from '../scripts/vite-api-proxy';

const appVersion = readFileSync(path.resolve(__dirname, '../VERSION'), 'utf8').trim();

/** Painel da clínica — raiz do host `app.*` (deploy separado da landing e do console admin). */
export default defineConfig({
  base: '/',
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
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/**/*.d.ts', 'src/main.tsx', 'src/types/**'],
      reporter: ['text-summary', 'json-summary', 'lcov'],
      // Piso = cobertura medida, arredondada para baixo. Meta: 80%; subir por etapas (cada PR que cobre um bloco de telas sobe o piso).
      thresholds: { statements: 36, branches: 80, functions: 64, lines: 36 },
    },
  },
  server: {
    port: 5173,
    allowedHosts: true,
    hmr: {
      host: 'localhost',
      protocol: 'ws',
    },
    ...apiDevProxy,
  },
});
