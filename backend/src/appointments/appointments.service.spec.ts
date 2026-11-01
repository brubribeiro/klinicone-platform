import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AvailabilityService } from '../availability/availability.service';
import { PackagesService } from '../packages/packages.service';
import { PromotionsService } from '../promotions/promotions.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AppointmentRulesService } from './appointment-rules.service';
import { AppointmentMaterialsService } from './appointment-materials.service';
import { AppointmentFinanceService } from './appointment-finance.service';
import { AppointmentEventsService } from './appointment-events.service';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let prisma: any;
  let notifications: any;
  let availability: any;
  let packagesService: any;
  let promotionsService: any;
  let auditLog: any;

  const mockAppointment = {
    id: 'appt-1',
    patientId: 'patient-1',
    procedureId: 'proc-1',
    professionalId: 'user-1',
    startAt: new Date('2025-01-15T10:00:00Z'),
    endAt: new Date('2025-01-15T11:00:00Z'),
    status: 'SCHEDULED',
    kind: 'PROCEDURE',
    materialsDeducted: false,
    financeGenerated: false,
    patientPackageId: null,
    sessionIndex: null,
    patient: { name: 'João' },
    procedure: { name: 'Botox' },
    professional: { id: 'user-1', name: 'Dra. Ana' },
    extraMaterials: [],
  };

  beforeEach(async () => {
    prisma = {
      appointment: {
        findMany: jest.fn().mockResolvedValue([mockAppointment]),
        findUnique: jest.fn().mockResolvedValue(mockAppointment),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(mockAppointment),
        update: jest.fn().mockResolvedValue(mockAppointment),
        delete: jest.fn().mockResolvedValue(mockAppointment),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1', active: true, providesAppointments: true }),
      },
      patient: {
        findUnique: jest.fn().mockResolvedValue({ id: 'patient-1' }),
      },
      procedure: {
        findUnique: jest.fn().mockResolvedValue({ id: 'proc-1', active: true, recurrenceDays: 0 }),
      },
      procedureMaterial: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      inventoryItem: {
        findUnique: jest.fn().mockResolvedValue({ id: 'item-1', name: 'Botox', quantity: 10 }),
        update: jest.fn().mockResolvedValue({}),
      },
      inventoryMovement: {
        create: jest.fn().mockResolvedValue({}),
      },
      appointmentMaterial: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn().mockImplementation(async (fn) => fn(prisma)),
      $transactionWithRetry: jest.fn().mockImplementation(async (fn) => fn(prisma)),
    };

    notifications = {
      notify: jest.fn().mockResolvedValue(undefined),
      notifyMany: jest.fn().mockResolvedValue(undefined),
    };

    availability = {
      checkProfessionalSlot: jest.fn().mockResolvedValue(undefined),
      assertNoAppointmentConflict: jest.fn().mockResolvedValue(undefined),
    };

    packagesService = {
      incrementSession: jest.fn().mockResolvedValue(undefined),
      decrementSession: jest.fn().mockResolvedValue(undefined),
    };

    promotionsService = {
      quoteForProcedure: jest.fn().mockResolvedValue({ promotion: null }),
      discountLabel: jest.fn().mockReturnValue('-10%'),
    };

    auditLog = {
      logCreate: jest.fn().mockResolvedValue(undefined),
      logUpdate: jest.fn().mockResolvedValue(undefined),
      logDelete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        AppointmentRulesService,
        AppointmentMaterialsService,
        AppointmentFinanceService,
        AppointmentEventsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: AvailabilityService, useValue: availability },
        { provide: PackagesService, useValue: packagesService },
        { provide: PromotionsService, useValue: promotionsService },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
  });

  describe('list', () => {
    it('should return appointments ordered by startAt', async () => {
      const result = await service.list();
      expect(result).toEqual([mockAppointment]);
      expect(prisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { startAt: 'asc' } }),
      );
    });

    it('should filter by professionalId', async () => {
      await service.list(undefined, undefined, 'user-1');
      expect(prisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ professionalId: 'user-1' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if not found', async () => {
      prisma.appointment.findUnique.mockResolvedValue(null);
      await expect(service.findOne('invalid')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if restricted user accessing others appointment', async () => {
      const user = {
        id: 'user-2',
        restrictToOwnAppointments: true,
      };
      await expect(service.findOne('appt-1', user as any)).rejects.toThrow(ForbiddenException);
    });

    it('should return appointment for unrestricted user', async () => {
      const user = { id: 'user-2', restrictToOwnAppointments: false };
      const result = await service.findOne('appt-1', user as any);
      expect(result).toEqual(mockAppointment);
    });
  });

  describe('create', () => {
    it('should throw if PROCEDURE kind without procedureId', async () => {
      await expect(
        service.create({
          patientId: 'patient-1',
          professionalId: 'user-1',
          startAt: '2025-01-15T10:00:00Z',
          endAt: '2025-01-15T11:00:00Z',
          kind: 'PROCEDURE',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should check availability before creating', async () => {
      await service.create({
        patientId: 'patient-1',
        procedureId: 'proc-1',
        professionalId: 'user-1',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
      } as any);

      expect(availability.checkProfessionalSlot).toHaveBeenCalled();
      expect(availability.assertNoAppointmentConflict).toHaveBeenCalled();
    });

    it('should create appointment and send notification', async () => {
      await service.create({
        patientId: 'patient-1',
        procedureId: 'proc-1',
        professionalId: 'user-1',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
      } as any);

      expect(prisma.appointment.create).toHaveBeenCalled();
      expect(notifications.notify).toHaveBeenCalled();
    });

    it('should throw if procedure does not exist', async () => {
      prisma.patient.findUnique.mockResolvedValue({ id: 'patient-1' });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.procedure.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          patientId: 'patient-1',
          procedureId: 'missing-proc',
          professionalId: 'user-1',
          startAt: '2025-01-15T10:00:00Z',
          endAt: '2025-01-15T11:00:00Z',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('start', () => {
    it('should throw if status is not SCHEDULED or CONFIRMED', async () => {
      prisma.appointment.findUnique.mockResolvedValue({ ...mockAppointment, status: 'COMPLETED' });
      await expect(service.start('appt-1')).rejects.toThrow(BadRequestException);
    });

    it('should mark as IN_PROGRESS with startedAt', async () => {
      await service.start('appt-1');
      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'IN_PROGRESS',
            startedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should forbid restricted user starting another professional appointment', async () => {
      const user = { id: 'user-2', restrictToOwnAppointments: true };
      await expect(service.start('appt-1', user as any)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('finish', () => {
    it('should throw if status is not IN_PROGRESS', async () => {
      prisma.appointment.findUnique.mockResolvedValue({ ...mockAppointment, status: 'SCHEDULED' });
      await expect(service.finish('appt-1')).rejects.toThrow(BadRequestException);
    });

    it('should set finishedAt', async () => {
      prisma.appointment.findUnique.mockResolvedValue({ ...mockAppointment, status: 'IN_PROGRESS' });
      await service.finish('appt-1');
      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ finishedAt: expect.any(Date) }),
        }),
      );
    });

    it('should forbid restricted user finishing another professional appointment', async () => {
      prisma.appointment.findUnique.mockResolvedValue({ ...mockAppointment, status: 'IN_PROGRESS' });
      const user = { id: 'user-2', restrictToOwnAppointments: true };
      await expect(service.finish('appt-1', user as any)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('resume', () => {
    it('should clear finishedAt', async () => {
      prisma.appointment.findUnique.mockResolvedValue({ ...mockAppointment, status: 'IN_PROGRESS' });
      await service.resume('appt-1');
      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ finishedAt: null }),
        }),
      );
    });

    it('should forbid restricted user resuming another professional appointment', async () => {
      prisma.appointment.findUnique.mockResolvedValue({ ...mockAppointment, status: 'IN_PROGRESS' });
      const user = { id: 'user-2', restrictToOwnAppointments: true };
      await expect(service.resume('appt-1', user as any)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should return materials if deducted', async () => {
      prisma.appointment.findUnique.mockResolvedValue({
        ...mockAppointment,
        materialsDeducted: true,
      });

      await service.remove('appt-1');

      expect(prisma.procedureMaterial.findMany).toHaveBeenCalled();
    });

    it('should throw if appointment not found', async () => {
      prisma.appointment.findUnique.mockResolvedValue(null);
      await expect(service.remove('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getRecurrenceLimit', () => {
    it('should return null dates if no recurrence configured', async () => {
      prisma.procedure.findUnique.mockResolvedValue({ recurrenceDays: 0 });
      const result = await service.getRecurrenceLimit('patient-1', 'proc-1');
      expect(result.earliestDate).toBeNull();
    });

    it('should return null dates for empty patientId', async () => {
      const result = await service.getRecurrenceLimit('', 'proc-1');
      expect(result.earliestDate).toBeNull();
    });
  });
});
