/** Prefixo das rotas do console super-admin (`''` no app dedicado; `/admin` legado). */
const rawPrefix = import.meta.env.VITE_ADMIN_ROUTE_PREFIX;
export const ADMIN_ROUTE_PREFIX =
  rawPrefix === undefined || rawPrefix === null
    ? '/admin'
    : String(rawPrefix).replace(/\/$/, '');

export function adminPath(segment: string): string {
  const normalized = segment.startsWith('/') ? segment : `/${segment}`;
  if (!ADMIN_ROUTE_PREFIX) return normalized;
  return `${ADMIN_ROUTE_PREFIX}${normalized}`;
}
