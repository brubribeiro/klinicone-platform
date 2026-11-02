/**
 * Isolamento entre clínicas com Nest + Postgres reais (sem mocks de Prisma).
 * Cria duas clínicas temporárias, exercita os services principais como cada uma e
 * apaga tudo no fim. Exige DATABASE_URL (backend/.env) com as migrations aplicadas.
 * Uso: npm run test:tenancy
 */
import { randomUUID } from 'crypto';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, PrismaClient, Role, Tenant, User } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { PatientsService } from '../src/patients/patients.service';
import { AppointmentsService } from '../src/appointments/appointments.service';
import { FinanceService } from '../src/finance/finance.service';
import { UsersService } from '../src/users/users.service';
import { FeedbackService } from '../src/feedback/feedback.service';
import { AuthService } from '../src/auth/auth.service';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { PrismaService } from '../src/prisma/prisma.service';
import { TenantContext, TenantContextMissingError } from '../src/tenancy/tenant-context';
import { provisionTenant } from '../src/tenancy/system-roles';
import { SuperAdminGuard } from '../src/tenancy/super-admin.guard';
import { getHourlyCostIncludeVariable, setHourlyCostIncludeVariable } from '../src/common/utils/hourly-cost.util';
import type { AuthenticatedUser } from '../src/common/decorators/current-user.decorator';

jest.setTimeout(60_000);

const suffix = randomUUID().slice(0, 8);
const base = new PrismaClient();

let moduleRef: TestingModule;
let prisma: PrismaService;
let patients: PatientsService;
let appointments: AppointmentsService;
let finance: FinanceService;
let users: UsersService;
let feedback: FeedbackService;

interface Clinic {
  tenant: Tenant;
  adminRole: Role;
  admin: User;
  as<T>(fn: () => Promise<T>): Promise<T>;
}
let A: Clinic;
let B: Clinic;

async function createClinic(label: string): Promise<Clinic> {
  // provisionTenant cria grupos de sistema e o primeiro administrador numa transação só
  const email = `admin-${label.toLowerCase()}-${suffix}@isolamento.test`;
  const tenant = await provisionTenant(
    base,
    { name: `Isolamento ${label}`, slug: `test-${label.toLowerCase()}-${suffix}` },
    { name: `Admin ${label}`, email, password: 'x' },
  );
  const adminRole = await base.role.findFirstOrThrow({ where: { tenantId: tenant.id, name: 'Administrador' } });
  const admin = await base.user.findUniqueOrThrow({ where: { email } });
  expect(admin).toMatchObject({ tenantId: tenant.id, roleId: adminRole.id, isSuperAdmin: false });
  return { tenant, adminRole, admin, as: (fn) => TenantContext.run(tenant.id, fn) };
}

/** Apaga todos os dados das clínicas de teste, repetindo até as FKs deixarem. */
async function purgeTenants(tenantIds: string[]) {
  const tables = Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === 'tenantId'))
    .map((m) => m.dbName ?? m.name);
  let pending = [...tables];
  for (let pass = 0; pass < 10 && pending.length; pass++) {
    const failed: string[] = [];
    for (const table of pending) {
      try {
        await base.$executeRawUnsafe(`DELETE FROM "${table}" WHERE "tenantId" = ANY($1::text[])`, tenantIds);
      } catch {
        failed.push(table);
      }
    }
    pending = failed;
  }
  await base.tenant.deleteMany({ where: { id: { in: tenantIds } } });
}

beforeAll(async () => {
  moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  prisma = moduleRef.get(PrismaService);
  patients = moduleRef.get(PatientsService);
  appointments = moduleRef.get(AppointmentsService);
  finance = moduleRef.get(FinanceService);
  users = moduleRef.get(UsersService);
  feedback = moduleRef.get(FeedbackService);
  A = await createClinic('A');
  B = await createClinic('B');
});

afterAll(async () => {
  // eventos/auditoria disparados sem await ainda podem estar gravando
  await new Promise((r) => setTimeout(r, 500));
  if (A && B) await purgeTenants([A.tenant.id, B.tenant.id]);
  await moduleRef?.close();
  await base.$disconnect();
});

