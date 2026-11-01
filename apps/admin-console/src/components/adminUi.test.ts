import { describe, it, expect } from 'vitest';

import { formatBytes, formatLastAccess, formatPlanLimits } from './adminUi';
import { auditDetailsText } from './PlatformAuditList';
import type { PlatformAuditLog } from '../../../../frontend/src/types';

describe('adminUi', () => {
  const now = new Date('2026-10-26T12:00:00Z').getTime();
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it('formatLastAccess', () => {
    expect(formatLastAccess(null, now)).toBe('Nunca');
    expect(formatLastAccess(ago(20_000), now)).toBe('agora');
    expect(formatLastAccess(ago(5 * 60_000), now)).toBe('há 5 min');
    expect(formatLastAccess(ago(3 * 3_600_000), now)).toBe('há 3 h');
    expect(formatLastAccess(ago(26 * 3_600_000), now)).toBe('há 1 dia');
    expect(formatLastAccess(ago(10 * 86_400_000), now)).toBe('há 10 dias');
    expect(formatLastAccess('2026-08-01T12:00:00Z', now)).toBe('01/08/2026');
  });

  it('formatBytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1536)).toBe('1,5 KB');
    expect(formatBytes(250 * 1024 * 1024)).toBe('250 MB');
    expect(formatBytes(3.2 * 1024 ** 3)).toBe('3,2 GB');
  });

  it('formatPlanLimits', () => {
    expect(formatPlanLimits(null)).toBe('Sem limites');
    expect(formatPlanLimits({})).toBe('Sem limites');
    expect(formatPlanLimits({ maxUsers: 1, maxPatients: 3000, storageGb: 2.5 })).toBe(
      '1 usuário · 3.000 pacientes · 2,5 GB',
    );
  });

  describe('auditDetailsText (planos)', () => {
    const entry = (action: PlatformAuditLog['action'], details: Record<string, unknown>) =>
      ({ id: '1', action, details }) as PlatformAuditLog;

    it('troca de plano da clínica', () => {
      expect(auditDetailsText(entry('TENANT_PLAN_CHANGE', { old: null, new: { id: 'p', name: 'Profissional' } }))).toBe(
        'Plano: sem plano → Profissional',
      );
    });

    it('edição do plano ignora planId e formata limites', () => {
      expect(
        auditDetailsText(
          entry('PLAN_UPDATE', {
            planId: 'p',
            name: { old: 'Essencial', new: 'Básico' },
            limits: { old: { maxUsers: 3 }, new: null },
          }),
        ),
      ).toBe('nome: Essencial → Básico · limites: 3 usuários → Sem limites');
    });

    it('clínica criada com plano', () => {
      expect(
        auditDetailsText(entry('TENANT_CREATE', { adminName: 'Ana', adminEmail: 'a@x.com', plan: { name: 'Essencial' } })),
      ).toBe('Administrador: Ana <a@x.com> · Plano: Essencial');
    });

    it('overrides de módulos da clínica', () => {
      expect(
        auditDetailsText(
          entry('TENANT_FEATURES_CHANGE', {
            old: { featuresExtra: [], featuresDenied: [] },
            new: { featuresExtra: ['messages'], featuresDenied: ['finance'] },
          }),
        ),
      ).toBe('Extras: Nenhum → Mensagens · Removidos: Nenhum → Financeiro');
    });

    it('status de report', () => {
      expect(
        auditDetailsText(entry('FEEDBACK_STATUS_CHANGE', { title: 'Botão não salva', old: 'OPEN', new: 'CLOSED' })),
      ).toBe('Botão não salva: Aberto → Fechado');
    });
  });
});
