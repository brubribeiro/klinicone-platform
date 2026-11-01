import { TenantContext, TenantContextMissingError } from './tenant-context';
import {
  assertRawSqlAllowed,
  scopeArgs,
  scopeQuery,
  TENANT_SCOPED_MODELS,
} from './tenant-scope.extension';

const T = 'tenant-a';

describe('tenant scope extension', () => {
  describe('TENANT_SCOPED_MODELS', () => {
    it('covers every clinic model and leaves Tenant out', () => {
      expect(TENANT_SCOPED_MODELS.has('Tenant')).toBe(false);
      for (const model of [
        'User',
        'Role',
        'AppSetting',
        'Patient',
        'Appointment',
        'FinancialEntry',
        'PackageItem',
        'FeedbackReport',
      ]) {
        expect(TENANT_SCOPED_MODELS.has(model)).toBe(true);
      }
    });
  });

  describe('scopeArgs', () => {
    it.each(['findMany', 'findFirst', 'findUnique', 'count', 'aggregate', 'groupBy', 'updateMany', 'deleteMany', 'delete'])(
      'adds tenantId to where on %s',
      (operation) => {
        expect(scopeArgs('Patient', operation, { where: { id: 'p1' } }, T).where).toEqual({ id: 'p1', tenantId: T });
      },
    );

    it('adds a where when the query has none', () => {
      expect(scopeArgs('Patient', 'findMany', undefined, T)).toEqual({ where: { tenantId: T } });
    });

    it('overrides a tenantId passed by the caller', () => {
      expect(scopeArgs('Patient', 'findMany', { where: { tenantId: 'other' } }, T).where).toEqual({ tenantId: T });
    });

    it('fills tenantId on unchecked create (scalar FKs)', () => {
      const args = scopeArgs('Appointment', 'create', { data: { patientId: 'p1', professionalId: 'u1' } }, T);
      expect(args.data).toEqual({ patientId: 'p1', professionalId: 'u1', tenantId: T });
    });

    it('connects the tenant on checked create and scopes connect to the tenant', () => {
      const args = scopeArgs('Appointment', 'create', { data: { patient: { connect: { id: 'p1' } } } }, T);
      expect(args.data).toEqual({
        patient: { connect: { id: 'p1', tenantId: T } },
        tenant: { connect: { id: T } },
      });
    });

    it('fills tenantId on nested creates', () => {
      const args = scopeArgs(
        'Appointment',
        'create',
        { data: { patientId: 'p1', extraMaterials: { create: [{ itemId: 'i1', quantity: 1 }] } } },
        T,
      );
      expect(args.data.extraMaterials.create).toEqual([{ itemId: 'i1', quantity: 1, tenantId: T }]);
    });

    it('fills tenantId on nested createMany and on nested creates inside update', () => {
      const created = scopeArgs('Package', 'create', { data: { items: { createMany: { data: [{ procedureId: 'x' }] } } } }, T);
      expect(created.data.items.createMany.data).toEqual([{ procedureId: 'x', tenantId: T }]);

      const updated = scopeArgs('Package', 'update', { where: { id: 'k' }, data: { items: { create: { procedureId: 'x' } } } }, T);
      expect(updated.where).toEqual({ id: 'k', tenantId: T });
      expect(updated.data.items.create).toEqual({ procedureId: 'x', tenantId: T });
    });

    it('drops tenantId from update data so a row never changes clinic', () => {
      const args = scopeArgs('Patient', 'update', { where: { id: 'p1' }, data: { name: 'x', tenantId: 'other' } }, T);
      expect(args.data).toEqual({ name: 'x' });
    });

    it('fills tenantId on createMany', () => {
      const args = scopeArgs('Procedure', 'createMany', { data: [{ name: 'a' }, { name: 'b' }] }, T);
      expect(args.data).toEqual([
        { name: 'a', tenantId: T },
        { name: 'b', tenantId: T },
      ]);
    });

    it('scopes upsert where and create', () => {
      const args = scopeArgs(
        'AppSetting',
        'upsert',
        { where: { tenantId_key: { tenantId: T, key: 'k' } }, create: { key: 'k', value: '1' }, update: { value: '1' } },
        T,
      );
      expect(args.where).toEqual({ tenantId_key: { tenantId: T, key: 'k' }, tenantId: T });
      expect(args.create).toEqual({ key: 'k', value: '1', tenantId: T });
      expect(args.update).toEqual({ value: '1' });
    });
  });

  describe('scopeQuery', () => {
    const query = jest.fn(async (args: unknown) => args);

    beforeEach(() => query.mockClear());

    it('refuses a clinic model without tenant in context', () => {
      expect(() => scopeQuery({ model: 'Patient', operation: 'findMany', args: {}, query })).toThrow(
        TenantContextMissingError,
      );
      expect(query).not.toHaveBeenCalled();
    });

    it('refuses inside a request whose tenant was not set (e.g. super-admin)', () => {
      TenantContext.runRequest(() => {
        expect(() => scopeQuery({ model: 'Patient', operation: 'findMany', args: {}, query })).toThrow(
          TenantContextMissingError,
        );
      });
    });

    it('scopes to the tenant set on the request', async () => {
      await TenantContext.runRequest(async () => {
        TenantContext.setTenant(T);
        await expect(scopeQuery({ model: 'Patient', operation: 'findMany', args: {}, query })).resolves.toEqual({
          where: { tenantId: T },
        });
      });
    });

    it('passes through unscoped and for global models', async () => {
      await TenantContext.runUnscoped(async () => {
        await expect(scopeQuery({ model: 'User', operation: 'findUnique', args: { where: { email: 'a@b' } }, query })).resolves.toEqual({
          where: { email: 'a@b' },
        });
      });
      await expect(scopeQuery({ model: 'Tenant', operation: 'findMany', args: {}, query })).resolves.toEqual({});
    });
  });

  describe('TenantContext', () => {
    it('runs lazy thenables (PrismaPromise) inside the context', async () => {
      let seen: string | null = null;
      const lazy = { then: (resolve: (v: string | null) => void) => resolve((seen = TenantContext.tenantId())) };
      await TenantContext.run(T, () => lazy);
      expect(seen).toBe(T);
    });
  });

  describe('assertRawSqlAllowed', () => {
    it('refuses raw SQL without tenant context', () => {
      expect(() => assertRawSqlAllowed('$queryRaw')).toThrow(TenantContextMissingError);
    });

    it('allows raw SQL inside a tenant or unscoped', async () => {
      await TenantContext.run(T, async () => {
        expect(() => assertRawSqlAllowed('$queryRaw')).not.toThrow();
      });
      await TenantContext.runUnscoped(async () => {
        expect(() => assertRawSqlAllowed('$executeRaw')).not.toThrow();
      });
    });
  });
});
