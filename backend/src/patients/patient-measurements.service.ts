import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PatientMeasurement, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AuditUser } from '../audit-log/audit-log.service';
import { PatientEventsService } from './patient-events.service';
import { CreatePatientMeasurementDto, UpdatePatientMeasurementDto } from './dto/patient-measurement.dto';

const MEASURE_FIELDS = ['weightKg', 'heightCm', 'waistCm', 'abdomenCm', 'hipCm'] as const;
type MeasureField = (typeof MEASURE_FIELDS)[number];

const APPOINTMENT_SELECT = {
  id: true,
  startAt: true,
  kind: true,
  procedure: { select: { name: true } },
} as const;

type MeasurementWithAppointment = PatientMeasurement & {
  appointment: { id: string; startAt: Date; kind: string; procedure: { name: string } | null } | null;
};

const toNumber = (value: Prisma.Decimal | null) => (value == null ? null : Number(value));

function parseAnamnesisNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const anamnesisWeight = (value: unknown) => {
  const kg = parseAnamnesisNumber(value);
  return kg != null && kg <= 500 ? Math.round(kg * 100) / 100 : null;
};

// Fichas importadas trazem altura em metros ("1,73"); o formulário usa centímetros
const anamnesisHeight = (value: unknown) => {
  const raw = parseAnamnesisNumber(value);
  const cm = raw != null && raw < 3 ? raw * 100 : raw;
  return cm != null && cm >= 30 && cm <= 260 ? Math.round(cm * 10) / 10 : null;
};

/**
 * Histórico de medidas corporais. Peso e altura da anamnese espelham a medição mais recente:
 * salvar a anamnese com valores novos registra uma medição, e mexer no histórico atualiza a anamnese.
 */
