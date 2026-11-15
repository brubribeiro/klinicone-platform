import { DocumentTemplatesService } from './document-templates.service';
import { DeletionConflictException } from '../common/deletion/deletion-dependencies';

describe('DocumentTemplatesService.remove', () => {
  const build = (docs: string[] = []) => {
    const prisma: any = {
      documentTemplate: {
        findUnique: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo' }),
        delete: jest.fn().mockResolvedValue({}),
      },
      document: {
        findMany: jest.fn().mockResolvedValue(docs.map((name) => ({ name }))),
        updateMany: jest.fn().mockResolvedValue({ count: docs.length }),
      },
      $transactionWithRetry: jest.fn().mockImplementation(async (fn) => fn(prisma)),
    };
    const auditLog: any = { logDelete: jest.fn().mockResolvedValue(undefined) };
    return { service: new DocumentTemplatesService(prisma, auditLog), prisma, auditLog };
  };

  it('responde 409 com canUnlink true listando os documentos gerados', async () => {
    const { service, prisma } = build(['Termo João', 'Termo Ana']);
    const err = await service.remove('tpl-1').catch((e) => e);
    expect(err).toBeInstanceOf(DeletionConflictException);
    const body = err.getResponse();
    expect(body.canUnlink).toBe(true);
    expect(body.dependencies).toEqual([
      expect.objectContaining({ type: 'documents', count: 2, names: ['Termo Ana', 'Termo João'] }),
    ]);
    expect(prisma.document.updateMany).not.toHaveBeenCalled();
    expect(prisma.documentTemplate.delete).not.toHaveBeenCalled();
  });

  it('desvincula os documentos e exclui', async () => {
    const { service, prisma, auditLog } = build(['Termo João']);
    const result = await service.remove('tpl-1', { id: 'u1' } as never, true);
    expect(result).toEqual({ ok: true, unlinked: [expect.objectContaining({ type: 'documents' })] });
    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: { templateId: 'tpl-1' },
      data: { templateId: null },
    });
    expect(prisma.documentTemplate.delete).toHaveBeenCalledWith({ where: { id: 'tpl-1' } });
    expect(auditLog.logDelete).toHaveBeenCalledWith(
      'DocumentTemplate',
      'tpl-1',
      expect.objectContaining({ unlinkedDependencies: expect.any(Array) }),
      expect.anything(),
    );
  });

  it('exclui direto quando não há documentos', async () => {
    const { service, prisma } = build();
    await expect(service.remove('tpl-1')).resolves.toEqual({ ok: true, unlinked: [] });
    expect(prisma.documentTemplate.delete).toHaveBeenCalledWith({ where: { id: 'tpl-1' } });
  });
});
