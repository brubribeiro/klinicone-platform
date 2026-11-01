import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { apiDevProxy } from '../../scripts/vite-api-proxy';

const repoRoot = path.resolve(__dirname, '../..');

/** Site público na raiz — versão independente do painel da clínica (`VERSION` na raiz). */
export default defineConfig({
  base: '/',
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
