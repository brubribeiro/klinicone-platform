/** Ambiente lógico da API: `dev` (local/staging) ou `prod`. */

export type AppEnvName = 'dev' | 'prod';

/**
 * Prefere `APP_ENV` (development|dev|staging → dev; production|prod → prod).
 * Sem `APP_ENV`, cai em `NODE_ENV === 'production' ? prod : dev`.
 * Em staging no Render, use `APP_ENV=development` com `NODE_ENV=production`.
 */
export function getAppEnv(env: NodeJS.ProcessEnv = process.env): AppEnvName {
  const raw = (env.APP_ENV ?? '').trim().toLowerCase();
  if (raw === 'prod' || raw === 'production') return 'prod';
  if (raw === 'dev' || raw === 'development' || raw === 'staging') return 'dev';
  return env.NODE_ENV === 'production' ? 'prod' : 'dev';
}

export function isProductionEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return getAppEnv(env) === 'prod';
}
