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
    notes: null,
    appointment: null,
    values: [],
    ...over,
  });

  const waist = { id: 'type-waist', key: null, name: 'Cintura', unit: 'cm', sortOrder: 2, active: true };
  const hip = { id: 'type-hip', key: null, name: 'Quadril', unit: 'cm', sortOrder: 4, active: false };
  const weight = { id: 'type-weight', key: 'weightKg', name: 'Peso', unit: 'kg', sortOrder: 0, active: true };

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
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve(row({ ...data, weightKg: data.weightKg ?? null, values: [] }))),
        update: jest.fn().mockResolvedValue(row()),
        delete: jest.fn(),
      },
      measurementType: {
        findMany: jest.fn().mockResolvedValue([waist, hip]),
      },
    };
    events = { created: jest.fn(), updated: jest.fn(), deleted: jest.fn() };
    service = new PatientMeasurementsService(prisma, events);
  });

  it('lists measurements with decimals as numbers', async () => {
    const [m] = await service.list('patient-1');
    expect(m.weightKg).toBe(72.4);
    expect(m.heightCm).toBe(165);
    expect(m.values).toEqual([]);
  });

  it('returns catalog values with their type, even for an inactive type', async () => {
    prisma.patientMeasurement.findMany.mockResolvedValue([
      row({
        values: [
          { typeId: hip.id, value: new Prisma.Decimal('101.50'), type: { name: 'Quadril', unit: 'cm', sortOrder: 4, active: false } },
        ],
      }),
    ]);
    const [m] = await service.list('patient-1');
    expect(m.values).toEqual([
      { typeId: hip.id, value: 101.5, name: 'Quadril', unit: 'cm', sortOrder: 4, active: false },
    ]);
  });

  it('accepts a measurement with only a catalog value', async () => {
    await service.create('patient-1', { values: [{ typeId: waist.id, value: 80 }] });
    expect(prisma.patientMeasurement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ values: { create: [{ typeId: waist.id, value: 80 }] } }),
      }),
    );
  });

  it('rejects a new value for an inactive type', async () => {
    await expect(
      service.create('patient-1', { weightKg: 70, values: [{ typeId: hip.id, value: 100 }] }),
    ).rejects.toThrow('A medida “Quadril” está desativada.');
  });

  it('rejects basic types sent as catalog values', async () => {
    prisma.measurementType.findMany.mockResolvedValue([weight]);
    await expect(
      service.create('patient-1', { values: [{ typeId: weight.id, value: 70 }] }),
    ).rejects.toThrow(BadRequestException);
  });

  it('edits a value already recorded for an inactive type', async () => {
    prisma.patientMeasurement.findFirst.mockResolvedValueOnce(
      row({ values: [{ typeId: hip.id, value: new Prisma.Decimal('104'), type: hip }] }),
    );
    await service.update('patient-1', 'm-1', { values: [{ typeId: hip.id, value: 101 }] });
    expect(prisma.patientMeasurement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          values: { deleteMany: { typeId: { in: [hip.id] } }, create: [{ typeId: hip.id, value: 101 }] },
        }),
      }),
    );
  });

  it('removing the only measure is rejected', async () => {
    prisma.patientMeasurement.findFirst.mockResolvedValueOnce(
      row({ weightKg: null, heightCm: null, values: [{ typeId: waist.id, value: new Prisma.Decimal('80'), type: waist }] }),
    );
    await expect(
      service.update('patient-1', 'm-1', { values: [{ typeId: waist.id, value: null }] }),
    ).rejects.toThrow('Informe ao menos uma medida.');
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
