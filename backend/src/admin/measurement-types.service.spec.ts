import { BadRequestException, ConflictException } from '@nestjs/common';

import { MeasurementTypesService } from './measurement-types.service';

describe('MeasurementTypesService', () => {
  const actor = { id: 'root-1', name: 'Dono', email: 'root@platform.dev', isSuperAdmin: true } as any;
  const weight = { id: 'type-weight', key: 'weightKg', name: 'Peso', unit: 'kg', sortOrder: 0, active: true };
  const waist = { id: 'type-waist', key: null, name: 'Cintura', unit: 'cm', sortOrder: 2, active: false };

  let prisma: any;
  let service: MeasurementTypesService;

  beforeEach(() => {
    prisma = {
      measurementType: {
        findMany: jest.fn().mockResolvedValue([weight, waist].map((t) => ({ ...t, _count: { values: 0 } }))),
        findUnique: jest.fn(({ where }) => Promise.resolve([weight, waist].find((t) => t.id === where.id) ?? null)),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(({ data }) => Promise.resolve({ id: 'type-new', key: null, active: true, ...data })),
        update: jest.fn(({ where, data }) => Promise.resolve({ ...[weight, waist].find((t) => t.id === where.id), ...data })),
        delete: jest.fn(),
      },
      patientMeasurementValue: { count: jest.fn().mockResolvedValue(0) },
      platformAuditLog: { create: jest.fn() },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    service = new MeasurementTypesService(prisma);
  });

  const lastAudit = () => prisma.platformAuditLog.create.mock.calls.at(-1)?.[0].data;

  it('cria no fim da lista e audita', async () => {
    prisma.measurementType.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ sortOrder: 4 });
    const created = await service.create({ name: 'Coxa', unit: 'cm' }, actor);
    expect(created.sortOrder).toBe(5);
    expect(lastAudit()).toMatchObject({ action: 'MEASUREMENT_TYPE_CREATE', targetTenantId: null, targetName: 'Medida: Coxa' });
  });

  it('não aceita nome repetido', async () => {
    prisma.measurementType.findFirst.mockResolvedValueOnce(waist);
    await expect(service.create({ name: 'cintura', unit: 'cm' }, actor)).rejects.toThrow(ConflictException);
  });

  it('peso e altura não podem ser renomeados nem desativados', async () => {
    await expect(service.update(weight.id, { name: 'Massa' }, actor)).rejects.toThrow(BadRequestException);
    await expect(service.setActive(weight.id, false, actor)).rejects.toThrow(BadRequestException);
    await expect(service.remove(weight.id, actor)).rejects.toThrow(BadRequestException);
  });

  it('peso aceita mudar só a ordem', async () => {
    await service.update(weight.id, { sortOrder: 3 }, actor);
    expect(lastAudit()).toMatchObject({ action: 'MEASUREMENT_TYPE_UPDATE', details: { sortOrder: { old: 0, new: 3 } } });
  });

  it('não exclui tipo com valores registrados', async () => {
    prisma.patientMeasurementValue.count.mockResolvedValue(3);
    await expect(service.remove(waist.id, actor)).rejects.toThrow(ConflictException);
    expect(prisma.measurementType.delete).not.toHaveBeenCalled();
  });

  it('exclui tipo sem valores', async () => {
    await service.remove(waist.id, actor);
    expect(prisma.measurementType.delete).toHaveBeenCalledWith({ where: { id: waist.id } });
    expect(lastAudit().action).toBe('MEASUREMENT_TYPE_DELETE');
  });

  it('reordena exigindo todos os tipos', async () => {
    await expect(service.reorder([waist.id], actor)).rejects.toThrow(BadRequestException);
    await service.reorder([waist.id, weight.id], actor);
    expect(prisma.measurementType.update).toHaveBeenCalledWith({ where: { id: waist.id }, data: { sortOrder: 0 } });
    expect(prisma.measurementType.update).toHaveBeenCalledWith({ where: { id: weight.id }, data: { sortOrder: 1 } });
    expect(lastAudit()).toMatchObject({ action: 'MEASUREMENT_TYPE_REORDER', details: { new: ['Cintura', 'Peso'] } });
  });

  it('a clínica só lê os ativos', async () => {
    await service.listActive();
    expect(prisma.measurementType.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { active: true } }));
  });
});
