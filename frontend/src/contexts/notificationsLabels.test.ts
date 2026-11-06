import { describe, expect, it } from 'vitest';

import { labelForType, NOTIFICATION_TYPES } from './notificationsLabels';

describe('notificationsLabels', () => {
  it('cada tipo é único e tem rótulo e descrição', () => {
    const types = NOTIFICATION_TYPES.map((t) => t.type);
    expect(new Set(types).size).toBe(types.length);
    for (const t of NOTIFICATION_TYPES) {
      expect(t.label).not.toBe('');
      expect(t.description).not.toBe('');
    }
  });

  it('labelForType traduz tipos conhecidos', () => {
    expect(labelForType('INVENTORY_LOW_STOCK')).toBe('Estoque baixo');
  });

  it('labelForType devolve o próprio tipo quando desconhecido', () => {
    expect(labelForType('NOVO_TIPO' as never)).toBe('NOVO_TIPO');
  });
});
