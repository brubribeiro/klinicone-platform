import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  MessageDispatchSource,
  MessageDispatchStatus,
  MessageTrigger,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  addDaysToIsoDate,
  brazilDayBoundsUtc,
  getBrazilYmd,
} from '../common/utils/brazil-time.util';
import {
  renderMessageTemplate,
  varsFromAppointmentRow,
  whatsappMeUrl,
} from '../common/utils/whatsapp.util';

const apptInclude = {
  patient: { select: { id: true, name: true, phone: true } },
  procedure: { select: { id: true, name: true } },
  professional: { select: { name: true } },
} as const;

@Injectable()
export class MessageDispatchService {
  private readonly logger = new Logger(MessageDispatchService.name);

  constructor(private readonly prisma: PrismaService) {}

  listPending(limit = 50) {
    return this.prisma.messageDispatch.findMany({
      where: { status: MessageDispatchStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: {
        template: { select: { id: true, name: true, trigger: true } },
        patient: { select: { id: true, name: true, phone: true } },
        appointment: {
          select: { id: true, startAt: true, procedure: { select: { name: true } } },
        },
      },
    });
  }

  async markSent(id: string) {
    const row = await this.prisma.messageDispatch.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Envio não encontrado');
    if (row.status === MessageDispatchStatus.SENT) return row;
    return this.prisma.messageDispatch.update({
      where: { id },
      data: { status: MessageDispatchStatus.SENT, sentAt: new Date() },
    });
  }

  /** Registra envio manual (deep link aberto pelo painel). */
  async recordManualSend(input: {
    templateId: string;
    patientId: string;
    appointmentId?: string | null;
    phone?: string | null;
    renderedMessage: string;
  }) {
    const template = await this.prisma.messageTemplate.findUnique({ where: { id: input.templateId } });
    if (!template) throw new NotFoundException('Template não encontrado');

    const dedupKey = `MANUAL:${input.templateId}:${input.patientId}:${input.appointmentId ?? 'none'}:${Date.now()}`;
    const phone = input.phone?.trim() || null;
    const waMeUrl = phone ? whatsappMeUrl(phone, input.renderedMessage) : null;

    return this.prisma.messageDispatch.create({
      data: {
        templateId: input.templateId,
        patientId: input.patientId,
        appointmentId: input.appointmentId ?? null,
        trigger: template.trigger,
        dedupKey,
        phone,
        renderedMessage: input.renderedMessage,
        waMeUrl,
        status: MessageDispatchStatus.SENT,
        source: MessageDispatchSource.MANUAL,
        sentAt: new Date(),
      },
    });
  }

  /** Chamado pelo scheduler (1×/h por clínica): enfileira envios automáticos pendentes. */
  async processAutoTriggers(clinicName: string) {
    const templates = await this.prisma.messageTemplate.findMany({
      where: {
        active: true,
        trigger: { not: MessageTrigger.MANUAL },
      },
    });
    if (templates.length === 0) return;

    const byTrigger = new Map<MessageTrigger, typeof templates>();
    for (const t of templates) {
      const list = byTrigger.get(t.trigger) ?? [];
      list.push(t);
      byTrigger.set(t.trigger, list);
    }

    let created = 0;
    if (byTrigger.has(MessageTrigger.ON_BOOKING)) {
      created += await this.enqueueOnBooking(byTrigger.get(MessageTrigger.ON_BOOKING)!, clinicName);
    }
    if (byTrigger.has(MessageTrigger.DAY_BEFORE)) {
      created += await this.enqueueDayBefore(byTrigger.get(MessageTrigger.DAY_BEFORE)!, clinicName);
    }
    if (byTrigger.has(MessageTrigger.BIRTHDAY)) {
      created += await this.enqueueBirthdays(byTrigger.get(MessageTrigger.BIRTHDAY)!, clinicName);
    }
    if (byTrigger.has(MessageTrigger.AFTER_APPOINTMENT)) {
      created += await this.enqueueAfterAppointment(byTrigger.get(MessageTrigger.AFTER_APPOINTMENT)!, clinicName);
    }
    if (byTrigger.has(MessageTrigger.INACTIVE_90_DAYS)) {
      created += await this.enqueueInactive90(byTrigger.get(MessageTrigger.INACTIVE_90_DAYS)!, clinicName);
    }

    if (created > 0) {
      this.logger.log(`Gatilhos WhatsApp: ${created} envio(s) enfileirado(s)`);
    }
  }

  private async enqueueOnBooking(templates: { id: string; procedureId: string | null; content: string }[], clinicName: string) {
    const since = new Date(Date.now() - 72 * 60 * 60 * 1000);
    const appts = await this.prisma.appointment.findMany({
      where: {
        createdAt: { gte: since },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        startAt: { gt: new Date() },
      },
      include: apptInclude,
    });
    let n = 0;
    for (const appt of appts) {
      for (const template of templates) {
        if (template.procedureId && template.procedureId !== appt.procedureId) continue;
        const ok = await this.tryCreateDispatch({
          template,
          trigger: MessageTrigger.ON_BOOKING,
          dedupKey: `ON_BOOKING:${appt.id}:${template.id}`,
          patientId: appt.patientId,
          appointmentId: appt.id,
          phone: appt.patient.phone,
          vars: varsFromAppointmentRow({ ...appt, clinica: clinicName }),
        });
        if (ok) n++;
      }
    }
    return n;
  }

  private async enqueueDayBefore(templates: { id: string; procedureId: string | null; content: string }[], clinicName: string) {
    const tomorrowIso = addDaysToIsoDate(getBrazilYmd().iso, 1);
    const { from, to } = brazilDayBoundsUtc(tomorrowIso);
    const appts = await this.prisma.appointment.findMany({
      where: {
        startAt: { gte: from, lte: to },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
      include: apptInclude,
    });
    let n = 0;
    for (const appt of appts) {
      for (const template of templates) {
        if (template.procedureId && template.procedureId !== appt.procedureId) continue;
        const ok = await this.tryCreateDispatch({
          template,
          trigger: MessageTrigger.DAY_BEFORE,
          dedupKey: `DAY_BEFORE:${appt.id}:${template.id}`,
          patientId: appt.patientId,
          appointmentId: appt.id,
          phone: appt.patient.phone,
          vars: varsFromAppointmentRow({ ...appt, clinica: clinicName }),
        });
        if (ok) n++;
      }
    }
    return n;
  }

  private async enqueueBirthdays(templates: { id: string; procedureId: string | null; content: string }[], clinicName: string) {
    const { m, d, y } = getBrazilYmd();
    const patients = await this.prisma.patient.findMany({
      where: { birthDate: { not: null } },
      select: { id: true, name: true, phone: true, birthDate: true },
    });
    let n = 0;
    for (const patient of patients) {
      if (!patient.birthDate) continue;
      const bday = getBrazilYmd(patient.birthDate);
      if (bday.m !== m || bday.d !== d) continue;

      for (const template of templates) {
        if (template.procedureId) continue;
        const ok = await this.tryCreateDispatch({
          template,
          trigger: MessageTrigger.BIRTHDAY,
          dedupKey: `BIRTHDAY:${patient.id}:${template.id}:${y}`,
          patientId: patient.id,
          appointmentId: null,
          phone: patient.phone,
          vars: {
            paciente_nome: patient.name.split(/\s+/)[0],
            clinica: clinicName,
          },
        });
        if (ok) n++;
      }
    }
    return n;
  }

  private async enqueueAfterAppointment(
    templates: { id: string; procedureId: string | null; content: string }[],
    clinicName: string,
  ) {
    const since = new Date(Date.now() - 36 * 60 * 60 * 1000);
    const appts = await this.prisma.appointment.findMany({
      where: {
        status: 'COMPLETED',
        OR: [{ finishedAt: { gte: since } }, { finishedAt: null, endAt: { gte: since } }],
      },
      include: apptInclude,
    });
    let n = 0;
    for (const appt of appts) {
      for (const template of templates) {
        if (template.procedureId && template.procedureId !== appt.procedureId) continue;
        const ok = await this.tryCreateDispatch({
          template,
          trigger: MessageTrigger.AFTER_APPOINTMENT,
          dedupKey: `AFTER_APPOINTMENT:${appt.id}:${template.id}`,
          patientId: appt.patientId,
          appointmentId: appt.id,
          phone: appt.patient.phone,
          vars: varsFromAppointmentRow({ ...appt, clinica: clinicName }),
        });
        if (ok) n++;
      }
    }
    return n;
  }

  private async enqueueInactive90(templates: { id: string; procedureId: string | null; content: string }[], clinicName: string) {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const patients = await this.prisma.patient.findMany({
      select: { id: true, name: true, phone: true },
    });
    let n = 0;
    for (const patient of patients) {
      const hasCompleted = await this.prisma.appointment.findFirst({
        where: { patientId: patient.id, status: 'COMPLETED' },
        select: { id: true },
      });
      if (!hasCompleted) continue;

      const recent = await this.prisma.appointment.findFirst({
        where: {
          patientId: patient.id,
          startAt: { gte: cutoff },
          status: { notIn: ['CANCELLED'] },
        },
        select: { id: true },
      });
      if (recent) continue;

      const lastAppt = await this.prisma.appointment.findFirst({
        where: {
          patientId: patient.id,
          status: { notIn: ['CANCELLED'] },
        },
        orderBy: { startAt: 'desc' },
        include: apptInclude,
      });
      if (!lastAppt || lastAppt.startAt.getTime() > cutoff.getTime()) continue;

      for (const template of templates) {
        if (template.procedureId) {
          if (lastAppt.procedureId !== template.procedureId) continue;
        }
        const ok = await this.tryCreateDispatch({
          template,
          trigger: MessageTrigger.INACTIVE_90_DAYS,
          dedupKey: `INACTIVE_90_DAYS:${patient.id}:${template.id}:${lastAppt.id}`,
          patientId: patient.id,
          appointmentId: lastAppt.id,
          phone: patient.phone,
          vars: varsFromAppointmentRow({ ...lastAppt, clinica: clinicName }),
        });
        if (ok) n++;
      }
    }
    return n;
  }

  private async tryCreateDispatch(input: {
    template: { id: string; content: string };
    trigger: MessageTrigger;
    dedupKey: string;
    patientId: string;
    appointmentId: string | null;
    phone: string | null;
    vars: ReturnType<typeof varsFromAppointmentRow>;
  }): Promise<boolean> {
    const renderedMessage = renderMessageTemplate(input.template.content, input.vars);
    const phone = input.phone?.trim() || null;
    const waMeUrl = phone ? whatsappMeUrl(phone, renderedMessage) : null;
    const status =
      phone && waMeUrl ? MessageDispatchStatus.PENDING : MessageDispatchStatus.SKIPPED;

    try {
      await this.prisma.messageDispatch.create({
        data: {
          templateId: input.template.id,
          patientId: input.patientId,
          appointmentId: input.appointmentId,
          trigger: input.trigger,
          dedupKey: input.dedupKey,
          phone,
          renderedMessage,
          waMeUrl,
          status,
          source: MessageDispatchSource.AUTO,
        },
      });
      return true;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return false;
      }
      throw e;
    }
  }
}
