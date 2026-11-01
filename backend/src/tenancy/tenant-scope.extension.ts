import { Prisma } from '@prisma/client';

import { TenantContext, TenantContextMissingError } from './tenant-context';

type Data = Record<string, any>;
type ModelMeta = (typeof Prisma.dmmf.datamodel.models)[number];

const MODELS = new Map<string, ModelMeta>(Prisma.dmmf.datamodel.models.map((m) => [m.name, m]));

/** Models com coluna tenantId (todos os dados de clínica; só Tenant fica de fora). */
export const TENANT_SCOPED_MODELS = new Set(
  [...MODELS.values()].filter((m) => m.fields.some((f) => f.name === 'tenantId')).map((m) => m.name),
);

const WHERE_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'upsert',
]);

const isObject = (v: unknown): v is Data => typeof v === 'object' && v !== null && !Array.isArray(v);
const each = <T>(v: T | T[], fn: (x: T) => T): T | T[] => (Array.isArray(v) ? v.map(fn) : fn(v));

function relationFields(model: string) {
  return MODELS.get(model)?.fields.filter((f) => f.kind === 'object') ?? [];
}

function withTenantWhere(where: Data | undefined, tenantId: string): Data {
  return { ...(where ?? {}), tenantId };
}

/**
 * Preenche o tenant num create. Input "checked" (relações via connect) precisa de
 * tenant: { connect }, input "unchecked" (FKs escalares) precisa de tenantId.
 */
function withTenantData(model: string, data: Data, tenantId: string): Data {
  const out: Data = { ...data };
  delete out.tenantId;
  delete out.tenant;
  const checked = relationFields(model).some(
    (f) => f.name !== 'tenant' && f.relationFromFields?.length && out[f.name] !== undefined,
  );
  if (checked) out.tenant = { connect: { id: tenantId } };
  else out.tenantId = tenantId;
  return scopeNestedWrites(model, out, tenantId);
}

/** Percorre escritas aninhadas (create/connect/upsert...) aplicando o tenant nos models filhos. */
function scopeNestedWrites(model: string, data: Data, tenantId: string): Data {
  const out: Data = { ...data };
  for (const field of relationFields(model)) {
    const nested = out[field.name];
    if (!isObject(nested) || !TENANT_SCOPED_MODELS.has(field.type)) continue;
    const target = field.type;
    const op: Data = { ...nested };

    if (op.create) op.create = each(op.create, (c: Data) => withTenantData(target, c, tenantId));
    if (isObject(op.createMany) && op.createMany.data) {
      op.createMany = {
        ...op.createMany,
        data: each(op.createMany.data, (c: Data) => withTenantData(target, c, tenantId)),
      };
    }
    if (op.connectOrCreate) {
      op.connectOrCreate = each(op.connectOrCreate, (c: Data) => ({
        ...c,
        where: withTenantWhere(c.where, tenantId),
        create: withTenantData(target, c.create, tenantId),
      }));
    }
    // connect/set por id não podem apontar para registro de outra clínica
    if (op.connect) op.connect = each(op.connect, (w: Data) => withTenantWhere(w, tenantId));
    if (Array.isArray(op.set)) op.set = op.set.map((w: Data) => withTenantWhere(w, tenantId));
    if (op.upsert) {
      op.upsert = each(op.upsert, (u: Data) => ({
        ...u,
        ...(u.where ? { where: withTenantWhere(u.where, tenantId) } : {}),
        create: withTenantData(target, u.create, tenantId),
        update: scopeNestedWrites(target, u.update, tenantId),
      }));
    }
    if (op.update) {
      op.update = each(op.update, (u: Data) =>
        // to-many: { where, data }; to-one: { data } ou os campos direto (nenhum model tem campo "data")
        field.isList || isObject(u.data)
          ? { ...u, data: scopeNestedWrites(target, u.data, tenantId) }
          : scopeNestedWrites(target, u, tenantId),
      );
    }
    out[field.name] = op;
  }
  return out;
}

/** Um update nunca move o registro para outra clínica. */
function withoutTenant(data: Data): Data {
  const { tenantId: _tenantId, tenant: _tenant, ...rest } = data;
  return rest;
}

/** Reescreve os args de uma operação de model para o tenant informado. */
export function scopeArgs(model: string, operation: string, args: Data | undefined, tenantId: string): Data {
  const out: Data = { ...(args ?? {}) };

  if (WHERE_OPERATIONS.has(operation)) out.where = withTenantWhere(out.where, tenantId);

  switch (operation) {
    case 'create':
      out.data = withTenantData(model, out.data ?? {}, tenantId);
      break;
    case 'createMany':
    case 'createManyAndReturn':
      out.data = each(out.data, (d: Data) => withTenantData(model, d, tenantId));
      break;
    case 'update':
    case 'updateMany':
      out.data = scopeNestedWrites(model, withoutTenant(out.data ?? {}), tenantId);
      break;
    case 'upsert':
      out.create = withTenantData(model, out.create ?? {}, tenantId);
      out.update = scopeNestedWrites(model, withoutTenant(out.update ?? {}), tenantId);
      break;
  }
  return out;
}

interface QueryParams {
  model: string;
  operation: string;
  args: unknown;
  query: (args: any) => Promise<unknown>;
}

/**
 * Escopo automático por clínica: filtra toda leitura/alteração/exclusão por tenantId
 * e preenche tenantId em todo create (inclusive aninhado), lendo o tenant do TenantContext.
 * Sem tenant no contexto a consulta é recusada (TenantContextMissingError), salvo em
 * TenantContext.runUnscoped.
 *
 * `$queryRaw` / `$executeRaw` (e *Unsafe) não recebem filtro automático: só rodam com
 * tenant no contexto ou em `runUnscoped`. Em SQL de clínica, filtre `"tenantId"` à mão.
 */
export function scopeQuery({ model, operation, args, query }: QueryParams) {
  if (!TENANT_SCOPED_MODELS.has(model)) return query(args);
  const store = TenantContext.current();
  if (store?.unscoped) return query(args);
  if (!store?.tenantId) throw new TenantContextMissingError(model, operation);
  return query(scopeArgs(model, operation, args as Data, store.tenantId));
}

/** Recusa raw SQL fora de tenant ou runUnscoped (evita vazamento cross-tenant futuro). */
export function assertRawSqlAllowed(operation: string): void {
  const store = TenantContext.current();
  if (store?.unscoped) return;
  if (store?.tenantId) return;
  throw new TenantContextMissingError('raw', operation);
}

async function guardedRaw(
  operation: string,
  args: unknown,
  query: (args: any) => Promise<unknown>,
) {
  assertRawSqlAllowed(operation);
  return query(args);
}

export const tenantScopeExtension = Prisma.defineExtension({
  name: 'tenant-scope',
  query: {
    $allModels: { $allOperations: scopeQuery },
    $queryRaw({ args, query }) {
      return guardedRaw('$queryRaw', args, query);
    },
    $executeRaw({ args, query }) {
      return guardedRaw('$executeRaw', args, query);
    },
    $queryRawUnsafe({ args, query }) {
      return guardedRaw('$queryRawUnsafe', args, query);
    },
    $executeRawUnsafe({ args, query }) {
      return guardedRaw('$executeRawUnsafe', args, query);
    },
  },
});

/** Aplica o escopo por clínica num PrismaClient avulso (seeds e scripts). */
export function withTenantScope<T extends { $extends: (ext: typeof tenantScopeExtension) => unknown }>(client: T) {
  return client.$extends(tenantScopeExtension) as T;
}
