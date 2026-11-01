import { readFileSync } from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { apiDevProxy } from '../../scripts/vite-api-proxy';

const repoRoot = path.resolve(__dirname, '../..');
const appVersion = readFileSync(path.resolve(__dirname, 'VERSION'), 'utf8').trim();

/** Console super-admin — deploy e versão (`apps/admin-console/VERSION`) independentes do painel da clínica. */
export default defineConfig({
  base: '/',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    'import.meta.env.VITE_ADMIN_ROUTE_PREFIX': JSON.stringify(''),
  },
  plugins: [react()],
  server: {
    port: 5175,
    allowedHosts: true,
    fs: { allow: [repoRoot] },
    ...apiDevProxy,
  },
  preview: {
    port: 5175,
    fs: { allow: [repoRoot] },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
