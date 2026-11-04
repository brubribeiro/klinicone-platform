/** Documentos (upload, modelos, assinatura, acesso) com Nest + Postgres reais e o R2 simulado. */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { DocumentsService } from '../src/documents/documents.service';
import { R2StorageService } from '../src/documents/r2-storage.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestClinic, purgeTenants, testSuffix, TestClinic } from './helpers/test-clinic';

jest.setTimeout(60_000);

const suffix = testSuffix();
const base = new PrismaClient();
const MISSING = '00000000-0000-0000-0000-000000000000';

const r2 = {
  isConfigured: true,
  upload: jest.fn(),
  remove: jest.fn(),
  getPresignedUrl: jest.fn(),
};

let moduleRef: TestingModule;
let prisma: PrismaService;
let documents: DocumentsService;
let C: TestClinic;
const as = <T>(fn: () => Promise<T>) => C.as(fn);
const file = (text = 'conteúdo do termo') =>
  ({ buffer: Buffer.from(text), mimetype: 'text/plain', originalname: 'termo.txt' }) as Express.Multer.File;

beforeAll(async () => {
  moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(R2StorageService)
    .useValue(r2)
    .compile();
  prisma = moduleRef.get(PrismaService);
  documents = moduleRef.get(DocumentsService);
  C = await createTestClinic(base, 'Documentos', suffix);
});

beforeEach(() => {
  r2.isConfigured = true;
  r2.upload.mockReset().mockImplementation(async (name: string, _m: string, _b: Buffer, sub?: string) => ({
    key: `tenants/${C.tenant.id}/${sub ? `${sub}/` : ''}${name}`,
  }));
  r2.remove.mockReset().mockResolvedValue(undefined);
  r2.getPresignedUrl.mockReset().mockResolvedValue('https://signed.example/doc');
});

afterAll(async () => {
  await new Promise((r) => setTimeout(r, 500));
  if (C) await purgeTenants(base, [C.tenant.id]);
  await moduleRef?.close();
  await base.$disconnect();
});

