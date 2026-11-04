import { describe, expect, it } from 'vitest';

import { auditDetailsText } from './PlatformAuditList';
import { superAdminAccessLabel, superAdminRemoveBlockedReason } from './superAdminsUi';
import type { PlatformAuditLog } from '../../../../frontend/src/types';

describe('superAdminsUi (tela Super-admins)', () => {
  it('bloqueia auto-remoção e o último super-admin', () => {
    expect(superAdminRemoveBlockedReason({ id: 'a' }, { currentUserId: 'a', totalCount: 3 })).toBe(
      'Você não pode remover a si mesmo',
    );
    expect(superAdminRemoveBlockedReason({ id: 'b' }, { currentUserId: 'a', totalCount: 1 })).toBe(
      'Não é possível remover o último super-admin',
    );
    expect(superAdminRemoveBlockedReason({ id: 'b' }, { currentUserId: 'a', totalCount: 2 })).toBeNull();
  });

  it('rótulo de acesso dual vs só plataforma', () => {
    expect(superAdminAccessLabel({ hasClinic: false, tenantName: null })).toBe('Só plataforma');
    expect(superAdminAccessLabel({ hasClinic: true, tenantName: null })).toBe('Login dual');
    expect(superAdminAccessLabel({ hasClinic: true, tenantName: 'Clínica A' })).toBe('Dual · Clínica A');
  });

  it('auditDetailsText para ações de super-admin', () => {
    const entry = (action: PlatformAuditLog['action'], details: Record<string, unknown>) =>
      ({ id: '1', action, details }) as PlatformAuditLog;

    expect(auditDetailsText(entry('SUPER_ADMIN_CREATE', { email: 'a@x.com', dual: false }))).toBe(
      'a@x.com · só plataforma',
    );
    expect(auditDetailsText(entry('SUPER_ADMIN_PROMOTE', { email: 'b@x.com', dual: true }))).toBe(
      'b@x.com · login dual (clínica + plataforma)',
    );
    expect(auditDetailsText(entry('SUPER_ADMIN_DEMOTE', { email: 'b@x.com', dual: true }))).toContain('b@x.com');
  });
});
