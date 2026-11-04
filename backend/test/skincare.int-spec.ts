/** Rotinas de skincare: produtos, regras e rotinas salvas na ficha, com Nest + Postgres reais. */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SkincareService } from '../src/skincare/skincare.service';
import { createTestClinic, purgeTenants, testSuffix, TestClinic } from './helpers/test-clinic';

jest.setTimeout(60_000);

const suffix = testSuffix();
const base = new PrismaClient();
const MISSING = '00000000-0000-0000-0000-000000000000';

let moduleRef: TestingModule;
let prisma: PrismaService;
let skincare: SkincareService;
let C: TestClinic;
const as = <T>(fn: () => Promise<T>) => C.as(fn);

beforeAll(async () => {
  moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  prisma = moduleRef.get(PrismaService);
  skincare = moduleRef.get(SkincareService);
  C = await createTestClinic(base, 'Skincare', suffix);
});

afterAll(async () => {
  await new Promise((r) => setTimeout(r, 500));
  if (C) await purgeTenants(base, [C.tenant.id]);
  await moduleRef?.close();
  await base.$disconnect();
});

describe('produtos e regras', () => {
  it('cria, edita e remove produto, limpando-o das regras', async () => {
    const product = await as(() =>
      skincare.createProduct(
        { name: ` Gel ${suffix} `, brand: ' ', moments: ['manha'], step: 'limpeza', tags: ['acido'], howTo: 'Aplicar', note: 'n' },
        C.actor,
      ),
    );
    expect(product).toMatchObject({ name: `Gel ${suffix}`, brand: null, tags: ['acido'] });
    await expect(
      as(() => skincare.createProduct({ name: 'x', moments: ['manha'], step: 'limpeza', tags: ['inexistente'] })),
    ).rejects.toBeInstanceOf(BadRequestException);

    const upd = await as(() => skincare.updateProduct(product.id, { name: 'Gel 2', tags: [], brand: 'Marca' }, C.actor));
    expect(upd).toMatchObject({ name: 'Gel 2', brand: 'Marca', tags: [] });
    await expect(as(() => skincare.updateProduct(product.id, { tags: ['zzz'] }))).rejects.toBeInstanceOf(BadRequestException);
    await expect(as(() => skincare.updateProduct(MISSING, {}))).rejects.toBeInstanceOf(NotFoundException);

    const rule = await as(() =>
      skincare.createRule({ field: 'pele', value: 'seca', productIds: [product.id, product.id], avoidTags: ['acido', 'acido'], note: ' ' }, C.actor),
    );
    expect(rule).toMatchObject({ productIds: [product.id], avoidTags: ['acido'], note: null });
    expect((await as(() => skincare.listProducts())).map((p) => p.id)).toContain(product.id);
    expect((await as(() => skincare.listRules())).map((r) => r.id)).toContain(rule.id);

    expect(await as(() => skincare.removeProduct(product.id, C.actor))).toEqual({ ok: true });
    const after = await base.skincareRule.findUniqueOrThrow({ where: { id: rule.id } });
    expect(after.productIds).toEqual([]);
    await expect(as(() => skincare.removeProduct(product.id))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('valida regras, atualiza e remove', async () => {
    const product = await as(() => skincare.createProduct({ name: `P ${suffix}`, moments: ['noite'], step: 'hidratacao' }));
    await expect(as(() => skincare.createRule({ field: 'pele', value: 'xx', productIds: [product.id] }))).rejects.toThrow('inválidos');
    await expect(as(() => skincare.createRule({ field: 'pele', value: 'seca' }))).rejects.toThrow('ao menos um');
    await expect(as(() => skincare.createRule({ field: 'pele', value: 'seca', productIds: [MISSING] }))).rejects.toThrow('Produto não encontrado');
    await expect(as(() => skincare.createRule({ field: 'pele', value: 'seca', avoidTags: ['nao'] }))).rejects.toBeInstanceOf(BadRequestException);

    const rule = await as(() => skincare.createRule({ field: 'afeccao', value: 'acne', productIds: [product.id] }));
    const upd = await as(() => skincare.updateRule(rule.id, { value: 'melasma', avoidTags: ['oleo'] }, C.actor));
    expect(upd).toMatchObject({ field: 'afeccao', value: 'melasma', productIds: [product.id], avoidTags: ['oleo'] });
    await expect(as(() => skincare.updateRule(MISSING, {}))).rejects.toBeInstanceOf(NotFoundException);

    expect(await as(() => skincare.removeRule(rule.id, C.actor))).toEqual({ ok: true });
    await expect(as(() => skincare.removeRule(rule.id))).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('rotinas', () => {
  it('salva, lista, edita e remove rotina da paciente', async () => {
    const patient = await as(() => prisma.patient.create({ data: { name: `Rotina ${suffix}` } }));
    const other = await as(() => prisma.patient.create({ data: { name: `Outra ${suffix}` } }));
    const dto = {
      patientId: patient.id,
      consultDate: '2031-03-10',
      answers: { pele: 'seca' },
      items: [{ moment: 'manha', step: 'limpeza', name: 'Gel' }],
    } as never;
    const routine = await as(() => skincare.createRoutine(dto, C.actor));
    expect(routine.patient.name).toBe(`Rotina ${suffix}`);
    expect(routine.createdById).toBe(C.admin.id);

    await expect(as(() => skincare.createRoutine({ ...(dto as object), patientId: MISSING } as never))).rejects.toBeInstanceOf(NotFoundException);
    expect((await as(() => skincare.listRoutines(patient.id))).map((r) => r.id)).toEqual([routine.id]);
    expect((await as(() => skincare.listRoutines())).length).toBeGreaterThanOrEqual(1);

    const upd = await as(() => skincare.updateRoutine(routine.id, { notes: ' ok ', consultDate: '2031-04-01', avoided: [], guidelines: [], answers: {}, items: [] } as never, C.actor));
    expect(upd.notes).toBe('ok');
    await expect(as(() => skincare.updateRoutine(routine.id, { patientId: other.id }))).rejects.toThrow('trocar a paciente');
    await expect(as(() => skincare.updateRoutine(MISSING, {}))).rejects.toBeInstanceOf(NotFoundException);
    await expect(as(() => skincare.findRoutine(MISSING))).rejects.toBeInstanceOf(NotFoundException);

    expect(await as(() => skincare.removeRoutine(routine.id, C.actor))).toEqual({ ok: true });
    await expect(as(() => skincare.removeRoutine(routine.id))).rejects.toBeInstanceOf(NotFoundException);
  });
});
