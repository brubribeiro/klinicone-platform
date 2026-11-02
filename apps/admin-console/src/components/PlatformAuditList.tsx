import { Link as RouterLink } from 'react-router-dom';
import { Box, Link, Skeleton, Stack, Typography, alpha } from '@mui/material';

import { adminPath } from '../../../../frontend/src/utils/adminPath';
import { fontSizes } from '../../../../frontend/src/theme/fontSizes';
import { formatDateTime, formatPlanLimits } from './adminUi';
import { formatFeatureList, formatPlanPrice } from '../../../../frontend/src/features/platformFeatures';
import { FEEDBACK_STATUS_META } from './feedbackUi';
import { ANNOUNCEMENT_KIND_LABELS } from './announcementUi';
import type { AnnouncementKind, FeedbackStatus, PlanLimits, PlatformAuditAction, PlatformAuditLog } from '../../../../frontend/src/types';

export const PLATFORM_AUDIT_LABELS: Record<PlatformAuditAction, { label: string; color: string }> = {
  TENANT_CREATE: { label: 'Criou a clínica', color: '#15998B' },
  TENANT_UPDATE: { label: 'Editou a clínica', color: '#5BA8DE' },
  TENANT_SUSPEND: { label: 'Suspendeu', color: '#C25A4C' },
  TENANT_REACTIVATE: { label: 'Reativou', color: '#15998B' },
  TENANT_ENTER: { label: 'Entrou como', color: '#9B7BD4' },
  TENANT_PLAN_CHANGE: { label: 'Trocou o plano', color: '#D49A3A' },
  TENANT_FEATURES_CHANGE: { label: 'Alterou módulos da clínica', color: '#D49A3A' },
  PLAN_CREATE: { label: 'Criou o plano', color: '#15998B' },
  PLAN_UPDATE: { label: 'Editou o plano', color: '#5BA8DE' },
  PLAN_ACTIVATE: { label: 'Ativou o plano', color: '#15998B' },
  PLAN_DEACTIVATE: { label: 'Desativou o plano', color: '#C25A4C' },
  CATALOG_CREATE: { label: 'Criou no catálogo', color: '#15998B' },
  CATALOG_UPDATE: { label: 'Editou o catálogo', color: '#5BA8DE' },
  CATALOG_ACTIVATE: { label: 'Ativou no catálogo', color: '#15998B' },
  CATALOG_DEACTIVATE: { label: 'Desativou no catálogo', color: '#C25A4C' },
  MEASUREMENT_TYPE_CREATE: { label: 'Criou a medida', color: '#15998B' },
  MEASUREMENT_TYPE_UPDATE: { label: 'Editou a medida', color: '#5BA8DE' },
  MEASUREMENT_TYPE_REORDER: { label: 'Reordenou as medidas', color: '#5BA8DE' },
  MEASUREMENT_TYPE_ACTIVATE: { label: 'Ativou a medida', color: '#15998B' },
  MEASUREMENT_TYPE_DEACTIVATE: { label: 'Desativou a medida', color: '#C25A4C' },
  MEASUREMENT_TYPE_DELETE: { label: 'Excluiu a medida', color: '#C25A4C' },
  FEEDBACK_STATUS_CHANGE: { label: 'Mudou o status do report', color: '#5BA8DE' },
  ANNOUNCEMENT_GENERATE: { label: 'Gerou avisos do release', color: '#9B7BD4' },
  ANNOUNCEMENT_CREATE: { label: 'Criou o aviso', color: '#15998B' },
  ANNOUNCEMENT_UPDATE: { label: 'Editou o aviso', color: '#5BA8DE' },
  ANNOUNCEMENT_DELETE: { label: 'Excluiu o aviso', color: '#C25A4C' },
  ANNOUNCEMENT_SCHEDULE: { label: 'Agendou o aviso', color: '#D49A3A' },
  ANNOUNCEMENT_UNSCHEDULE: { label: 'Cancelou o agendamento', color: '#C25A4C' },
  ANNOUNCEMENT_SEND: { label: 'Enviou o aviso', color: '#15998B' },
};

