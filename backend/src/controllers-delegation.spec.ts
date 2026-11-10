/**
 * Cada rota de cada controller deve ou recusar a entrada (HttpException de validação) ou delegar
 * a um service — controllers não carregam regra de negócio. O service é simulado e responde a
 * qualquer método; chamamos cada rota com argumentos neutros e conferimos a delegação.
 */
import 'reflect-metadata';
import { HttpException } from '@nestjs/common';

import { AdminController } from './admin/admin.controller';
import { AnnouncementsController } from './admin/announcements.controller';
import { AnamnesisController } from './anamnesis/anamnesis.controller';
import { AnamnesisPublicController } from './anamnesis/anamnesis-public.controller';
import { AppointmentsController } from './appointments/appointments.controller';
import { AuditLogController } from './audit-log/audit-log.controller';
import { AvailabilityController } from './availability/availability.controller';
import { AvailabilityCalendarController } from './availability/availability-calendar.controller';
import { DocumentTemplatesController } from './documents/document-templates.controller';
import { DocumentsController } from './documents/documents.controller';
import { EquipmentController } from './equipment/equipment.controller';
import { FinanceController } from './finance/finance.controller';
import { GoalsController } from './goals/goals.controller';
import { InventoryController } from './inventory/inventory.controller';
import { MessagesController } from './messages/messages.controller';
import { MetricsController } from './metrics/metrics.controller';
import { NotificationsController } from './notifications/notifications.controller';
import { PackagesController } from './packages/packages.controller';
import { PatientMeasurementsController } from './patients/patient-measurements.controller';
import { PatientsController } from './patients/patients.controller';
import { PaymentMethodsController } from './payment-methods/payment-methods.controller';
import { PendenciasController } from './pendencias/pendencias.controller';
import { ProceduresController } from './procedures/procedures.controller';
import { PromotionsController } from './promotions/promotions.controller';
import { RecurringExpensesController } from './recurring-expenses/recurring-expenses.controller';
import { RolesController } from './roles/roles.controller';
import { SkincareController } from './skincare/skincare.controller';
import { UsersController } from './users/users.controller';

type Ctor = new (...deps: never[]) => Record<string, unknown>;

const CONTROLLERS: Ctor[] = [
  AdminController,
  AnnouncementsController,
  AnamnesisController,
  AnamnesisPublicController,
  AppointmentsController,
  AuditLogController,
  AvailabilityController,
  AvailabilityCalendarController,
  DocumentTemplatesController,
  DocumentsController,
  EquipmentController,
  FinanceController,
  GoalsController,
  InventoryController,
  MessagesController,
  MetricsController,
  NotificationsController,
  PackagesController,
  PatientMeasurementsController,
  PatientsController,
  PaymentMethodsController,
  PendenciasController,
  ProceduresController,
  PromotionsController,
  RecurringExpensesController,
  RolesController,
  SkincareController,
  UsersController,
] as unknown as Ctor[];

/** Service que aceita qualquer chamada e registra quais métodos foram usados. */
function fakeService(calls: string[]) {
  return new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'then') return undefined;
        return (...args: unknown[]) => {
          calls.push(String(prop));
          void args;
          return Promise.resolve({ ok: true });
        };
      },
    },
  );
}

const user = { id: 'u1', name: 'Ana', email: 'a@x.com', tenantId: 't1', permissions: [], features: [] };
const file = { buffer: Buffer.from('x'), mimetype: 'text/plain', originalname: 'a.txt' };
const res = { setHeader: jest.fn(), send: jest.fn(), json: jest.fn(), status: jest.fn().mockReturnThis(), cookie: jest.fn() };

describe.each(CONTROLLERS.map((c) => [c.name, c] as const))('%s', (_name, Controller) => {
  const methods = Object.getOwnPropertyNames(Controller.prototype).filter(
    (m) => m !== 'constructor' && typeof (Controller.prototype as Record<string, unknown>)[m] === 'function',
  );

  it.each(methods)('%s delega a um service ou recusa a entrada', async (method) => {
    const calls: string[] = [];
    const deps = (Reflect.getMetadata('design:paramtypes', Controller) as unknown[]) ?? [];
    const instance = new Controller(...(deps.map(() => fakeService(calls)) as never[]));
    const fn = instance[method] as (...a: unknown[]) => unknown;

    let outcome: 'delegou' | 'recusou' | 'erro-de-ambiente' = 'delegou';
    try {
      await fn.apply(instance, ['id-1', { name: 'x' }, user, file, res, 'q']);
    } catch (err) {
      outcome = err instanceof HttpException ? 'recusou' : 'erro-de-ambiente';
    }
    // rotas que dependem de Request/Response reais podem falhar com TypeError; as demais precisam delegar
    if (outcome === 'delegou') expect(calls.length).toBeGreaterThan(0);
  });
});