describe('upload de arquivos', () => {
  it('envia para o R2 em subpasta do vínculo e assina automaticamente', async () => {
    const patient = await as(() => prisma.patient.create({ data: { name: `Ana Paula ${suffix}` } }));
    const equipment = await as(() => prisma.equipment.create({ data: { name: `Laser Pro ${suffix}` } }));

    const forPatient = await as(() => documents.upload({ name: 'Termo', patientId: patient.id }, file(), C.actor));
    expect(forPatient).toMatchObject({ status: 'SIGNED', fileUrl: null, hasContent: false, mimeType: 'text/plain' });
    expect(forPatient.signedAt).not.toBeNull();
    expect(r2.upload.mock.calls[0][3]).toBe(`pacientes/ana-paula-${suffix}`);

    await as(() => documents.upload({ name: 'Manual', equipmentId: equipment.id, status: 'PENDING' }, file()));
    expect(r2.upload.mock.calls[1][3]).toBe(`equipamentos/laser-pro-${suffix}`);

    await as(() => documents.upload({ name: '' }, file()));
    expect(r2.upload.mock.calls[2][0]).toBe('termo.txt');
    expect(r2.upload.mock.calls[2][3]).toBeUndefined();
  });

  it('recusa sem R2 configurado e conteúdo incompatível com o tipo', async () => {
    r2.isConfigured = false;
    await expect(as(() => documents.upload({ name: 'x' }, file()))).rejects.toThrow('não está configurado');
    await expect(as(() => documents.attachFile(MISSING, file()))).rejects.toThrow('não está configurado');
    r2.isConfigured = true;
    const fake = { buffer: Buffer.from('não é pdf'), mimetype: 'application/pdf', originalname: 'a.pdf' } as Express.Multer.File;
    await expect(as(() => documents.upload({ name: 'x' }, fake))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('anexa e substitui o arquivo de um documento existente', async () => {
    const patient = await as(() => prisma.patient.create({ data: { name: `Bia ${suffix}` } }));
    const doc = await as(() => prisma.document.create({ data: { name: `Termo ${suffix}`, patientId: patient.id } }));
    const first = await as(() => documents.attachFile(doc.id, file(), C.actor));
    expect(first.status).toBe('SIGNED');
    expect(r2.upload.mock.calls[0][3]).toBe(`pacientes/bia-${suffix}`);
    await as(() => documents.attachFile(doc.id, file('outra versão'), C.actor));
    expect(r2.remove).toHaveBeenCalledTimes(1);

    const equip = await as(() => prisma.equipment.create({ data: { name: `Eq ${suffix}` } }));
    const loose = await as(() => prisma.document.create({ data: { name: `Solto ${suffix}` } }));
    const withEq = await as(() => prisma.document.create({ data: { name: `Eq doc ${suffix}`, equipmentId: equip.id } }));
    await as(() => documents.attachFile(loose.id, file()));
    await as(() => documents.attachFile(withEq.id, file()));
    expect(r2.upload.mock.calls[2][3]).toBeUndefined();
    expect(r2.upload.mock.calls[3][3]).toBe(`equipamentos/eq-${suffix}`);
    await expect(as(() => documents.attachFile(MISSING, file()))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('gera URL de acesso só quando há arquivo e R2', async () => {
    const withFile = await as(() => documents.upload({ name: `Acesso ${suffix}` }, file()));
    expect(await as(() => documents.getAccessUrl(withFile.id))).toEqual({ url: 'https://signed.example/doc' });
    const noFile = await as(() => prisma.document.create({ data: { name: `Sem arquivo ${suffix}` } }));
    await expect(as(() => documents.getAccessUrl(noFile.id))).rejects.toBeInstanceOf(NotFoundException);
    r2.isConfigured = false;
    await expect(as(() => documents.getAccessUrl(withFile.id))).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('modelos, edição e exclusão', () => {
  it('gera documento do modelo substituindo os dados do paciente', async () => {
    const patient = await as(() =>
      prisma.patient.create({
        data: { name: `Carla ${suffix}`, document: '12345678901', birthDate: new Date('1990-05-17T00:00:00Z'), phone: '1599', email: 'c@x.com', address: 'Rua 1' },
      }),
    );
    const tpl = await as(() =>
      prisma.documentTemplate.create({
        data: { name: `Modelo ${suffix}`, category: 'Termos', content: '{{paciente}}|{{ cpf }}|{{nascimento}}|{{telefone}}|{{email}}|{{endereco}}|{{profissional}}|{{desconhecido}}|{{data}}' } as never,
      }),
    );
    const doc = await as(() => documents.createFromTemplate({ templateId: tpl.id, patientId: patient.id }, C.actor));
    expect(doc).toMatchObject({ name: `Modelo ${suffix} — Carla ${suffix}`, category: 'Termos', status: 'PENDING', hasContent: true });
    const raw = await base.document.findUniqueOrThrow({ where: { id: doc.id } });
    const [nome, cpf, nasc, tel, email, end, prof, unknown, data] = (raw.content as string).split('|');
    expect([nome, cpf, nasc, tel, email, end, prof, unknown]).toEqual([`Carla ${suffix}`, '123.456.789-01', '17/05/1990', '1599', 'c@x.com', 'Rua 1', C.admin.name, '{{desconhecido}}']);
    expect(data).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

    const blank = await as(() => documents.createFromTemplate({ templateId: tpl.id, name: ' Meu ', category: 'X', notes: 'n', status: 'SENT' }));
    expect(blank).toMatchObject({ name: 'Meu', category: 'X', status: 'SENT' });
    await expect(as(() => documents.createFromTemplate({ templateId: MISSING }))).rejects.toThrow('Modelo');
    await expect(as(() => documents.createFromTemplate({ templateId: tpl.id, patientId: MISSING }))).rejects.toThrow('Paciente');
  });

  it('lista com filtros, edita preservando a assinatura e remove com o arquivo', async () => {
    const patient = await as(() => prisma.patient.create({ data: { name: `Duda ${suffix}` } }));
    const doc = await as(() => documents.upload({ name: `Contrato ${suffix}`, patientId: patient.id }, file()));
    expect((await as(() => documents.list({ patientId: patient.id }))).map((d) => d.id)).toEqual([doc.id]);
    expect((await as(() => documents.list({ equipmentId: MISSING })))).toEqual([]);
    expect((await as(() => documents.list())).length).toBeGreaterThan(0);

    const detail = await as(() => documents.findOne(doc.id));
    expect(detail.fileUrl).toBeNull();
    await expect(as(() => documents.findOne(MISSING))).rejects.toBeInstanceOf(NotFoundException);

    const signedAt = (await base.document.findUniqueOrThrow({ where: { id: doc.id } })).signedAt;
    const same = await as(() => documents.update(doc.id, { status: 'SIGNED', name: '  ', category: 'Cat', notes: 'obs' }, C.actor));
    expect(same.name).toBe(`Contrato ${suffix}`);
    expect((await base.document.findUniqueOrThrow({ where: { id: doc.id } })).signedAt).toEqual(signedAt);
    const reopened = await as(() => documents.update(doc.id, { status: 'PENDING', category: '', notes: '', patientId: null, equipmentId: null }));
    expect(reopened).toMatchObject({ status: 'PENDING', signedAt: null, category: null, notes: null, patientId: null });

    expect(await as(() => documents.remove(doc.id, C.actor))).toEqual({ ok: true });
    expect(r2.remove).toHaveBeenCalled();
    await expect(as(() => documents.remove(doc.id))).rejects.toBeInstanceOf(NotFoundException);
  });
});
