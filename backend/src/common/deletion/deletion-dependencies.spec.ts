import {
  DELETION_CONFLICT_CODE,
  DEPENDENCY_SAMPLE_SIZE,
  DeletionConflictException,
  assertDeletable,
  dependency,
  parseUnlinkFlag,
} from './deletion-dependencies';

const dep = (over: Partial<Parameters<typeof dependency>[0]> = {}) =>
  dependency({ type: 't', label: 'Itens', count: 1, unlinkable: true, note: 'n', ...over });

const catchConflict = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(DeletionConflictException);
    return (e as DeletionConflictException).getResponse() as Record<string, any>;
  }
  throw new Error('não lançou');
};

describe('assertDeletable', () => {
  it('devolve lista vazia sem vínculos', () => {
    expect(assertDeletable('o item', [], { unlink: false })).toEqual([]);
  });

  it('ignora vínculos com count 0', () => {
    const deps = [dep({ count: 0 }), dep({ type: 'x', count: 0, unlinkable: false })];
    expect(assertDeletable('o item', deps, { unlink: false })).toEqual([]);
  });

  it('bloqueia com canUnlink false e inclui o blockedHint na mensagem', () => {
    const body = catchConflict(() =>
      assertDeletable('o item', [dep({ label: 'Atendimentos', count: 2, unlinkable: false }), dep()], {
        unlink: true,
        blockedHint: 'Inative o item.',
      }),
    );
    expect(body.statusCode).toBe(409);
    expect(body.code).toBe(DELETION_CONFLICT_CODE);
    expect(body.canUnlink).toBe(false);
    expect(body.message).toContain('Atendimentos (2)');
    expect(body.message).toContain('Inative o item.');
    expect(body.dependencies).toHaveLength(2);
  });

  it('bloqueia sem hint quando não informado', () => {
    const body = catchConflict(() =>
      assertDeletable('o item', [dep({ unlinkable: false })], { unlink: false }),
    );
    expect(body.message.endsWith('.')).toBe(true);
    expect(body.message).not.toContain('undefined');
  });

  it('responde canUnlink true quando só há vínculos desfazíveis e unlink é falso', () => {
    const body = catchConflict(() => assertDeletable('o item', [dep({ count: 3 })], { unlink: false }));
    expect(body.canUnlink).toBe(true);
    expect(body.message).toContain('Itens (3)');
  });

  it('com unlink devolve os vínculos presentes', () => {
    const present = dep({ count: 2 });
    const result = assertDeletable('o item', [present, dep({ type: 'z', count: 0 })], { unlink: true });
    expect(result).toEqual([present]);
  });
});

describe('dependency', () => {
  it('remove repetidos e vazios e ordena os nomes', () => {
    const d = dep({ names: ['Zeca', 'Ana', 'Ana', '', '  ', null, undefined, 'Álvaro'] });
    expect(d.names).toEqual(['Álvaro', 'Ana', 'Zeca']);
  });

  it(`limita a ${DEPENDENCY_SAMPLE_SIZE} nomes`, () => {
    const names = Array.from({ length: 25 }, (_, i) => `Nome ${String(i).padStart(2, '0')}`);
    const d = dep({ names });
    expect(d.names).toHaveLength(DEPENDENCY_SAMPLE_SIZE);
    expect(d.names[0]).toBe('Nome 00');
  });

  it('usa lista vazia quando não há nomes', () => {
    expect(dep().names).toEqual([]);
  });
});

describe('parseUnlinkFlag', () => {
  it.each([[true, true], ['true', true], ['1', true], [false, false], ['false', false], ['0', false], [undefined, false], [1, false]])(
    '%p -> %p',
    (input, expected) => {
      expect(parseUnlinkFlag(input)).toBe(expected);
    },
  );
});
