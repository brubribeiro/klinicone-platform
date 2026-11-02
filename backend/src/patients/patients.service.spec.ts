import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

import { PatientsService } from './patients.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { R2StorageService } from '../documents/r2-storage.service';
import { CompressionService } from '../documents/compression.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PatientPhotoStorageService } from './patient-photo-storage.service';
import { PatientStatsService } from './patient-stats.service';
import { PatientEventsService } from './patient-events.service';
import { PatientMeasurementsService } from './patient-measurements.service';
import { PlanLimitsService } from '../plan-limits/plan-limits.service';

describe('PatientsService', () => {
  let service: PatientsService;
  let prisma: any;
  let notifications: any;
  let r2: any;
  let auditLog: any;
  let planLimits: any;

  const mockPatient = {
    id: 'patient-1',
    name: 'João Silva',
    email: 'joao@email.com',
    phone: '11999999999',
    photoStorageKey: null,
    photoUrl: null,
    appointments: [],
  };

  beforeEach(async () => {
    prisma = {
      patient: {
        findMany: jest.fn().mockResolvedValue([mockPatient]),
        findUnique: jest.fn().mockResolvedValue(mockPatient),
        create: jest.fn().mockResolvedValue(mockPatient),
        update: jest.fn().mockResolvedValue(mockPatient),
        delete: jest.fn().mockResolvedValue(mockPatient),
      },
      appointment: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
      patientMeasurement: {
        create: jest.fn().mockResolvedValue({ id: 'm-1' }),
      },
      financialEntry: {
        groupBy: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
      },
    };

    notifications = {
      findUsersWithPermission: jest.fn().mockResolvedValue([]),
      notifyMany: jest.fn().mockResolvedValue(undefined),
    };

    r2 = {
      isConfigured: true,
      upload: jest.fn().mockResolvedValue({ key: 'key', url: 'http://url' }),
      getPresignedUrl: jest.fn().mockResolvedValue('https://signed.example/photo.jpg'),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    auditLog = {
      logCreate: jest.fn().mockResolvedValue(undefined),
      logUpdate: jest.fn().mockResolvedValue(undefined),
      logDelete: jest.fn().mockResolvedValue(undefined),
    };

    planLimits = {
      assertCanAddPatient: jest.fn().mockResolvedValue(undefined),
      assertStorageAvailable: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        PatientPhotoStorageService,
        PatientStatsService,
        PatientEventsService,
        PatientMeasurementsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: R2StorageService, useValue: r2 },
        { provide: CompressionService, useValue: { compress: jest.fn() } },
        { provide: AuditLogService, useValue: auditLog },
        { provide: PlanLimitsService, useValue: planLimits },
      ],
    }).compile();

    service = module.get<PatientsService>(PatientsService);
  });

  describe('list', () => {
    it('should return all patients without search', async () => {
      const result = await service.list();
      expect(result).toEqual([mockPatient]);
      expect(prisma.patient.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { name: 'asc' },
      });
    });

    it('should sign photo url when storage key exists', async () => {
      prisma.patient.findMany.mockResolvedValue([
        { ...mockPatient, photoStorageKey: 'photos/key-1' },
      ]);
      const result = await service.list();
      expect(r2.getPresignedUrl).toHaveBeenCalledWith('photos/key-1', 3600);
      expect(result[0].photoUrl).toBe('https://signed.example/photo.jpg');
    });

    it('should filter by search term', async () => {
      await service.list('João');
      expect(prisma.patient.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: 'João', mode: 'insensitive' } },
            { email: { contains: 'João', mode: 'insensitive' } },
            { phone: { contains: 'João' } },
          ],
        },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return patient with appointments', async () => {
      const result = await service.findOne('patient-1');
      expect(result).toEqual(mockPatient);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.patient.findUnique.mockResolvedValue(null);
      await expect(service.findOne('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create patient and notify admins', async () => {
      const dto = { name: 'João Silva', email: 'joao@email.com', phone: '11999999999' };
      const result = await service.create(dto as any);

      expect(result).toEqual(mockPatient);
      expect(prisma.patient.create).toHaveBeenCalled();
    });

    it('não cria quando o limite de pacientes do plano foi atingido', async () => {
      planLimits.assertCanAddPatient.mockRejectedValue(new ForbiddenException('Limite do plano atingido'));

      await expect(service.create({ name: 'João Silva' } as any)).rejects.toThrow(ForbiddenException);
      expect(prisma.patient.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update patient', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);
      const dto = { name: 'João Santos' };
      const result = await service.update('patient-1', dto as any);
      expect(prisma.patient.update).toHaveBeenCalled();
    });

    it('should update only anamnesis when provided in dto', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);
      const anamnesis = {
        gestante: true,
        queixaPrincipal: 'Acne ativa',
        tabagismo: 'Não',
      };

      await service.update('patient-1', { anamnesis } as any);

      expect(prisma.patient.update).toHaveBeenCalledWith({
        where: { id: 'patient-1' },
        data: expect.objectContaining({ anamnesis }),
      });
    });

    it('should record a measurement when anamnesis weight/height change', async () => {
      prisma.patient.findUnique.mockResolvedValue({ ...mockPatient, anamnesis: { peso: 70, altura: 165 } });

      await service.update('patient-1', { anamnesis: { peso: '68.5', altura: 165 } } as any);

      expect(prisma.patientMeasurement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ patientId: 'patient-1', weightKg: 68.5, heightCm: 165 }),
      });
    });

    it('should convert imported heights in meters to centimeters', async () => {
      prisma.patient.findUnique.mockResolvedValue({ ...mockPatient, anamnesis: { peso: 71, altura: '1,73' } });

      await service.update('patient-1', { anamnesis: { peso: 69, altura: '1,73' } } as any);

      expect(prisma.patientMeasurement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ weightKg: 69, heightCm: 173 }),
      });
    });

    it('should not record a measurement when weight/height are unchanged', async () => {
      prisma.patient.findUnique.mockResolvedValue({ ...mockPatient, anamnesis: { peso: 70, altura: 165 } });

      await service.update('patient-1', { anamnesis: { peso: '70', altura: '165', tabagismo: 'Não' } } as any);

      expect(prisma.patientMeasurement.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if patient does not exist', async () => {
      prisma.patient.findUnique.mockResolvedValue(null);
      await expect(service.update('invalid', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getReliabilityStats', () => {
    it('should return 100% reliability with no history', async () => {
      prisma.appointment.groupBy.mockResolvedValue([]);
      const result = await service.getReliabilityStats('patient-1');
      expect(result.reliabilityPercent).toBe(100);
      expect(result.total).toBe(0);
    });

    it('should compute reliability correctly', async () => {
      prisma.appointment.groupBy.mockResolvedValue([
        { status: 'COMPLETED', _count: { id: 8 } },
        { status: 'CANCELLED', _count: { id: 1 } },
        { status: 'NO_SHOW', _count: { id: 1 } },
      ]);
      const result = await service.getReliabilityStats('patient-1');
      expect(result.reliabilityPercent).toBe(80);
      expect(result.completed).toBe(8);
      expect(result.cancelled).toBe(1);
      expect(result.noShow).toBe(1);
    });
  });

  describe('uploadPhoto', () => {
    it('should throw if R2 is not configured', async () => {
      r2.isConfigured = false;
      const file = { mimetype: 'image/jpeg', size: 1000, buffer: Buffer.from('') } as any;
      await expect(service.uploadPhoto('patient-1', file)).rejects.toThrow(BadRequestException);
    });

    it('should throw for invalid mime type', async () => {
      const file = { mimetype: 'application/pdf', size: 1000, buffer: Buffer.from('') } as any;
      await expect(service.uploadPhoto('patient-1', file)).rejects.toThrow(BadRequestException);
    });

    it('should throw for file too large', async () => {
      const file = { mimetype: 'image/jpeg', size: 10 * 1024 * 1024, buffer: Buffer.from('') } as any;
      await expect(service.uploadPhoto('patient-1', file)).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should delete patient and remove photo if exists', async () => {
      prisma.patient.findUnique.mockResolvedValue({ ...mockPatient, photoStorageKey: 'key-1' });
      await service.remove('patient-1');

      expect(r2.remove).toHaveBeenCalledWith('key-1');
      expect(prisma.patient.delete).toHaveBeenCalledWith({ where: { id: 'patient-1' } });
    });
  });
});
