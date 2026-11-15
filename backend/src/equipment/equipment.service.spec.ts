import { EquipmentService } from './equipment.service';
import { DeletionConflictException } from '../common/deletion/deletion-dependencies';

describe('EquipmentService.remove', () => {
  const build = (
    deps: { procedures?: string[]; documents?: string[]; financial?: number } = {},
  ) => {
    const prisma: any = {
      equipment: {
        findUnique: jest.fn().mockResolvedValue({ id: 'eq-1', name: 'Laser' }),
        delete: jest.fn().mockResolvedValue({}),
      },
      procedureEquipment: {
        findMany: jest
          .fn()
          .mockResolvedValue((deps.procedures ?? []).map((name) => ({ procedure: { name } }))),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      document: {
        findMany: jest.fn().mockResolvedValue((deps.documents ?? []).map((name) => ({ name }))),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      financialEntry: {
        count: jest.fn().mockResolvedValue(deps.financial ?? 0),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transactionWithRetry: jest.fn().mockImplementation(async (fn) => fn(prisma)),
    };
    const auditLog: any = { logDelete: jest.fn().mockResolvedValue(undefined) };
    const service = new EquipmentService(prisma, {} as any, auditLog);
    return { service, prisma, auditLog };
  };

  const conflictOf = async (promise: Promise<unknown>) => {
    const err = await promise.catch((e) => e);
    expect(err).toBeInstanceOf(DeletionConflictException);
    return (err as DeletionConflictException).getResponse() as Record<string, any>;
  };

  it('responde 409 listando os vínculos quando não pediu para desvincular', async () => {
    const { service, prisma } = build({ procedures: ['Depilação'], documents: ['Termo'], financial: 2 });
    const body = await conflictOf(service.remove('eq-1'));
    expect(body.canUnlink).toBe(true);
    expect(body.dependencies).toEqual([
      expect.objectContaining({ type: 'procedures', count: 1, names: ['Depilação'], unlinkable: true }),
      expect.objectContaining({ type: 'documents', count: 1, names: ['Termo'], unlinkable: true }),
      expect.objectContaining({ type: 'financialEntries', count: 2, unlinkable: true }),
    ]);
    expect(prisma.procedureEquipment.deleteMany).not.toHaveBeenCalled();
    expect(prisma.equipment.delete).not.toHaveBeenCalled();
  });

  it('desvincula procedimentos, documentos e lançamentos e exclui', async () => {
    const { service, prisma, auditLog } = build({ procedures: ['Depilação'], documents: ['Termo'], financial: 2 });
    const result = await service.remove('eq-1', { id: 'u1' } as never, true);

    expect(result.ok).toBe(true);
    expect(result.unlinked.map((d) => d.type)).toEqual(['procedures', 'documents', 'financialEntries']);
    expect(prisma.procedureEquipment.deleteMany).toHaveBeenCalledWith({ where: { equipmentId: 'eq-1' } });
    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: { equipmentId: 'eq-1' },
      data: { equipmentId: null },
    });
    expect(prisma.financialEntry.updateMany).toHaveBeenCalledWith({
      where: { equipmentId: 'eq-1' },
      data: { equipmentId: null },
    });
    expect(prisma.equipment.delete).toHaveBeenCalledWith({ where: { id: 'eq-1' } });
    expect(auditLog.logDelete).toHaveBeenCalledWith(
      'Equipment',
      'eq-1',
      expect.objectContaining({ unlinkedDependencies: expect.any(Array) }),
      expect.anything(),
    );
  });

  it('exclui quando não há vínculos', async () => {
    const { service, prisma } = build();
    await expect(service.remove('eq-1')).resolves.toEqual({ ok: true, unlinked: [] });
    expect(prisma.equipment.delete).toHaveBeenCalledWith({ where: { id: 'eq-1' } });
  });
});
