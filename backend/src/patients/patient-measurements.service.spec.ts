import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PatientMeasurementsService } from './patient-measurements.service';

describe('PatientMeasurementsService', () => {
  let service: PatientMeasurementsService;
  let prisma: any;
  let events: any;

  const row = (over: Record<string, unknown> = {}) => ({
    id: 'm-1',
    patientId: 'patient-1',
    appointmentId: null,
    measuredAt: new Date('2026-10-01T12:00:00Z'),
    weightKg: new Prisma.Decimal('72.40'),
    heightCm: new Prisma.Decimal('165.0'),
    waistCm: null,
    abdomenCm: null,
    hipCm: null,
    notes: null,
    appointment: null,
    ...over,
  });

  beforeEach(() => {
    prisma = {
      patient: {
        findUnique: jest.fn().mockResolvedValue({ id: 'patient-1', anamnesis: { tabagismo: 'Não', peso: 80 } }),
        update: jest.fn().mockResolvedValue({}),
      },
      appointment: {
        findFirst: jest.fn().mockResolvedValue({ id: 'appt-1', startAt: new Date('2026-09-15T13:00:00Z') }),
      },
      patientMeasurement: {
        findMany: jest.fn().mockResolvedValue([row()]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve(row({ ...data, weightKg: data.weightKg ?? null }))),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    events = { created: jest.fn(), updated: jest.fn(), deleted: jest.fn() };
    service = new PatientMeasurementsService(prisma, events);
  });

  it('lists measurements with decimals as numbers', async () => {
    const [m] = await service.list('patient-1');
    expect(m.weightKg).toBe(72.4);
    expect(m.heightCm).toBe(165);
    expect(m.waistCm).toBeNull();
  });

  it('rejects a measurement without any measure', async () => {
    await expect(service.create('patient-1', { notes: 'só nota' })).rejects.toThrow(BadRequestException);
  });

  it('uses the appointment date when measuredAt is omitted', async () => {
    await service.create('patient-1', { appointmentId: 'appt-1', weightKg: 70 });
    expect(prisma.appointment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'appt-1', patientId: 'patient-1' } }),
    );
    expect(prisma.patientMeasurement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ appointmentId: 'appt-1', measuredAt: new Date('2026-09-15T13:00:00Z') }),
      }),
    );
  });

  it('rejects an appointment from another patient', async () => {
    prisma.appointment.findFirst.mockResolvedValue(null);
    await expect(service.create('patient-1', { appointmentId: 'appt-x', weightKg: 70 })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('copies the latest weight and height into the anamnesis', async () => {
    prisma.patientMeasurement.findFirst
      .mockResolvedValueOnce({ weightKg: new Prisma.Decimal('70.5') })
      .mockResolvedValueOnce({ heightCm: new Prisma.Decimal('165.0') });

    await service.create('patient-1', { weightKg: 70.5 });

    expect(prisma.patient.update).toHaveBeenCalledWith({
      where: { id: 'patient-1' },
      data: { anamnesis: { tabagismo: 'Não', peso: 70.5, altura: 165 } },
    });
  });
});
