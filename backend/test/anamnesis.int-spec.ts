/** Perguntas cadastráveis e link público da anamnese com Nest + Postgres reais. */
import { BadRequestException, GoneException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { AnamnesisService } from '../src/anamnesis/anamnesis.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestClinic, purgeTenants, testSuffix, TestClinic } from './helpers/test-clinic';

jest.setTimeout(60_000);

const suffix = testSuffix();
const base = new PrismaClient();
const MISSING = '00000000-0000-0000-0000-000000000000';

let moduleRef: TestingModule;
let prisma: PrismaService;
let anamnesis: AnamnesisService;
let C: TestClinic;
const as = <T>(fn: () => Promise<T>) => C.as(fn);

beforeAll(async () => {
  moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  prisma = moduleRef.get(PrismaService);
  anamnesis = moduleRef.get(AnamnesisService);
  C = await createTestClinic(base, 'Anamnese', suffix);
});

afterAll(async () => {
  await new Promise((r) => setTimeout(r, 500));
  if (C) await purgeTenants(base, [C.tenant.id]);
  await moduleRef?.close();
  await base.$disconnect();
});

describe('perguntas', () => {
  it('semeia as padrão na primeira leitura e cadastra novas com chave única', async () => {
    const general = await as(() => anamnesis.listQuestions('GENERAL'));
    expect(general.length).toBeGreaterThan(10);
    expect((await as(() => anamnesis.listQuestions('GENERAL'))).length).toBe(general.length);
    expect((await as(() => anamnesis.listQuestions('SKIN'))).length).toBeGreaterThan(0);

    const q1 = await as(() =>
      anamnesis.createQuestion({ kind: 'GENERAL', label: 'Usa óculos?', type: 'BOOLEAN', section: ' Extras ', placeholder: ' ', required: true } as never, C.actor),
    );
    expect(q1).toMatchObject({ key: 'usaOculos', section: 'Extras', placeholder: null, required: true, active: true });
    const q2 = await as(() => anamnesis.createQuestion({ kind: 'GENERAL', label: 'Usa óculos?', type: 'TEXT' } as never));
    expect(q2.key).toBe('usaOculos2');
    expect(q2.sortOrder).toBe(q1.sortOrder + 1);
    const choice = await as(() =>
      anamnesis.createQuestion({ kind: 'GENERAL', label: '???', type: 'SINGLE_CHOICE', options: [' A ', 'B', 'A', ''] } as never),
    );
    expect(choice).toMatchObject({ key: 'pergunta', options: ['A', 'B'] });
    await expect(
      as(() => anamnesis.createQuestion({ kind: 'GENERAL', label: 'x', type: 'MULTIPLE_CHOICE', options: ['só uma'] } as never)),
    ).rejects.toThrow('pelo menos duas opções');
  });

  it('edita perguntas livres e protege as do sistema', async () => {
    const free = await as(() => anamnesis.createQuestion({ kind: 'GENERAL', label: `Livre ${suffix}`, type: 'TEXT' } as never));
    const upd = await as(() =>
      anamnesis.updateQuestion(free.id, { label: ` Livre 2 ${suffix} `, type: 'SINGLE_CHOICE', options: ['x', 'y'], active: false, required: true, sortOrder: 99 } as never, C.actor),
    );
    expect(upd).toMatchObject({ label: `Livre 2 ${suffix}`, type: 'SINGLE_CHOICE', options: ['x', 'y'], active: false, required: true, sortOrder: 99 });
    const back = await as(() => anamnesis.updateQuestion(free.id, { type: 'TEXT' } as never));
    expect(back.options).toEqual([]);
    await expect(as(() => anamnesis.updateQuestion(free.id, { type: 'MULTIPLE_CHOICE', options: [] } as never))).rejects.toBeInstanceOf(BadRequestException);
    await expect(as(() => anamnesis.updateQuestion(MISSING, {}))).rejects.toBeInstanceOf(NotFoundException);

    const system = await base.anamnesisQuestion.findFirstOrThrow({ where: { tenantId: C.tenant.id, kind: 'GENERAL', system: true } });
    const ok = await as(() => anamnesis.updateQuestion(system.id, { label: 'Novo texto', section: '' } as never));
    expect(ok).toMatchObject({ label: 'Novo texto', section: null });
    for (const bad of [{ type: system.type === 'TEXT' ? 'BOOLEAN' : 'TEXT' }, { options: ['a', 'b'] }, { active: false }, { required: true }]) {
      await expect(as(() => anamnesis.updateQuestion(system.id, bad as never))).rejects.toThrow('usada pelo sistema');
    }
  });

  it('reordena e recusa ids de outro tipo', async () => {
    const list = await as(() => anamnesis.listQuestions('SKIN'));
    const ids = list.map((q) => q.id).reverse();
    const sorted = await as(() => anamnesis.reorderQuestions({ kind: 'SKIN', ids } as never));
    expect(sorted.map((q) => q.id).slice(0, 2)).toEqual(ids.slice(0, 2));
    await expect(as(() => anamnesis.reorderQuestions({ kind: 'SKIN', ids: [MISSING] } as never))).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('link público', () => {
  beforeAll(async () => {
    await as(() => anamnesis.listQuestions('GENERAL'));
    await base.anamnesisQuestion.updateMany({ where: { tenantId: C.tenant.id }, data: { required: false } });
  });

  it('gera link, mostra o formulário, grava as respostas e só aceita uma vez', async () => {
    const patient = await as(() =>
      prisma.patient.create({ data: { name: `Marina Souza ${suffix}`, anamnesis: { gestante: true } } }),
    );
    await expect(as(() => anamnesis.createLink(MISSING))).rejects.toBeInstanceOf(NotFoundException);

    const old = await as(() => anamnesis.createLink(patient.id, C.actor));
    const link = await as(() => anamnesis.createLink(patient.id, C.actor));
    expect(link.expiresAt.getTime()).toBeGreaterThan(Date.now());
    // o anterior foi revogado
    await expect(anamnesis.getPublicForm(old.token)).rejects.toBeInstanceOf(NotFoundException);

    const form = await anamnesis.getPublicForm(link.token);
    expect(form.firstName).toBe('Marina');
    expect(form.clinicName).toBe(C.tenant.name);
    expect(form.questions.find((q) => q.key === 'peso')).toBeDefined();
    await expect(anamnesis.getPublicForm('token-qualquer')).rejects.toBeInstanceOf(NotFoundException);

    await expect(anamnesis.submitPublic(link.token, { tabagismo: 'Talvez' })).rejects.toThrow('Opção inválida');
    await base.anamnesisQuestion.updateMany({ where: { tenantId: C.tenant.id, key: 'peso' }, data: { required: true } });
    await expect(anamnesis.submitPublic(link.token, { altura: 165 })).rejects.toThrow('perguntas obrigatórias');
    await base.anamnesisQuestion.updateMany({ where: { tenantId: C.tenant.id, key: 'peso' }, data: { required: false } });
    const res = await anamnesis.submitPublic(link.token, { peso: '70,5', altura: 165, tabagismo: 'Não', gestante: false, desconhecida: 'x' });
    expect(res).toEqual({ ok: true });

    const saved = await base.patient.findUniqueOrThrow({ where: { id: patient.id } });
    expect(saved.anamnesis).toMatchObject({ gestante: false, peso: 70.5, altura: 165, tabagismo: 'Não' });
    expect(saved.anamnesis).not.toHaveProperty('desconhecida');

    await expect(anamnesis.getPublicForm(link.token)).rejects.toBeInstanceOf(GoneException);
    await expect(anamnesis.submitPublic(link.token, {})).rejects.toBeInstanceOf(GoneException);
  });

  it('recusa link expirado', async () => {
    const patient = await as(() => prisma.patient.create({ data: { name: `Expira ${suffix}` } }));
    const { token } = await as(() => anamnesis.createLink(patient.id));
    await base.anamnesisLink.updateMany({ where: { patientId: patient.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(anamnesis.getPublicForm(token)).rejects.toThrow('expirou');
  });

  it('devolve o link para uso se a gravação falhar', async () => {
    const patient = await as(() => prisma.patient.create({ data: { name: `Falha ${suffix}` } }));
    const { token } = await as(() => anamnesis.createLink(patient.id));
    const svc = anamnesis as unknown as { measurements: { recordFromAnamnesis: (...a: unknown[]) => Promise<void> } };
    const spy = jest.spyOn(svc.measurements, 'recordFromAnamnesis').mockRejectedValueOnce(new Error('falhou'));
    await expect(anamnesis.submitPublic(token, { peso: 60 })).rejects.toThrow('falhou');
    spy.mockRestore();
    expect((await anamnesis.getPublicForm(token)).firstName).toBe('Falha');
  });
});
