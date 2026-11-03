import { isProductionEnv } from '../src/common/app-env';

/**
 * Recusa rodar em produção (APP_ENV/NODE_ENV).
 * Banco remoto só com APP_ENV explícito development|dev|staging (ex.: Supabase de staging).
 * Nunca faz parte do start de produção (render.yaml / start:prod).
 */
export function assertLocalEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  if (isProductionEnv(env)) {
    throw new Error('Seed demo recusado: ambiente de produção (APP_ENV/NODE_ENV).');
  }
  const appEnv = (env.APP_ENV ?? '').trim().toLowerCase();
  const allowRemote = ['development', 'dev', 'staging'].includes(appEnv);
  for (const key of ['DATABASE_URL', 'DIRECT_URL'] as const) {
    const url = env[key];
    if (!url) {
      if (key === 'DATABASE_URL') throw new Error('Seed demo recusado: DATABASE_URL não definida.');
      continue;
    }
    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      throw new Error(`Seed demo recusado: ${key} inválida.`);
    }
    if (allowRemote) continue;
    if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(host)) {
      throw new Error(
        `Seed demo recusado: ${key} aponta para "${host}", não para localhost. Defina APP_ENV=development (ou staging) para banco remoto de não-produção.`,
      );
    }
  }
}
