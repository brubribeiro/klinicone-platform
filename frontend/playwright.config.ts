import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke E2E do painel da clínica: `npm run test:e2e` (frontend/).
 * Sobe backend (3333) e painel (build + preview, 5173) se ainda não estiverem rodando; exige Postgres com
 * migrations (DATABASE_URL do backend) e o mesmo JWT_SECRET no backend e no global-setup.
 * Ver e2e/README.md.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.e2e\.ts$/,
  timeout: 40_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL,
    storageState: './e2e/.auth/state.json',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        // Opcional: Chromium já instalado na máquina em vez do baixado por `playwright install`
        launchOptions: {
          args: ['--disable-dev-shm-usage'],
          ...(process.env.PW_CHROMIUM_PATH
            ? { executablePath: process.env.PW_CHROMIUM_PATH, chromiumSandbox: false }
            : {}),
        },
      },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: 'npx nest start',
          cwd: '../backend',
          url: 'http://localhost:3333/api/health',
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
        {
          // build + preview (com o mesmo proxy /api): no dev server a compilação sob demanda
          // deixava a modal aberta por vários segundos depois de salvar
          command: 'npx vite build && npx vite preview --port 5173 --strictPort',
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
      ],
});
