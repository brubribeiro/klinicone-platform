import { api } from '../../../../frontend/src/api/client';
import type {
  ApiObservability,
  AdminFeedbackReport,
  AdminPlan,
  AdminTenant,
  AdminTenantDetail,
  MeasurementType,
  PlanLimits,
  PlatformAnnouncement,
  AnnouncementKind,
  PlatformAuditLog,
  PlatformCatalogItem,
  PlatformCatalogKind,
  PlatformUsage,
  FeedbackStatus,
  FeedbackType,
} from '../../../../frontend/src/types';

export type TenantStatusFilter = 'active' | 'suspended';

export interface TenantProfilePayload {
  specialties?: string[] | null;
  foundedAt?: string | null;
  legalName?: string | null;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  notes?: string | null;
}

export interface CreateTenantPayload extends TenantProfilePayload {
  name: string;
  slug?: string;
  adminName: string;
  adminEmail: string;
  planId?: string;
}

export interface UpdateTenantPayload extends TenantProfilePayload {
  name?: string;
  slug?: string;
  /** null remove o plano */
  planId?: string | null;
  featuresExtra?: string[] | null;
  featuresDenied?: string[] | null;
}

export interface PlanPayload {
  name: string;
  slug?: string;
  description?: string | null;
  priceCents?: number | null;
  currency?: string;
  features?: string[] | null;
  limits?: PlanLimits | null;
}

export interface CatalogItemPayload {
  kind: PlatformCatalogKind;
  value: string;
  label: string;
  sortOrder?: number;
  meta?: Record<string, unknown> | null;
  active?: boolean;
}

export interface AnnouncementPayload {
  title: string;
  body: string;
  kind: AnnouncementKind;
}

export interface DraftFromReleaseResult {
  version: string;
  created: PlatformAnnouncement[];
  skipped: AnnouncementKind[];
}

