import { readFileSync } from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { apiDevProxy } from '../../scripts/vite-api-proxy';

const repoRoot = path.resolve(__dirname, '../..');
const appVersion = readFileSync(path.resolve(__dirname, 'VERSION'), 'utf8').trim();

/** Site público na raiz — versão própria (`apps/landing/VERSION`), independente do painel da clínica (`VERSION` na raiz). */
export default defineConfig({
  base: '/',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: true,
    fs: { allow: [repoRoot] },
    ...apiDevProxy,
  },
  preview: {
    port: 5173,
    fs: { allow: [repoRoot] },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
