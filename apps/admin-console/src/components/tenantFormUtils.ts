import type { TenantProfilePayload } from '../api/admin';
import type { AdminTenantProfile } from '../../../../frontend/src/types';
import { dateInputValueFromApi, dateOnlyToApiIso } from '../../../../frontend/src/utils/dateOnly';

export interface TenantProfileFormValues {
  specialties: string[];
  foundedAt: string;
  legalName: string;
  document: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  notes: string;
}

export const emptyTenantProfileForm: TenantProfileFormValues = {
  specialties: [],
  foundedAt: '',
  legalName: '',
  document: '',
  phone: '',
  email: '',
  city: '',
  state: '',
  notes: '',
};

export function tenantProfileFormFromTenant(
  tenant: Partial<AdminTenantProfile> | null | undefined,
): TenantProfileFormValues {
  if (!tenant) return { ...emptyTenantProfileForm };
  return {
    specialties: Array.isArray(tenant.specialties) ? [...tenant.specialties] : [],
    foundedAt: dateInputValueFromApi(tenant.foundedAt),
    legalName: tenant.legalName ?? '',
    document: tenant.document ?? '',
    phone: tenant.phone ?? '',
    email: tenant.email ?? '',
    city: tenant.city ?? '',
    state: tenant.state ?? '',
    notes: tenant.notes ?? '',
  };
}

export function buildTenantProfilePayload(
  values: TenantProfileFormValues,
  isEdit: boolean,
): TenantProfilePayload {
  const empty = (raw: string) => {
    const t = raw.trim();
    if (t) return t;
    return isEdit ? null : undefined;
  };
  const docDigits = values.document.replace(/\D/g, '');
  return {
    specialties: isEdit
      ? values.specialties.length
        ? values.specialties
        : null
      : values.specialties.length
        ? values.specialties
        : undefined,
    foundedAt: values.foundedAt ? dateOnlyToApiIso(values.foundedAt) : isEdit ? null : undefined,
    legalName: empty(values.legalName),
    document: docDigits ? docDigits : isEdit ? null : undefined,
    phone: empty(values.phone),
    email: values.email.trim()
      ? values.email.trim().toLowerCase()
      : isEdit
        ? null
        : undefined,
    city: empty(values.city),
    state: values.state.trim()
      ? values.state.trim().toUpperCase()
      : isEdit
        ? null
        : undefined,
    notes: empty(values.notes),
  };
}
