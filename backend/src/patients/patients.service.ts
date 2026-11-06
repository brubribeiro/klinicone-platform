import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PatientPhotoPhase, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { AuditUser } from '../audit-log/audit-log.service';
import { normalizePatientWritableFields } from './patient-fields.util';
import { PatientPhotoStorageService } from './patient-photo-storage.service';
import { PatientStatsService } from './patient-stats.service';
import { PatientEventsService } from './patient-events.service';
import { PatientMeasurementsService } from './patient-measurements.service';
import { PlanLimitsService } from '../plan-limits/plan-limits.service';

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly photos: PatientPhotoStorageService,
    private readonly patientStats: PatientStatsService,
    private readonly events: PatientEventsService,
    private readonly measurements: PatientMeasurementsService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  async list(search?: string) {
    const patients = await this.prisma.patient.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
              { document: { contains: search } },
            ],
          }
        : undefined,
      orderBy: { name: 'asc' },
    });

    return this.photos.withAccessUrls(await this.patientStats.withListStats(patients));
  }

  /** Estatísticas agregadas para os cards da tela de pacientes. */
  stats() {
    return this.patientStats.overview();
  }

  async findOne(id: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      include: {
        appointments: {
          orderBy: { startAt: 'desc' },
          include: {
            procedure: { select: { id: true, name: true, price: true } },
            professional: { select: { id: true, name: true } },
            financialEntries: {
              where: { type: 'INCOME' },
              select: {
                id: true,
                amount: true,
                netAmount: true,
                paymentMethod: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    if (!patient) throw new NotFoundException('Paciente não encontrado');

    // Resumo: visitas, última visita e total gasto
    const completed = patient.appointments.filter((a) => a.status === 'COMPLETED');
    const visits = completed.length;
    const lastVisit = completed.length
      ? completed.reduce((max, a) => (a.startAt > max ? a.startAt : max), completed[0].startAt)
      : null;
    const totalSpent = await this.patientStats.totalSpent(id);

    const withUrl = await this.photos.withAccessUrl(patient);
    return { ...withUrl, visits, lastVisit, totalSpent };
  }

  /** URL temporária assinada para foto privada no R2. */
  async getPhotoAccessUrl(id: string): Promise<{ url: string }> {
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      select: { photoStorageKey: true },
    });
    if (!patient) throw new NotFoundException('Paciente não encontrado');
    if (!patient.photoStorageKey) {
      throw new NotFoundException('Paciente não possui foto.');
    }
    if (!this.photos.isConfigured) {
      throw new BadRequestException('Cloudflare R2 não está configurado.');
    }
    return { url: await this.photos.getSignedUrl(patient.photoStorageKey) };
  }

  async create(dto: CreatePatientDto, user?: AuditUser) {
    await this.planLimits.assertCanAddPatient();
    const patient = await this.prisma.patient.create({
      data: normalizePatientWritableFields(dto) as Prisma.PatientUncheckedCreateInput,
    });
    await this.events.patientCreated(patient, user);
    return this.photos.withAccessUrl(patient);
  }

  async update(id: string, dto: UpdatePatientDto, user?: AuditUser) {
    const oldPatient = await this.findPatientOrThrow(id);
    const updated = await this.updateAndAudit(
      oldPatient,
      normalizePatientWritableFields(dto) as Prisma.PatientUncheckedUpdateInput,
      user,
    );
    if (dto.anamnesis !== undefined) {
      await this.measurements.recordFromAnamnesis(id, oldPatient.anamnesis, dto.anamnesis, user);
    }
    return updated;
  }

  /**
   * Retorna estatísticas de confiabilidade do paciente baseado no histórico de agendamentos.
   */
  getReliabilityStats(patientId: string) {
    return this.patientStats.reliability(patientId);
  }

  async uploadPhoto(id: string, file: Express.Multer.File, user?: AuditUser) {
    this.photos.assertUploadable(file, { checkSize: true });

    const oldPatient = await this.findPatientOrThrow(id);
    if (oldPatient.photoStorageKey) {
      await this.photos.remove(oldPatient.photoStorageKey);
    }
    // uploadProfilePhoto revalida magic bytes
    const key = await this.photos.uploadProfilePhoto(id, file);
    return this.updateAndAudit(oldPatient, { photoStorageKey: key, photoUrl: null }, user);
  }

  async removePhoto(id: string, user?: AuditUser) {
    const oldPatient = await this.findPatientOrThrow(id);
    if (oldPatient.photoStorageKey) {
      await this.photos.remove(oldPatient.photoStorageKey);
    }
    return this.updateAndAudit(oldPatient, { photoStorageKey: null, photoUrl: null }, user);
  }

  // ─── Fotos "antes e depois" ───

  async listPhotos(patientId: string) {
    const photos = await this.prisma.patientPhoto.findMany({
      where: { patientId },
      orderBy: [{ takenAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        appointment: {
          select: { id: true, startAt: true, kind: true, procedure: { select: { name: true } } },
        },
      },
    });
    if (!this.photos.isConfigured) {
      return photos.map((p) => ({ ...p, url: null as string | null }));
    }
    return Promise.all(
      photos.map(async (p) => ({ ...p, url: await this.photos.signOrNull(p.storageKey) })),
    );
  }

  async addPhoto(
    patientId: string,
    file: Express.Multer.File,
    dto: { appointmentId: string; phase: PatientPhotoPhase; label?: string; pairId?: string; takenAt?: string },
    user?: AuditUser,
  ) {
    this.photos.assertUploadable(file, { checkSize: false });
    await this.findPatientOrThrow(patientId);

    const appointment = await this.prisma.appointment.findFirst({
      where: { id: dto.appointmentId, patientId },
    });
    if (!appointment) throw new NotFoundException('Agendamento não encontrado para este paciente');

    const uploaded = await this.photos.uploadGalleryPhoto(patientId, dto.phase, file);
    const created = await this.prisma.patientPhoto.create({
      data: {
        patientId,
        appointmentId: dto.appointmentId,
        phase: dto.phase,
        label: dto.label?.trim() || null,
        pairId: dto.pairId || null,
        takenAt: dto.takenAt ? new Date(dto.takenAt) : appointment.startAt,
        storageKey: uploaded.key,
        mimeType: uploaded.mimeType,
        size: uploaded.size,
      },
    });
    this.events.created('PatientPhoto', created.id, created, user);

    const url = await this.photos.signOrNull(uploaded.key);
    return { ...created, url };
  }

  async removePhotoEntry(patientId: string, photoId: string, user?: AuditUser) {
    const photo = await this.prisma.patientPhoto.findFirst({ where: { id: photoId, patientId } });
    if (!photo) throw new NotFoundException('Foto não encontrada');
    if (photo.storageKey) await this.photos.remove(photo.storageKey).catch(() => undefined);
    await this.prisma.patientPhoto.delete({ where: { id: photoId } });
    this.events.deleted('PatientPhoto', photoId, photo, user);
    return { ok: true };
  }

  async remove(id: string, user?: AuditUser) {
    const patient = await this.findOne(id);
    if (patient.photoStorageKey) {
      await this.photos.remove(patient.photoStorageKey);
    }
    await this.prisma.patient.delete({ where: { id } });
    this.events.deleted('Patient', id, patient, user);
    return { ok: true };
  }

  private async findPatientOrThrow(id: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id } });
    if (!patient) throw new NotFoundException('Paciente não encontrado');
    return patient;
  }

  private async updateAndAudit(
    oldPatient: { id: string },
    data: Prisma.PatientUncheckedUpdateInput,
    user?: AuditUser,
  ) {
    const updated = await this.prisma.patient.update({ where: { id: oldPatient.id }, data });
    this.events.updated('Patient', oldPatient.id, oldPatient, updated, user);
    return this.photos.withAccessUrl(updated);
  }
}
