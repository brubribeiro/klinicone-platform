import { ColorPill } from './feedbackUi';
import { formatDateTime } from './adminUi';
import type { AnnouncementKind, AnnouncementStatus, PlatformAnnouncement } from '../../../../frontend/src/types';

export const ANNOUNCEMENT_KIND_LABELS: Record<AnnouncementKind, string> = {
  FEATURE: 'Novidade',
  FIX: 'Correção',
};

export const ANNOUNCEMENT_KIND_META: Record<AnnouncementKind, { label: string; color: string }> = {
  FEATURE: { label: ANNOUNCEMENT_KIND_LABELS.FEATURE, color: '#15998B' },
  FIX: { label: ANNOUNCEMENT_KIND_LABELS.FIX, color: '#D49A3A' },
};

export const ANNOUNCEMENT_STATUS_META: Record<AnnouncementStatus, { label: string; color: string }> = {
  DRAFT: { label: 'Rascunho', color: '#7A8C89' },
  SCHEDULED: { label: 'Agendado', color: '#5BA8DE' },
  SENT: { label: 'Enviado', color: '#15998B' },
};

export const AnnouncementKindPill = ({ kind }: { kind: AnnouncementKind }) => (
  <ColorPill {...ANNOUNCEMENT_KIND_META[kind]} />
);

export const AnnouncementStatusPill = ({ status }: { status: AnnouncementStatus }) => (
  <ColorPill {...ANNOUNCEMENT_STATUS_META[status]} />
);

/** "Agendado para 01/11/2026 09:00", "Enviado em … para 12 usuários", "Criado em …". */
export function announcementWhen(a: PlatformAnnouncement): string {
  if (a.status === 'SCHEDULED') return `Agendado para ${formatDateTime(a.scheduledAt)}`;
  if (a.status === 'SENT') {
    const n = a.recipientCount ?? 0;
    return `Enviado em ${formatDateTime(a.sentAt)} para ${n} ${n === 1 ? 'usuário' : 'usuários'}`;
  }
  return `Criado em ${formatDateTime(a.createdAt)}`;
}
