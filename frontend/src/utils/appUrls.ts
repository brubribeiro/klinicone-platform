import { adminPath } from './adminPath';
import { appPath } from './appPath';

function envUrl(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = (import.meta.env as Record<string, string | undefined>)[key]?.replace(/\/$/, '');
    if (value) return value;
  }
  return undefined;
}

/** URL base do painel da clínica (host dedicado `app.*` ou origem relativa). */
export function clinicPanelUrl(path = '/'): string {
  const explicit = envUrl('VITE_APP_URL', 'VITE_CLINIC_APP_URL');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (explicit) return `${explicit}${normalized}`;
  return appPath(normalized);
}

/** URL base do console super-admin (host `admin.*` ou rotas legadas no painel). */
export function adminConsoleUrl(path = '/'): string {
  const explicit = envUrl('VITE_ADMIN_URL', 'VITE_ADMIN_CONSOLE_URL');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (explicit) return `${explicit}${normalized}`;
  return adminPath(normalized);
}

/** URL base da landing pública (host apex / www). */
export function landingUrl(path = '/'): string {
  const explicit = envUrl('VITE_LANDING_URL');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (explicit) return `${explicit}${normalized}`;
  return normalized;
}
