/** Ambiente lógico do front: `dev` (local/staging) ou `prod`. */

export type AppEnvName = 'dev' | 'prod';

/**
 * Prefere `VITE_APP_ENV` (development|dev|staging → dev; production|prod → prod).
 * Sem variável, usa o modo do Vite (`import.meta.env.PROD`).
 * Em preview/staging na Vercel, defina `VITE_APP_ENV=dev`.
 */
export function getAppEnv(): AppEnvName {
  const raw = (import.meta.env.VITE_APP_ENV ?? '').trim().toLowerCase();
  if (raw === 'prod' || raw === 'production') return 'prod';
  if (raw === 'dev' || raw === 'development' || raw === 'staging') return 'dev';
  return import.meta.env.PROD ? 'prod' : 'dev';
}

export function isDevEnvironment(): boolean {
  return getAppEnv() === 'dev';
}
