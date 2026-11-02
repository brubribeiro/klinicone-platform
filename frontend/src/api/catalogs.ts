import { api } from './client';
import type { MeasurementType, PlatformCatalogKind, PlatformCatalogOption } from '../types';

/** Catálogo global da plataforma (leitura no app da clínica; só itens ativos). */
export const catalogsApi = {
  list: async (kind?: PlatformCatalogKind): Promise<PlatformCatalogOption[]> => {
    const { data } = await api.get<PlatformCatalogOption[]>('/catalogs', {
      params: kind ? { kind } : undefined,
    });
    return data;
  },
  /** Tipos de medida corporal ativos (card "Medidas corporais"). */
  measurementTypes: async (): Promise<MeasurementType[]> => {
    const { data } = await api.get<MeasurementType[]>('/measurement-types');
    return data;
  },
};
