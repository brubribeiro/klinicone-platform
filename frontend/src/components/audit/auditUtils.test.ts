import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';

import type { AuditLogEntry } from '../../api/auditLogs';
import { flattenAuditLogs, formatAuditValue, getFieldLabel } from './auditUtils';

const log = (o: Partial<AuditLogEntry>): AuditLogEntry => ({
  id: 'l1',
  entity: 'Patient',
  entityId: 'p1',
  action: 'UPDATE',
  changes: null,
  userId: 'u1',
  userName: 'Ana',
  createdAt: '2026-03-10T15:00:00.000Z',
  ...o,
});

describe('getFieldLabel', () => {
  it('traduz campos conhecidos e devolve o nome cru dos desconhecidos', () => {
    expect(getFieldLabel('birthDate')).toBe('Data de nascimento');
    expect(getFieldLabel('campoNovo')).toBe('campoNovo');
  });
});

describe('formatAuditValue', () => {
  it('vazio vira traço', () => {
    expect(formatAuditValue('name', null)).toBe('—');
    expect(formatAuditValue('name', undefined)).toBe('—');
    expect(formatAuditValue('name', '')).toBe('—');
  });

  it('chaves de arquivo viram "Sim"', () => {
    expect(formatAuditValue('photoStorageKey', 'a/b.png')).toBe('Sim');
    expect(formatAuditValue('storageKey', 'x')).toBe('Sim');
  });

  it('sexo e origem usam os rótulos de domínio', () => {
    expect(formatAuditValue('sex', 'F')).not.toBe('F');
    expect(formatAuditValue('referralSource', 'INSTAGRAM')).not.toBe('');
  });

  it('enums conhecidos são traduzidos; desconhecidos ficam como estão', () => {
    expect(formatAuditValue('status', 'NO_SHOW')).toBe('Não compareceu');
    expect(formatAuditValue('type', 'INCOME')).toBe('Receita');
    expect(formatAuditValue('channel', 'WHATSAPP')).toBe('WhatsApp');
    expect(formatAuditValue('status', 'OUTRO')).toBe('OUTRO');
  });

  it('booleanos, datas ISO, listas, objetos e números', () => {
    expect(formatAuditValue('active', true)).toBe('Sim');
    expect(formatAuditValue('active', false)).toBe('Não');
    const iso = '2026-03-10T15:00:00.000Z';
    expect(formatAuditValue('paidAt', iso)).toBe(dayjs(iso).format('DD/MM/YYYY HH:mm'));
    expect(formatAuditValue('permissions', ['a', 'b'])).toBe('a, b');
    expect(formatAuditValue('permissions', [])).toBe('—');
    expect(formatAuditValue('anamnesis', { a: 1 })).toBe('{"a":1}');
    expect(formatAuditValue('price', 12.5)).toBe('12.5');
    expect(formatAuditValue('name', 'Maria')).toBe('Maria');
  });
});

describe('flattenAuditLogs', () => {
  it('UPDATE gera uma linha por campo com antes e depois formatados', () => {
    const rows = flattenAuditLogs([
      log({ changes: { status: { old: 'SCHEDULED', new: 'CONFIRMED' }, price: { old: 10, new: 20 } } }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: 'l1-status',
      logId: 'l1',
      userName: 'Ana',
      action: 'UPDATE',
      field: 'status',
      fieldLabel: 'Status',
      oldValue: 'Agendado',
      newValue: 'Confirmado',
    });
    expect(rows[1]).toMatchObject({ field: 'price', oldValue: '10', newValue: '20' });
  });

  it('CREATE só preenche o valor novo e DELETE só o anterior', () => {
    const created = flattenAuditLogs([log({ action: 'CREATE', changes: { name: 'Maria' } as never })]);
    expect(created[0]).toMatchObject({ oldValue: null, newValue: 'Maria' });
    const deleted = flattenAuditLogs([log({ action: 'DELETE', changes: { name: 'Maria' } as never })]);
    expect(deleted[0]).toMatchObject({ oldValue: 'Maria', newValue: null });
  });

  it('esconde campos técnicos, vazios e alterações vazio→vazio', () => {
    const rows = flattenAuditLogs([
      log({
        changes: {
          appointments: { old: [], new: [1] },
          photoUrl: { old: 'a', new: 'b' },
          notes: { old: null, new: '' },
          phone: { old: null, new: '123' },
        },
      }),
      log({ id: 'l2', action: 'CREATE', changes: { email: '', name: 'X' } as never }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(['l1-phone', 'l2-name']);
  });

  it('ignora logs sem mudanças visíveis e usa "Sistema" sem usuário', () => {
    expect(flattenAuditLogs([log({ changes: null })])).toEqual([]);
    expect(flattenAuditLogs([log({ changes: { patient: { old: 1, new: 2 } } })])).toEqual([]);
    const rows = flattenAuditLogs([log({ userName: null, changes: { name: { old: 'A', new: 'B' } } })]);
    expect(rows[0].userName).toBe('Sistema');
  });
});