describe('tenant isolation', () => {
  it('fills tenantId automatically and refuses queries without a clinic in context', async () => {
    const patient = await A.as(() => patients.create({ name: 'Auto tenant' }));
    const row = await base.patient.findUniqueOrThrow({ where: { id: patient.id } });
    expect(row.tenantId).toBe(A.tenant.id);

    await expect(prisma.patient.findMany()).rejects.toBeInstanceOf(TenantContextMissingError);
  });

  describe('patients', () => {
    let patientA: { id: string };

    beforeAll(async () => {
      patientA = await A.as(() => patients.create({ name: `Paciente A ${suffix}` }));
    });

    it('other clinic does not list, read, update or delete it', async () => {
      const listB = (await B.as(() => patients.list(suffix))) as { id: string }[];
      expect(listB.map((p) => p.id)).not.toContain(patientA.id);

      await expect(B.as(() => patients.findOne(patientA.id))).rejects.toBeInstanceOf(NotFoundException);
      await expect(B.as(() => patients.update(patientA.id, { name: 'invadido' }))).rejects.toThrow();
      await expect(B.as(() => patients.remove(patientA.id))).rejects.toThrow();

      const stillThere = await A.as(() => patients.findOne(patientA.id));
      expect(stillThere.name).toBe(`Paciente A ${suffix}`);
    });

    it('owner clinic sees it', async () => {
      const listA = (await A.as(() => patients.list(suffix))) as { id: string }[];
      expect(listA.map((p) => p.id)).toContain(patientA.id);
    });
  });

  describe('appointments', () => {
    const startAt = '2031-03-10T13:00:00.000Z';
    const endAt = '2031-03-10T14:00:00.000Z';
    let appointmentA: { id: string };
    let patientA: { id: string };
    let patientB: { id: string };

    beforeAll(async () => {
      patientA = await A.as(() => patients.create({ name: 'Paciente agenda A' }));
      patientB = await B.as(() => patients.create({ name: 'Paciente agenda B' }));
      appointmentA = await A.as(() =>
        appointments.create({ patientId: patientA.id, professionalId: A.admin.id, startAt, endAt, kind: 'EVALUATION' }),
      );
    });

    it('other clinic does not list, read or delete it', async () => {
      const listB = (await B.as(() => appointments.list('2031-03-01', '2031-03-31'))) as { id: string }[];
      expect(listB.map((a) => a.id)).not.toContain(appointmentA.id);
      const listA = (await A.as(() => appointments.list('2031-03-01', '2031-03-31'))) as { id: string }[];
      expect(listA.map((a) => a.id)).toContain(appointmentA.id);

      await expect(B.as(() => appointments.findOne(appointmentA.id))).rejects.toThrow();
      await expect(B.as(() => appointments.remove(appointmentA.id))).rejects.toThrow();
    });

    it('cannot book with a patient or professional from another clinic', async () => {
      await expect(
        B.as(() => appointments.create({ patientId: patientA.id, professionalId: B.admin.id, startAt, endAt, kind: 'EVALUATION' })),
      ).rejects.toThrow();
      await expect(
        B.as(() => appointments.create({ patientId: patientB.id, professionalId: A.admin.id, startAt, endAt, kind: 'EVALUATION' })),
      ).rejects.toThrow();
    });
  });

  describe('finance', () => {
    let entryA: { id: string };

    beforeAll(async () => {
      entryA = await A.as(() =>
        finance.create({ type: 'INCOME', description: `Receita A ${suffix}`, amount: 777, paidAt: '2031-04-10T12:00:00.000Z' }),
      );
    });

    it('other clinic does not list, total, update or delete it', async () => {
      const listB = (await B.as(() => finance.list('2031-04-01', '2031-04-30'))) as { id: string }[];
      expect(listB.map((e) => e.id)).not.toContain(entryA.id);
      const listA = (await A.as(() => finance.list('2031-04-01', '2031-04-30'))) as { id: string }[];
      expect(listA.map((e) => e.id)).toContain(entryA.id);

      const summaryB = await B.as(() => finance.summary('2031-04-01', '2031-04-30'));
      expect(JSON.stringify(summaryB)).not.toContain('777');

      await expect(B.as(() => finance.update(entryA.id, { description: 'invadido' }))).rejects.toThrow();
      await expect(B.as(() => finance.remove(entryA.id))).rejects.toThrow();
    });

    it('database refuses linking a record from another clinic (same-tenant trigger)', async () => {
      const patientA = await A.as(() => patients.create({ name: 'Paciente financeiro A' }));
      await expect(
        B.as(() => finance.create({ type: 'INCOME', description: 'cruzado', amount: 1, patientId: patientA.id })),
      ).rejects.toMatchObject({ code: 'P2003' });
    });
  });

  describe('users and roles', () => {
    it('other clinic does not list, update or remove its users', async () => {
      const listB = (await B.as(() => users.list())) as { id: string }[];
      expect(listB.map((u) => u.id)).toEqual([B.admin.id]);

      await expect(B.as(() => users.update(A.admin.id, { name: 'invadido' }))).rejects.toBeInstanceOf(NotFoundException);
      await expect(B.as(() => users.remove(A.admin.id, B.admin.id))).rejects.toThrow();
    });

    it('cannot create a user with a role from another clinic', async () => {
      await expect(
        B.as(() => users.create({ name: 'X', email: `x-${suffix}@isolamento.test`, roleId: A.adminRole.id })),
      ).rejects.toThrow('Grupo (role) inválido.');
    });

    it('keeps e-mail unique across clinics', async () => {
      await expect(
        B.as(() => users.create({ name: 'Dup', email: A.admin.email, roleId: B.adminRole.id })),
      ).rejects.toThrow('E-mail já cadastrado');
    });

    it('each clinic has its own system roles', async () => {
      const rolesA = await A.as(() => prisma.role.findMany());
      const rolesB = await B.as(() => prisma.role.findMany());
      expect(rolesA.map((r) => r.name).sort()).toEqual(['Administrador', 'Profissional', 'Recepção']);
      expect(rolesA.map((r) => r.id)).not.toEqual(expect.arrayContaining(rolesB.map((r) => r.id)));
    });
  });

  it('app settings are per clinic', async () => {
    await A.as(() => setHourlyCostIncludeVariable(prisma, true));
    await expect(A.as(() => getHourlyCostIncludeVariable(prisma))).resolves.toBe(true);
    await expect(B.as(() => getHourlyCostIncludeVariable(prisma))).resolves.toBe(false);
  });

  describe('feedback', () => {
    const asUser = (clinic: Clinic): AuthenticatedUser => ({
      id: clinic.admin.id,
      email: clinic.admin.email,
      name: clinic.admin.name,
      tenantId: clinic.tenant.id,
      isSuperAdmin: false,
      roleId: clinic.adminRole.id,
      roleName: clinic.adminRole.name,
      permissions: ['feedback:view'],
      restrictToOwnAppointments: false,
      active: true,
      providesAppointments: true,
      features: [],
      tokenVersion: clinic.admin.tokenVersion ?? 0,
    });

    it('fills tenantId on create and other clinic does not list it', async () => {
      const created = await A.as(() =>
        feedback.create(
          {
            type: 'BUG',
            title: `Bug A ${suffix}`,
            description: 'Isolamento de feedback entre clínicas',
          },
          asUser(A),
        ),
      );
      const row = await base.feedbackReport.findUniqueOrThrow({ where: { id: created.id } });
      expect(row.tenantId).toBe(A.tenant.id);

      const listB = await B.as(() => feedback.list());
      expect(listB.map((r) => r.id)).not.toContain(created.id);
      const listA = await A.as(() => feedback.list());
      expect(listA.map((r) => r.id)).toContain(created.id);
    });

    it('database refuses author from another clinic (same-tenant trigger)', async () => {
      await expect(
        B.as(() =>
          feedback.create(
            {
              type: 'SUGGESTION',
              title: 'Cruzado',
              description: 'userId de outra clínica',
            },
            asUser(A),
          ),
        ),
      ).rejects.toMatchObject({ code: 'P2003' });
    });
  });

  describe('auth', () => {
    it('JWT carries the tenant and the request is scoped to it', async () => {
      const strategy = moduleRef.get(JwtStrategy);
      const user = await strategy.validate({
        sub: A.admin.id,
        email: A.admin.email,
        tenantId: A.tenant.id,
        tv: A.admin.tokenVersion ?? 0,
      });
      expect(user.tenantId).toBe(A.tenant.id);
      await expect(
        strategy.validate({
          sub: A.admin.id,
          email: A.admin.email,
          tenantId: B.tenant.id,
          tv: A.admin.tokenVersion ?? 0,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('suspended clinic: requests and login are refused with a clear message', async () => {
      const strategy = moduleRef.get(JwtStrategy);
      const auth = moduleRef.get(AuthService);
      (auth as any).googleClient = { verifyIdToken: async () => ({ getPayload: () => ({ email: B.admin.email }) }) };

      await base.tenant.update({ where: { id: B.tenant.id }, data: { active: false, suspendedAt: new Date() } });
      try {
        await expect(
          strategy.validate({
            sub: B.admin.id,
            email: B.admin.email,
            tenantId: B.tenant.id,
            tv: B.admin.tokenVersion ?? 0,
          }),
        ).rejects.toThrow(/suspenso/);
        await expect(auth.loginWithGoogle({ credential: 'x' })).rejects.toThrow(/suspenso/);
        // a outra clínica segue funcionando
        await expect(
          strategy.validate({
            sub: A.admin.id,
            email: A.admin.email,
            tenantId: A.tenant.id,
            tv: A.admin.tokenVersion ?? 0,
          }),
        ).resolves.toBeDefined();
      } finally {
        await base.tenant.update({ where: { id: B.tenant.id }, data: { active: true, suspendedAt: null } });
      }
      const login = await auth.loginWithGoogle({ credential: 'x' });
      expect(login.user.tenantId).toBe(B.tenant.id);
    });

    it('super-admin has no clinic: passes SuperAdminGuard and cannot read clinic data', async () => {
      const superAdmin = await base.user.create({
        data: { name: 'Root', email: `root-${suffix}@isolamento.test`, password: 'x', isSuperAdmin: true },
      });
      try {
        const strategy = moduleRef.get(JwtStrategy);
        const authUser = await strategy.validate({
          sub: superAdmin.id,
          email: superAdmin.email,
          tenantId: null,
          tv: superAdmin.tokenVersion ?? 0,
        });
        expect(authUser).toMatchObject({ isSuperAdmin: true, tenantId: null });

        const guard = new SuperAdminGuard();
        const ctx = (user: Partial<AuthenticatedUser>) =>
          ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as any;
        expect(guard.canActivate(ctx(authUser))).toBe(true);
        expect(() => guard.canActivate(ctx({ isSuperAdmin: false, tenantId: A.tenant.id }))).toThrow();

        await expect(
          TenantContext.runRequest(async () => {
            TenantContext.setTenant(authUser.tenantId);
            return patients.list();
          }),
        ).rejects.toBeInstanceOf(TenantContextMissingError);
      } finally {
        await base.user.delete({ where: { id: superAdmin.id } });
      }
    });

    it('database allows dual super-admin with clinic tenant and role', async () => {
      try {
        await base.user.update({ where: { id: A.admin.id }, data: { isSuperAdmin: true } });
        const dual = await base.user.findUniqueOrThrow({ where: { id: A.admin.id } });
        expect(dual).toMatchObject({
          isSuperAdmin: true,
          tenantId: A.tenant.id,
          roleId: A.adminRole.id,
        });
      } finally {
        await base.user.update({ where: { id: A.admin.id }, data: { isSuperAdmin: false } });
      }
    });

    it('database refuses a clinic user without tenant', async () => {
      await expect(
        base.user.create({ data: { name: 'Sem clínica', email: `orphan-${suffix}@isolamento.test`, password: 'x' } }),
      ).rejects.toThrow(/users_tenant_or_super_admin_check/);
    });

    it('database refuses a clinic user without role', async () => {
      await expect(
        base.user.create({
          data: {
            name: 'Sem grupo',
            email: `norole-${suffix}@isolamento.test`,
            password: 'x',
            tenantId: A.tenant.id,
          },
        }),
      ).rejects.toThrow(/users_tenant_or_super_admin_check/);
    });
  });
});
