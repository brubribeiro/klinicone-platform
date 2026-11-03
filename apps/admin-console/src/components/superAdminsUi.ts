/** Motivo para desabilitar o botão de remover; `null` = pode remover (ainda com confirmação na UI). */
export function superAdminRemoveBlockedReason(
  admin: { id: string },
  opts: { currentUserId?: string | null; totalCount: number },
): string | null {
  if (opts.currentUserId && opts.currentUserId === admin.id) {
    return 'Você não pode remover a si mesmo';
  }
  if (opts.totalCount <= 1) {
    return 'Não é possível remover o último super-admin';
  }
  return null;
}

/** Texto do chip de acesso na listagem. */
export function superAdminAccessLabel(admin: {
  hasClinic: boolean;
  tenantName: string | null;
}): string {
  if (!admin.hasClinic) return 'Só plataforma';
  return admin.tenantName ? `Dual · ${admin.tenantName}` : 'Login dual';
}
