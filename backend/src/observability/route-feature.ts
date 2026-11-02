import { isPlatformFeature, type PlatformFeature } from '../common/platform-features';

/** Prefixos de rota com nome diferente da chave do módulo no catálogo. */
const ROUTE_PREFIX_FEATURE: Record<string, PlatformFeature> = {
  skincare: 'routines',
  'document-templates': 'documents',
};

/** Módulo do catálogo dono da rota (/api/recurring-expenses/:id → recurring_expenses); null = rota da plataforma. */
export function featureFromRoute(route: string): PlatformFeature | null {
  const segment = route.replace(/^\/?api\//, '').split('/')[0] ?? '';
  const mapped = ROUTE_PREFIX_FEATURE[segment];
  if (mapped) return mapped;
  const key = segment.replace(/-/g, '_');
  return isPlatformFeature(key) ? key : null;
}
