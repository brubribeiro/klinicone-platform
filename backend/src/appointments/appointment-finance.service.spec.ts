import { Test, TestingModule } from '@nestjs/testing';

import { AppointmentFinanceService } from './appointment-finance.service';
import { PrismaService } from '../prisma/prisma.service';
import { PromotionsService } from '../promotions/promotions.service';

describe('AppointmentFinanceService', () => {
  let service: AppointmentFinanceService;
  let tx: any;
  let promotions: any;

  const input = {
    appointmentId: 'appt-1',
    patientId: 'patient-1',
    // 23h em São Paulo do dia 30/11 (já é 01/12 em UTC)
    startAt: new Date('2025-12-01T02:00:00.000Z'),
    procedureId: 'proc-1',
    packageId: null,
    extraMaterials: [],
  };

  beforeEach(async () => {
    tx = {
      procedure: {
        findUnique: jest.fn().mockResolvedValue({ id: 'proc-1', name: 'Limpeza', price: 200, materials: [] }),
      },
      patient: { findUnique: jest.fn().mockResolvedValue({ id: 'patient-1', name: 'Ana' }) },
      patientPackage: {
        findUnique: jest.fn().mockResolvedValue({ id: 'pp-1', totalPaid: 900, financeGenerated: false }),
        update: jest.fn().mockResolvedValue({}),
      },
      financialEntry: {
        create: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      appointment: { update: jest.fn().mockResolvedValue({}) },
    };
    promotions = {
      quoteForProcedure: jest.fn().mockResolvedValue({
        originalPrice: 200,
        discount: 40,
        finalPrice: 160,
        promotion: { id: 'promo-1', name: 'Black Friday', discountType: 'PERCENTAGE', discountValue: 20 },
      }),
      discountLabel: jest.fn().mockReturnValue('-20%'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentFinanceService,
        { provide: PrismaService, useValue: {} },
        { provide: PromotionsService, useValue: promotions },
      ],
    }).compile();
    service = module.get(AppointmentFinanceService);
  });

  it('applies the promotion of the appointment day (Brazil calendar) to the revenue', async () => {
    await service.generateForCompletion(tx, input);

    expect(promotions.quoteForProcedure).toHaveBeenCalledWith(
      'proc-1',
      200,
      new Date('2025-11-30T12:00:00.000Z'),
    );
    const entry = tx.financialEntry.create.mock.calls[0][0].data;
    expect(Number(entry.amount)).toBe(160);
    expect(entry.description).toContain('Promoção: Black Friday -20%');
    expect(tx.appointment.update).toHaveBeenCalledWith({
      where: { id: 'appt-1' },
      data: { promotionId: 'promo-1' },
    });
  });

  it('does not apply procedure promotions to package sessions', async () => {
    await service.generateForCompletion(tx, { ...input, packageId: 'pp-1' });

    expect(promotions.quoteForProcedure).not.toHaveBeenCalled();
    const entry = tx.financialEntry.create.mock.calls[0][0].data;
    expect(Number(entry.amount)).toBe(900);
    expect(tx.appointment.update).not.toHaveBeenCalled();
  });
});
