import { RecurringExpensesService } from './recurring-expenses.service';
import { DeletionConflictException } from '../common/deletion/deletion-dependencies';

describe('RecurringExpensesService.remove', () => {
  const build = (entries = 0) => {
    const prisma: any = {
      recurringExpense: {
        findUnique: jest.fn().mockResolvedValue({ id: 're-1', name: 'Aluguel' }),
        delete: jest.fn().mockResolvedValue({}),
      },
      financialEntry: {
        count: jest.fn().mockResolvedValue(entries),
        updateMany: jest.fn().mockResolvedValue({ count: entries }),
      },
      $transactionWithRetry: jest.fn().mockImplementation(async (fn) => fn(prisma)),
    };
    const auditLog: any = { logDelete: jest.fn().mockResolvedValue(undefined) };
    return { service: new RecurringExpensesService(prisma, auditLog), prisma, auditLog };
  };

  it('responde 409 com canUnlink true quando há lançamentos gerados', async () => {
    const { service, prisma } = build(4);
    const err = await service.remove('re-1').catch((e) => e);
    expect(err).toBeInstanceOf(DeletionConflictException);
    const body = err.getResponse();
    expect(body.canUnlink).toBe(true);
    expect(body.dependencies).toEqual([
      expect.objectContaining({ type: 'financialEntries', count: 4, unlinkable: true }),
    ]);
    expect(prisma.financialEntry.updateMany).not.toHaveBeenCalled();
    expect(prisma.recurringExpense.delete).not.toHaveBeenCalled();
  });

  it('desvincula os lançamentos e exclui', async () => {
    const { service, prisma, auditLog } = build(4);
    const result = await service.remove('re-1', { id: 'u1' } as never, true);
    expect(result).toEqual({ ok: true, unlinked: [expect.objectContaining({ type: 'financialEntries' })] });
    expect(prisma.financialEntry.updateMany).toHaveBeenCalledWith({
      where: { recurringExpenseId: 're-1' },
      data: { recurringExpenseId: null },
    });
    expect(prisma.recurringExpense.delete).toHaveBeenCalledWith({ where: { id: 're-1' } });
    expect(auditLog.logDelete).toHaveBeenCalledWith(
      'RecurringExpense',
      're-1',
      expect.objectContaining({ unlinkedDependencies: expect.any(Array) }),
      expect.anything(),
    );
  });

  it('exclui direto quando não há lançamentos', async () => {
    const { service, prisma } = build(0);
    await expect(service.remove('re-1')).resolves.toEqual({ ok: true, unlinked: [] });
    expect(prisma.recurringExpense.delete).toHaveBeenCalledWith({ where: { id: 're-1' } });
  });
});
