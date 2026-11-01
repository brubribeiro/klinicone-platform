import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';

import { AuditLogService, AuditUser } from '../audit-log/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';

type AuditedEntity = 'Patient' | 'PatientPhoto' | 'PatientMeasurement';

const asRecord = (value: unknown) => value as Record<string, unknown>;

/** Auditoria e notificações de pacientes (fire-and-forget: falhas não afetam a operação). */
@Injectable()
export class PatientEventsService {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly auditLog: AuditLogService,
  ) {}

  async patientCreated(patient: { id: string; name: string }, user?: AuditUser) {
    this.created('Patient', patient.id, patient, user);

    // Notifica usuários com permissão de gerenciar usuários (= admins normalmente)
    const admins = await this.notifications.findUsersWithPermission('users:view');
    this.notifications
      .notifyMany(
        admins.map((a) => a.id),
        {
          type: NotificationType.PATIENT_CREATED,
          title: 'Novo paciente cadastrado',
          message: patient.name,
          link: '/pacientes',
          metadata: { patientId: patient.id },
        },
      )
      .catch(() => undefined);
  }

  created(entity: AuditedEntity, id: string, data: unknown, user?: AuditUser) {
    this.auditLog.logCreate(entity, id, asRecord(data), user).catch(() => undefined);
  }

  updated(entity: AuditedEntity, id: string, before: unknown, after: unknown, user?: AuditUser) {
    this.auditLog.logUpdate(entity, id, asRecord(before), asRecord(after), user).catch(() => undefined);
  }

  deleted(entity: AuditedEntity, id: string, data: unknown, user?: AuditUser) {
    this.auditLog.logDelete(entity, id, asRecord(data), user).catch(() => undefined);
  }
}