const FIELD_LABELS: Record<string, string> = {
  name: 'nome',
  slug: 'identificador',
  description: 'descrição',
  limits: 'limites',
  features: 'módulos',
  priceCents: 'preço',
  currency: 'moeda',
  value: 'valor',
  label: 'rótulo',
  sortOrder: 'ordem',
  meta: 'meta',
  unit: 'unidade',
};

type PlanRef = { name?: string } | null | undefined;

function changeValue(field: string, value: unknown): string {
  if (field === 'limits') return formatPlanLimits(value as PlanLimits | null);
  if (field === 'features') return formatFeatureList(value as string[] | null);
  if (field === 'priceCents') return formatPlanPrice(value as number | null);
  return value == null || value === '' ? '—' : String(value);
}

/** Resumo legível dos detalhes gravados em cada ação. */
export function auditDetailsText(entry: PlatformAuditLog): string | null {
  const d = entry.details;
  if (!d) return null;
  switch (entry.action) {
    case 'TENANT_CREATE': {
      const parts = [
        d.adminEmail ? `Administrador: ${d.adminName ?? ''} <${d.adminEmail}>` : null,
        (d.plan as PlanRef)?.name ? `Plano: ${(d.plan as PlanRef)!.name}` : null,
      ].filter(Boolean);
      return parts.length ? parts.join(' · ') : null;
    }
    case 'TENANT_UPDATE':
    case 'PLAN_UPDATE':
      return Object.entries(d)
        .filter(([field]) => field !== 'planId')
        .map(([field, change]) => {
          const c = change as { old?: unknown; new?: unknown };
          return `${FIELD_LABELS[field] ?? field}: ${changeValue(field, c.old)} → ${changeValue(field, c.new)}`;
        })
        .join(' · ');
    case 'CATALOG_UPDATE':
    case 'MEASUREMENT_TYPE_UPDATE': {
      const parts = Object.entries(d)
        .filter(([, change]) => change && typeof change === 'object' && 'old' in (change as object))
        .map(([field, change]) => {
          const c = change as { old?: unknown; new?: unknown };
          return `${FIELD_LABELS[field] ?? field}: ${String(c.old)} → ${String(c.new)}`;
        });
      return parts.join(' · ') || null;
    }
    case 'TENANT_PLAN_CHANGE':
      return `Plano: ${(d.old as PlanRef)?.name ?? 'sem plano'} → ${(d.new as PlanRef)?.name ?? 'sem plano'}`;
    case 'TENANT_FEATURES_CHANGE': {
      const oldO = d.old as { featuresExtra?: string[]; featuresDenied?: string[] } | undefined;
      const newO = d.new as { featuresExtra?: string[]; featuresDenied?: string[] } | undefined;
      return [
        `Extras: ${formatFeatureList(oldO?.featuresExtra)} → ${formatFeatureList(newO?.featuresExtra)}`,
        `Removidos: ${formatFeatureList(oldO?.featuresDenied)} → ${formatFeatureList(newO?.featuresDenied)}`,
      ].join(' · ');
    }
    case 'PLAN_CREATE': {
      const parts = [
        d.priceCents != null ? `Preço: ${formatPlanPrice(d.priceCents as number)}` : null,
        d.features ? `Módulos: ${formatFeatureList(d.features as string[])}` : null,
        `Limites: ${formatPlanLimits(d.limits as PlanLimits | null)}`,
      ].filter(Boolean);
      return parts.join(' · ');
    }
    case 'TENANT_SUSPEND':
      return d.reason ? `Motivo: ${String(d.reason)}` : null;
    case 'TENANT_ENTER':
      return d.suspended ? 'Clínica estava suspensa' : null;
    case 'MEASUREMENT_TYPE_CREATE':
      return d.unit ? `Unidade: ${String(d.unit)}` : null;
    case 'MEASUREMENT_TYPE_REORDER':
      return Array.isArray(d.new) ? `Nova ordem: ${d.new.join(', ')}` : null;
    case 'CATALOG_CREATE':
      return [d.kind, d.value, d.label].filter(Boolean).map(String).join(' · ') || null;
    case 'FEEDBACK_STATUS_CHANGE': {
      const status = (v: unknown) => FEEDBACK_STATUS_META[v as FeedbackStatus]?.label ?? String(v);
      return `${String(d.title ?? '')}: ${status(d.old)} → ${status(d.new)}`;
    }
    case 'ANNOUNCEMENT_GENERATE': {
      const created = (d.created as string[] | undefined) ?? [];
      return created.length ? `Versão ${String(d.version)}: ${created.join(', ')}` : `Versão ${String(d.version)}: nada novo`;
    }
    case 'ANNOUNCEMENT_UPDATE': {
      const parts = [
        d.title ? `título: ${String((d.title as { old: unknown }).old)} → ${String((d.title as { new: unknown }).new)}` : null,
        d.kind
          ? `tipo: ${ANNOUNCEMENT_KIND_LABELS[(d.kind as { old: AnnouncementKind }).old]} → ${ANNOUNCEMENT_KIND_LABELS[(d.kind as { new: AnnouncementKind }).new]}`
          : null,
        d.bodyChanged ? 'texto alterado' : null,
      ].filter(Boolean);
      return parts.join(' · ') || null;
    }
    case 'ANNOUNCEMENT_SCHEDULE':
      return `Para ${formatDateTime(d.scheduledAt as string)}`;
    case 'ANNOUNCEMENT_SEND': {
      const users = Number(d.recipientCount ?? 0);
      const tenants = Number(d.tenantCount ?? 0);
      const base = `${users} ${users === 1 ? 'usuário' : 'usuários'} em ${tenants} ${tenants === 1 ? 'clínica' : 'clínicas'}`;
      return d.scheduledAt ? `${base} · agendado` : base;
    }
    case 'CATALOG_ACTIVATE':
    case 'CATALOG_DEACTIVATE':
      return typeof d.kind === 'string' ? String(d.kind) : null;
    default:
      return null;
  }
}

