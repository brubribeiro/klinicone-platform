import { BadRequestException } from '@nestjs/common';

import { EquipmentService } from './equipment.service';

describe('EquipmentService.remove', () => {
  const build = (usages: Array<{ procedure: { name: string } }>) => {
    const prisma: any = {
      equipment: {
        findUnique: jest.fn().mockResolvedValue({ id: 'eq-1', name: 'Laser' }),
        delete: jest.fn().mockResolvedValue({}),
      },
      procedureEquipment: { findMany: jest.fn().mockResolvedValue(usages) },
    };
    const auditLog: any = { logDelete: jest.fn().mockResolvedValue(undefined) };
    const service = new EquipmentService(prisma, {} as any, auditLog);
    return { service, prisma };
  };

  it('bloqueia a exclusão com mensagem listando os procedimentos', async () => {
    const { service, prisma } = build([{ procedure: { name: 'Depilação' } }]);
    await expect(service.remove('eq-1')).rejects.toThrow(BadRequestException);
    await expect(service.remove('eq-1')).rejects.toThrow(/Depilação/);
    expect(prisma.equipment.delete).not.toHaveBeenCalled();
  });

  it('exclui quando não há vínculos', async () => {
    const { service, prisma } = build([]);
    await expect(service.remove('eq-1')).resolves.toEqual({ ok: true });
    expect(prisma.equipment.delete).toHaveBeenCalledWith({ where: { id: 'eq-1' } });
  });
});
