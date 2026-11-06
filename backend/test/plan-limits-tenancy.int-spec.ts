/**
 * Limites de plano e isolamento entre clínicas nos services mais novos (pacotes, promoções,
 * formas de pagamento, estoque, anamnese, medidas), com Nest + Postgres reais.
 * Complementa tenant-isolation.int-spec.ts (pacientes, agenda, financeiro, usuários, auth).
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AnamnesisKind, AppointmentStatus, Prisma, PrismaClient } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { AppointmentsService } from '../src/appointments/appointments.service';
import { PackagesService } from '../src/packages/packages.service';
import { PromotionsService } from '../src/promotions/promotions.service';
import { PaymentMethodsService } from '../src/payment-methods/payment-methods.service';
import { InventoryService } from '../src/inventory/inventory.service';
import { AnamnesisService } from '../src/anamnesis/anamnesis.service';
import { PatientsService } from '../src/patients/patients.service';
import { UsersService } from '../src/users/users.service';
import { PlanLimitsService } from '../src/plan-limits/plan-limits.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestClinic, purgeTenants, testSuffix, TestClinic } from './helpers/test-clinic';

jest.setTimeout(60_000);

const suffix = testSuffix();
const base = new PrismaClient();

let moduleRef: TestingModule;
let prisma: PrismaService;
let A: TestClinic;
let B: TestClinic;
const planIds: string[] = [];

beforeAll(async () => {
  moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  prisma = moduleRef.get(PrismaService);
  A = await createTestClinic(base, 'LimA', suffix);
  B = await createTestClinic(base, 'LimB', suffix);
});

afterAll(async () => {
  await new Promise((r) => setTimeout(r, 500));
  if (A && B) await purgeTenants(base, [A.tenant.id, B.tenant.id]);
  await base.plan.deleteMany({ where: { id: { in: planIds } } });
  await moduleRef?.close();
  await base.$disconnect();
});

async function setPlan(clinic: TestClinic, limits: Prisma.InputJsonObject) {
  const plan = await base.plan.create({
    data: { name: `Plano ${suffix} ${planIds.length}`, slug: `plano-${suffix}-${planIds.length}`, limits },
  });
  planIds.push(plan.id);
  await base.tenant.update({ where: { id: clinic.tenant.id }, data: { planId: plan.id } });
}

describe('limites do plano', () => {
  afterEach(async () => {
    await base.tenant.updateMany({ where: { id: { in: [A.tenant.id, B.tenant.id] } }, data: { planId: null } });
  });

  it('pacientes: bloqueia acima do limite, contando só a própria clínica', async () => {
    const patients = moduleRef.get(PatientsService);
    // a outra clínica ter muitos pacientes não consome a vaga desta
    await B.as(() => patients.create({ name: `B1 ${suffix}` }));
    await B.as(() => patients.create({ name: `B2 ${suffix}` }));

    await setPlan(A, { maxPatients: 2 });
    const before = await A.as(() => prisma.patient.count());
    expect(before).toBe(0);
    await A.as(() => patients.create({ name: `A1 ${suffix}` }));
    await A.as(() => patients.create({ name: `A2 ${suffix}` }));
    await expect(A.as(() => patients.create({ name: `A3 ${suffix}` }))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(A.as(() => patients.create({ name: `A3 ${suffix}` }))).rejects.toThrow('até 2 paciente(s)');
  });

  it('usuários: só ativos ocupam vaga; reativar respeita o limite', async () => {
    const users = moduleRef.get(UsersService);
    const limits = moduleRef.get(PlanLimitsService);
    await setPlan(B, { maxUsers: 2 });

    // admin já ocupa 1 vaga
    const second = await B.as(() =>
      users.create({ name: 'Segundo', email: `segundo-${suffix}@fluxos.test`, roleId: B.adminRole.id } as never, B.actor),
    );
    await expect(B.as(() => limits.assertCanAddUser())).rejects.toThrow('até 2 usuário(s) ativo(s)');
    await expect(
      B.as(() => users.create({ name: 'Terceiro', email: `terceiro-${suffix}@fluxos.test`, roleId: B.adminRole.id } as never, B.actor)),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // inativo pode ser criado e não conta
    const inactive = await B.as(() =>
      users.create(
        { name: 'Inativo', email: `inativo-${suffix}@fluxos.test`, roleId: B.adminRole.id, active: false } as never,
        B.actor,
      ),
    );
    await expect(B.as(() => users.update(inactive.id, { active: true } as never, B.actor))).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    await B.as(() => users.update(second.id, { active: false } as never, B.actor));
    await B.as(() => users.update(inactive.id, { active: true } as never, B.actor));
  });

  it('armazenamento: soma documentos e fotos e desconta o arquivo substituído', async () => {
    const limits = moduleRef.get(PlanLimitsService);
    await setPlan(A, { storageGb: 1 });
    const patient = await A.as(() => prisma.patient.create({ data: { name: `Storage ${suffix}` } }));
    const gb = 1024 ** 3;
    await A.as(() =>
      prisma.document.create({
        data: { patientId: patient.id, name: 'Grande', size: Math.floor(gb * 0.75) },
      }),
    );
    await expect(A.as(() => limits.assertStorageAvailable(gb * 0.3))).rejects.toThrow('Limite de armazenamento');
    await expect(A.as(() => limits.assertStorageAvailable(gb * 0.3, gb * 0.1))).resolves.toBeUndefined();
    // a outra clínica (sem plano) não é afetada
    await expect(B.as(() => limits.assertStorageAvailable(gb * 5))).resolves.toBeUndefined();
  });

  it('sem plano ou sem o limite = ilimitado', async () => {
    const limits = moduleRef.get(PlanLimitsService);
    await expect(A.as(() => limits.getLimits())).resolves.toEqual({ maxUsers: null, maxPatients: null, storageGb: null });
    await setPlan(A, { maxUsers: 0, maxPatients: 'x' });
    await expect(A.as(() => limits.getLimits())).resolves.toEqual({ maxUsers: null, maxPatients: null, storageGb: null });
  });
});

describe('isolamento entre clínicas nos services novos', () => {
  it('pacotes e vendas de pacote não aparecem nem são usados por outra clínica', async () => {
    const packages = moduleRef.get(PackagesService);
    const appointments = moduleRef.get(AppointmentsService);
    const proc = await A.as(() => prisma.procedure.create({ data: { name: `Proc A ${suffix}`, price: 100 } }));
    const patientA = await A.as(() => prisma.patient.create({ data: { name: `Pac A ${suffix}` } }));
    const patientB = await B.as(() => prisma.patient.create({ data: { name: `Pac B ${suffix}` } }));
    const pkg = await A.as(() =>
      packages.create({ name: `Pacote A ${suffix}`, type: 'SESSIONS', items: [{ procedureId: proc.id, quantity: 2 }] } as never),
    );
    const sold = await A.as(() => packages.createPatientPackage({ patientId: patientA.id, packageId: pkg.id }));

    expect((await B.as(() => packages.list())).map((p) => p.id)).not.toContain(pkg.id);
    expect(await B.as(() => packages.stats())).toEqual({ activePackages: 0, patientsWithPackage: 0 });
    await expect(B.as(() => packages.findOne(pkg.id))).rejects.toBeInstanceOf(NotFoundException);
    await expect(B.as(() => packages.findPatientPackage(sold.id))).rejects.toBeInstanceOf(NotFoundException);
    expect(await B.as(() => packages.listPatientPackages())).toEqual([]);
    await expect(
      B.as(() => packages.createPatientPackage({ patientId: patientB.id, packageId: pkg.id })),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(B.as(() => packages.incrementSession(sold.id))).rejects.toBeInstanceOf(NotFoundException);

    // agendar na clínica B usando o pacote da A
    const procB = await B.as(() => prisma.procedure.create({ data: { name: `Proc B ${suffix}`, price: 100 } }));
    await expect(
      B.as(() =>
        appointments.create(
          {
            patientId: patientB.id,
            procedureIds: [procB.id],
            professionalId: B.admin.id,
            startAt: '2033-01-10T13:00:00.000Z',
            endAt: '2033-01-10T14:00:00.000Z',
            patientPackageId: sold.id,
          },
          B.actor,
        ),
      ),
    ).rejects.toThrow('não pertence a este paciente');
    // e com procedimento da A
    await expect(
      B.as(() =>
        appointments.create(
          {
            patientId: patientB.id,
            procedureIds: [proc.id],
            professionalId: B.admin.id,
            startAt: '2033-01-11T13:00:00.000Z',
            endAt: '2033-01-11T14:00:00.000Z',
          },
          B.actor,
        ),
      ),
    ).rejects.toThrow('não foram encontrados');

    const untouched = await base.patientPackage.findUniqueOrThrow({ where: { id: sold.id } });
    expect(untouched.sessionsUsed).toBe(0);
  });

  it('promoção "para todos" de uma clínica não dá desconto na outra', async () => {
    const promotions = moduleRef.get(PromotionsService);
    const appointments = moduleRef.get(AppointmentsService);
    const promo = await A.as(() =>
      promotions.create({
        name: `Geral A ${suffix}`,
        startAt: '2033-02-01',
        endAt: '2033-02-28',
        discountType: 'PERCENTAGE',
        discountValue: 50,
      } as never),
    );
    const procB = await B.as(() => prisma.procedure.create({ data: { name: `Sem promo B ${suffix}`, price: 100 } }));

    expect((await B.as(() => promotions.list())).map((p) => p.id)).not.toContain(promo.id);
    await expect(B.as(() => promotions.findOne(promo.id))).rejects.toBeInstanceOf(NotFoundException);
    await expect(B.as(() => promotions.update(promo.id, { active: false } as never))).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(B.as(() => promotions.remove(promo.id))).rejects.toBeInstanceOf(NotFoundException);
    const quote = await B.as(() => appointments.promotionPreview(procB.id, '2033-02-10'));
    expect(quote).toMatchObject({ finalPrice: 100, promotion: null });
  });

  it('forma de pagamento da outra clínica não é lida nem aplica taxa', async () => {
    const methods = moduleRef.get(PaymentMethodsService);
    const appointments = moduleRef.get(AppointmentsService);
    const pmA = await A.as(() => methods.create({ name: `Cartão A ${suffix}`, feePercent: 10 } as never));

    expect((await B.as(() => methods.list())).map((m) => m.id)).not.toContain(pmA.id);
    await expect(B.as(() => methods.findOne(pmA.id))).rejects.toBeInstanceOf(NotFoundException);

    const patientB = await B.as(() => prisma.patient.create({ data: { name: `Paga B ${suffix}` } }));
    const procB = await B.as(() => prisma.procedure.create({ data: { name: `Paga B ${suffix}`, price: 200 } }));
    const appt = await B.as(() =>
      appointments.create(
        {
          patientId: patientB.id,
          procedureIds: [procB.id],
          professionalId: B.admin.id,
          startAt: '2033-03-10T13:00:00.000Z',
          endAt: '2033-03-10T14:00:00.000Z',
        },
        B.actor,
      ),
    );
    // a taxa da A não é lida; o id dela no lançamento é recusado pelo trigger same-tenant e nada é gravado
    await expect(
      B.as(() => appointments.update(appt.id, { status: AppointmentStatus.COMPLETED, paymentMethodId: pmA.id }, B.actor)),
    ).rejects.toThrow();
    expect(await base.financialEntry.count({ where: { appointmentId: appt.id } })).toBe(0);
    const still = await base.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(still).toMatchObject({ status: AppointmentStatus.SCHEDULED, financeGenerated: false });
  });

  it('estoque: itens e movimentos ficam na clínica dona', async () => {
    const inventory = moduleRef.get(InventoryService);
    const item = await A.as(() => inventory.create({ name: `Item A ${suffix}`, costPrice: 1 } as never));
    expect((await B.as(() => inventory.list())).map((i) => i.id)).not.toContain(item.id);
    await expect(B.as(() => inventory.findOne(item.id))).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      B.as(() => inventory.createMovement(item.id, { type: 'IN', quantity: 5 } as never)),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(Number((await base.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).quantity)).toBe(0);
  });

  it('anamnese: perguntas por clínica e link público grava só na clínica do token', async () => {
    const anamnesis = moduleRef.get(AnamnesisService);
    const created = await A.as(() =>
      anamnesis.createQuestion({ kind: AnamnesisKind.GENERAL, label: `Só na A ${suffix}`, type: 'TEXT' } as never),
    );
    const listB = await B.as(() => anamnesis.listQuestions(AnamnesisKind.GENERAL));
    expect(listB.map((q) => q.id)).not.toContain(created.id);
    expect(listB.every((q) => q.tenantId === B.tenant.id)).toBe(true);
    await expect(
      B.as(() => anamnesis.updateQuestion(created.id, { label: 'invadida' } as never)),
    ).rejects.toBeInstanceOf(NotFoundException);

    const patientA = await A.as(() => prisma.patient.create({ data: { name: `Maria Anamnese ${suffix}` } }));
    await expect(B.as(() => anamnesis.createLink(patientA.id))).rejects.toBeInstanceOf(NotFoundException);

    const { token } = await A.as(() => anamnesis.createLink(patientA.id));
    // a rota pública não tem clínica no contexto: o token decide
    const form = await anamnesis.getPublicForm(token);
    expect(form).toMatchObject({ firstName: 'Maria', clinicName: A.tenant.name });
    expect(form.questions.map((q) => q.key)).toContain(created.key);
  });
});