export interface PlatformAuditPage {
  data: PlatformAuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminFeedbackQuery {
  tenantId?: string;
  type?: FeedbackType;
  status?: FeedbackStatus;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface AdminFeedbackPage {
  data: AdminFeedbackReport[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  /** Por status, com os demais filtros aplicados. */
  counts: Record<FeedbackStatus, number>;
}

/** Painel do super-admin (rotas /admin, só para isSuperAdmin). */
export const adminApi = {
  listTenants: async (params: { search?: string; status?: TenantStatusFilter } = {}): Promise<AdminTenant[]> => {
    const { data } = await api.get<AdminTenant[]>('/admin/tenants', { params });
    return data;
  },

  getTenant: async (id: string): Promise<AdminTenantDetail> => {
    const { data } = await api.get<AdminTenantDetail>(`/admin/tenants/${id}`);
    return data;
  },

  createTenant: async (payload: CreateTenantPayload): Promise<AdminTenant> => {
    const { data } = await api.post<AdminTenant>('/admin/tenants', payload);
    return data;
  },

  updateTenant: async (id: string, payload: UpdateTenantPayload): Promise<AdminTenant> => {
    const { data } = await api.patch<AdminTenant>(`/admin/tenants/${id}`, payload);
    return data;
  },

  suspendTenant: async (id: string, reason?: string): Promise<AdminTenant> => {
    const { data } = await api.post<AdminTenant>(`/admin/tenants/${id}/suspend`, { reason });
    return data;
  },

  reactivateTenant: async (id: string): Promise<AdminTenant> => {
    const { data } = await api.post<AdminTenant>(`/admin/tenants/${id}/reactivate`);
    return data;
  },

  enterTenant: async (id: string): Promise<{ access_token: string }> => {
    const { data } = await api.post<{ access_token: string }>(`/admin/tenants/${id}/enter`);
    return data;
  },

  listAudit: async (params: { tenantId?: string; page?: number; limit?: number } = {}): Promise<PlatformAuditPage> => {
    const { data } = await api.get<PlatformAuditPage>('/admin/audit', { params });
    return data;
  },

  listPlans: async (): Promise<AdminPlan[]> => {
    const { data } = await api.get<AdminPlan[]>('/admin/plans');
    return data;
  },

  createPlan: async (payload: PlanPayload): Promise<AdminPlan> => {
    const { data } = await api.post<AdminPlan>('/admin/plans', payload);
    return data;
  },

  updatePlan: async (id: string, payload: Partial<PlanPayload>): Promise<AdminPlan> => {
    const { data } = await api.patch<AdminPlan>(`/admin/plans/${id}`, payload);
    return data;
  },

  setPlanActive: async (id: string, active: boolean): Promise<AdminPlan> => {
    const { data } = await api.post<AdminPlan>(`/admin/plans/${id}/${active ? 'activate' : 'deactivate'}`);
    return data;
  },

  listCatalogs: async (kind?: PlatformCatalogKind): Promise<PlatformCatalogItem[]> => {
    const { data } = await api.get<PlatformCatalogItem[]>('/admin/catalogs', {
      params: kind ? { kind } : undefined,
    });
    return data;
  },

  createCatalogItem: async (payload: CatalogItemPayload): Promise<PlatformCatalogItem> => {
    const { data } = await api.post<PlatformCatalogItem>('/admin/catalogs', payload);
    return data;
  },

  updateCatalogItem: async (
    id: string,
    payload: Partial<Omit<CatalogItemPayload, 'kind'>>,
  ): Promise<PlatformCatalogItem> => {
    const { data } = await api.patch<PlatformCatalogItem>(`/admin/catalogs/${id}`, payload);
    return data;
  },

  setCatalogItemActive: async (id: string, active: boolean): Promise<PlatformCatalogItem> => {
    const { data } = await api.post<PlatformCatalogItem>(
      `/admin/catalogs/${id}/${active ? 'activate' : 'deactivate'}`,
    );
    return data;
  },

  listMeasurementTypes: async (): Promise<MeasurementType[]> => {
    const { data } = await api.get<MeasurementType[]>('/admin/measurement-types');
    return data;
  },

  createMeasurementType: async (payload: { name: string; unit: string }): Promise<MeasurementType> => {
    const { data } = await api.post<MeasurementType>('/admin/measurement-types', payload);
    return data;
  },

  updateMeasurementType: async (id: string, payload: { name?: string; unit?: string }): Promise<MeasurementType> => {
    const { data } = await api.patch<MeasurementType>(`/admin/measurement-types/${id}`, payload);
    return data;
  },

  reorderMeasurementTypes: async (ids: string[]): Promise<MeasurementType[]> => {
    const { data } = await api.put<MeasurementType[]>('/admin/measurement-types/order', { ids });
    return data;
  },

  setMeasurementTypeActive: async (id: string, active: boolean): Promise<MeasurementType> => {
    const { data } = await api.post<MeasurementType>(
      `/admin/measurement-types/${id}/${active ? 'activate' : 'deactivate'}`,
    );
    return data;
  },

  removeMeasurementType: async (id: string): Promise<void> => {
    await api.delete(`/admin/measurement-types/${id}`);
  },

  getUsage: async (params: { from?: string; to?: string; tenantId?: string } = {}): Promise<PlatformUsage> => {
    const { data } = await api.get<PlatformUsage>('/admin/usage', { params });
    return data;
  },

  getObservability: async (params: { hours?: number } = {}): Promise<ApiObservability> => {
    const { data } = await api.get<ApiObservability>('/admin/observability', { params });
    return data;
  },

  listFeedback: async (params: AdminFeedbackQuery = {}): Promise<AdminFeedbackPage> => {
    const { data } = await api.get<AdminFeedbackPage>('/admin/feedback', { params });
    return data;
  },

  getFeedback: async (id: string): Promise<AdminFeedbackReport> => {
    const { data } = await api.get<AdminFeedbackReport>(`/admin/feedback/${id}`);
    return data;
  },

  setFeedbackStatus: async (id: string, status: FeedbackStatus): Promise<AdminFeedbackReport> => {
    const { data } = await api.patch<AdminFeedbackReport>(`/admin/feedback/${id}/status`, { status });
    return data;
  },

  listAnnouncements: async (): Promise<PlatformAnnouncement[]> => {
    const { data } = await api.get<PlatformAnnouncement[]>('/admin/announcements');
    return data;
  },

  getAnnouncementAudience: async (): Promise<{ users: number; tenants: number }> => {
    const { data } = await api.get<{ users: number; tenants: number }>('/admin/announcements/audience');
    return data;
  },

  createAnnouncement: async (payload: AnnouncementPayload): Promise<PlatformAnnouncement> => {
    const { data } = await api.post<PlatformAnnouncement>('/admin/announcements', payload);
    return data;
  },

  updateAnnouncement: async (id: string, payload: Partial<AnnouncementPayload>): Promise<PlatformAnnouncement> => {
    const { data } = await api.patch<PlatformAnnouncement>(`/admin/announcements/${id}`, payload);
    return data;
  },

  deleteAnnouncement: async (id: string): Promise<void> => {
    await api.delete(`/admin/announcements/${id}`);
  },

  draftAnnouncementsFromRelease: async (): Promise<DraftFromReleaseResult> => {
    const { data } = await api.post<DraftFromReleaseResult>('/admin/announcements/draft-from-release');
    return data;
  },

  sendAnnouncement: async (id: string): Promise<PlatformAnnouncement> => {
    const { data } = await api.post<PlatformAnnouncement>(`/admin/announcements/${id}/send`);
    return data;
  },

  scheduleAnnouncement: async (id: string, scheduledAt: string): Promise<PlatformAnnouncement> => {
    const { data } = await api.post<PlatformAnnouncement>(`/admin/announcements/${id}/schedule`, { scheduledAt });
    return data;
  },

  unscheduleAnnouncement: async (id: string): Promise<PlatformAnnouncement> => {
    const { data } = await api.post<PlatformAnnouncement>(`/admin/announcements/${id}/unschedule`);
    return data;
  },
};
