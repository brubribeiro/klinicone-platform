import { adminPath } from './adminPath';
import { appPath } from './appPath';

/** URL base do painel da clínica (`/painel` ou origem dedicada). */
export function clinicPanelUrl(path = '/'): string {
  const explicit = import.meta.env.VITE_CLINIC_APP_URL?.replace(/\/$/, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (explicit) return `${explicit}${normalized}`;
  return appPath(normalized);
}

/** URL base do console super-admin (app separado ou rotas legadas no painel). */
export function adminConsoleUrl(path = '/'): string {
  const explicit = import.meta.env.VITE_ADMIN_CONSOLE_URL?.replace(/\/$/, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (explicit) return `${explicit}${normalized}`;
  return adminPath(normalized);
}
