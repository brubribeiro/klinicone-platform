import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { apiDevProxy } from '../../scripts/vite-api-proxy';

const repoRoot = path.resolve(__dirname, '../..');

/** Console super-admin — deploy e versão (`package.json`) independentes do painel da clínica. */
export default defineConfig({
  base: '/',
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
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