@Injectable()
export class PatientMeasurementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: PatientEventsService,
  ) {}

  async list(patientId: string) {
    await this.findPatientOrThrow(patientId);
    const rows = await this.prisma.patientMeasurement.findMany({
      where: { patientId },
      orderBy: [{ measuredAt: 'desc' }, { createdAt: 'desc' }],
      include: { appointment: { select: APPOINTMENT_SELECT } },
    });
    return rows.map((row) => this.serialize(row));
  }

  async create(patientId: string, dto: CreatePatientMeasurementDto, user?: AuditUser) {
    await this.findPatientOrThrow(patientId);
    this.assertHasMeasure(dto);
    const appointment = dto.appointmentId ? await this.findAppointmentOrThrow(patientId, dto.appointmentId) : null;

    const created = await this.prisma.patientMeasurement.create({
      data: {
        patientId,
        appointmentId: appointment?.id ?? null,
        measuredAt: dto.measuredAt ? new Date(dto.measuredAt) : (appointment?.startAt ?? new Date()),
        ...this.measureData(dto),
        notes: dto.notes?.trim() || null,
      },
      include: { appointment: { select: APPOINTMENT_SELECT } },
    });
    this.events.created('PatientMeasurement', created.id, created, user);
    await this.syncAnamnesis(patientId);
    return this.serialize(created);
  }

  async update(patientId: string, measurementId: string, dto: UpdatePatientMeasurementDto, user?: AuditUser) {
    const existing = await this.findMeasurementOrThrow(patientId, measurementId);
    const merged = { ...this.serialize({ ...existing, appointment: null }), ...dto };
    this.assertHasMeasure(merged);

    let appointmentId: string | null | undefined;
    if (dto.appointmentId !== undefined) {
      appointmentId = dto.appointmentId ? (await this.findAppointmentOrThrow(patientId, dto.appointmentId)).id : null;
    }

    const updated = await this.prisma.patientMeasurement.update({
      where: { id: measurementId },
      data: {
        ...(appointmentId !== undefined ? { appointmentId } : {}),
        ...(dto.measuredAt ? { measuredAt: new Date(dto.measuredAt) } : {}),
        ...this.measureData(dto),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
      },
      include: { appointment: { select: APPOINTMENT_SELECT } },
    });
    this.events.updated('PatientMeasurement', measurementId, existing, updated, user);
    await this.syncAnamnesis(patientId);
    return this.serialize(updated);
  }

  async remove(patientId: string, measurementId: string, user?: AuditUser) {
    const existing = await this.findMeasurementOrThrow(patientId, measurementId);
    await this.prisma.patientMeasurement.delete({ where: { id: measurementId } });
    this.events.deleted('PatientMeasurement', measurementId, existing, user);
    await this.syncAnamnesis(patientId);
    return { ok: true };
  }

  /** Chamado ao salvar a anamnese: peso/altura diferentes dos anteriores viram uma medição de hoje. */
  async recordFromAnamnesis(patientId: string, before: unknown, after: unknown, user?: AuditUser) {
    const prev = (before ?? {}) as Record<string, unknown>;
    const next = (after ?? {}) as Record<string, unknown>;
    const weightKg = anamnesisWeight(next.peso);
    const heightCm = anamnesisHeight(next.altura);
    const weightChanged = weightKg != null && weightKg !== anamnesisWeight(prev.peso);
    const heightChanged = heightCm != null && heightCm !== anamnesisHeight(prev.altura);
    if (!weightChanged && !heightChanged) return;

    const created = await this.prisma.patientMeasurement.create({
      data: {
        patientId,
        measuredAt: new Date(),
        weightKg,
        heightCm,
        notes: 'Registrado pela anamnese',
      },
    });
    this.events.created('PatientMeasurement', created.id, created, user);
  }

  /** Copia o peso e a altura mais recentes do histórico para a anamnese. */
  private async syncAnamnesis(patientId: string) {
    const [latestWeight, latestHeight, patient] = await Promise.all([
      this.prisma.patientMeasurement.findFirst({
        where: { patientId, weightKg: { not: null } },
        orderBy: [{ measuredAt: 'desc' }, { createdAt: 'desc' }],
        select: { weightKg: true },
      }),
      this.prisma.patientMeasurement.findFirst({
        where: { patientId, heightCm: { not: null } },
        orderBy: [{ measuredAt: 'desc' }, { createdAt: 'desc' }],
        select: { heightCm: true },
      }),
      this.prisma.patient.findUnique({ where: { id: patientId }, select: { anamnesis: true } }),
    ]);
    if (!latestWeight && !latestHeight) return;

    const anamnesis = { ...((patient?.anamnesis ?? {}) as Record<string, unknown>) };
    if (latestWeight) anamnesis.peso = toNumber(latestWeight.weightKg);
    if (latestHeight) anamnesis.altura = toNumber(latestHeight.heightCm);
    await this.prisma.patient.update({
      where: { id: patientId },
      data: { anamnesis: anamnesis as Prisma.InputJsonValue },
    });
  }

  private measureData(dto: Partial<Record<MeasureField, number | null>>) {
    const data: Partial<Record<MeasureField, number | null>> = {};
    for (const field of MEASURE_FIELDS) {
      if (dto[field] !== undefined) data[field] = dto[field];
    }
    return data;
  }

  private assertHasMeasure(dto: Partial<Record<MeasureField, number | null>>) {
    if (!MEASURE_FIELDS.some((field) => dto[field] != null)) {
      throw new BadRequestException('Informe ao menos uma medida.');
    }
  }

  private serialize(row: MeasurementWithAppointment) {
    return {
      ...row,
      weightKg: toNumber(row.weightKg),
      heightCm: toNumber(row.heightCm),
      waistCm: toNumber(row.waistCm),
      abdomenCm: toNumber(row.abdomenCm),
      hipCm: toNumber(row.hipCm),
    };
  }

  private async findPatientOrThrow(id: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id }, select: { id: true } });
    if (!patient) throw new NotFoundException('Paciente não encontrado');
    return patient;
  }

  private async findAppointmentOrThrow(patientId: string, appointmentId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, patientId },
      select: { id: true, startAt: true },
    });
    if (!appointment) throw new NotFoundException('Agendamento não encontrado para este paciente');
    return appointment;
  }

  private async findMeasurementOrThrow(patientId: string, measurementId: string) {
    const measurement = await this.prisma.patientMeasurement.findFirst({ where: { id: measurementId, patientId } });
    if (!measurement) throw new NotFoundException('Medição não encontrada');
    return measurement;
  }
}