interface Props {
  entries: PlatformAuditLog[];
  loading?: boolean;
  /** Mostra o nome da clínica com link (na auditoria geral). */
  showTenant?: boolean;
  emptyText?: string;
}

export function PlatformAuditList({ entries, loading, showTenant, emptyText = 'Nenhuma ação registrada.' }: Props) {
  if (loading) {
    return (
      <Stack spacing={1.25} sx={{ px: 2.5, py: 2 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={44} />
        ))}
      </Stack>
    );
  }
  if (entries.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ px: 2.5, py: 5, textAlign: 'center' }}>
        {emptyText}
      </Typography>
    );
  }
  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {entries.map((entry) => {
        const meta = PLATFORM_AUDIT_LABELS[entry.action] ?? { label: entry.action, color: '#7C928D' };
        const details = auditDetailsText(entry);
        return (
          <Box
            component="li"
            key={entry.id}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '150px minmax(0, 1fr)' },
              gap: { xs: 0.5, sm: 2 },
              px: 2.5,
              py: 1.5,
              borderBottom: 1,
              borderColor: 'grey.100',
              '&:last-of-type': { borderBottom: 0 },
            }}
          >
            <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', fontVariantNumeric: 'tabular-nums', pt: 0.4 }}>
              {formatDateTime(entry.createdAt)}
            </Typography>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
                <Box
                  component="span"
                  sx={{
                    fontSize: fontSizes.xs,
                    fontWeight: 700,
                    px: 1,
                    py: 0.3,
                    borderRadius: '8px',
                    color: meta.color,
                    bgcolor: alpha(meta.color, 0.12),
                  }}
                >
                  {meta.label}
                </Box>
                {showTenant && (
                  <Typography component="span" sx={{ fontSize: fontSizes.sm, fontWeight: 700 }}>
                    {entry.targetTenantId ? (
                      <Link component={RouterLink} to={adminPath(`/clinicas/${entry.targetTenantId}`)} underline="hover">
                        {entry.targetName}
                      </Link>
                    ) : (
                      entry.targetName ?? '—'
                    )}
                  </Typography>
                )}
                <Typography component="span" sx={{ fontSize: fontSizes.sm, color: 'text.secondary' }}>
                  por {entry.actorName}
                </Typography>
              </Stack>
              {details && (
                <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', mt: 0.5 }} noWrap title={details}>
                  {details}
                </Typography>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
