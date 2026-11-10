import { NotFoundException } from '@nestjs/common';

import { FeedbackAdminService } from './feedback-admin.service';
import { TenantContext } from '../tenancy/tenant-context';
import { NotificationsService } from '../notifications/notifications.service';

describe('FeedbackAdminService', () => {
  const actor = { id: 'root-1', name: 'Dono', email: 'root@platform.dev', isSuperAdmin: true } as any;
  const report = {
    id: 'fb-1',
    type: 'BUG',
    status: 'OPEN',
    title: 'Botão não salva',
    description: 'Ao salvar o procedimento nada acontece',
    pageUrl: '/procedimentos',
    createdAt: new Date(),
    statusChangedAt: null,
    tenant: { id: 'tenant-1', name: 'Clínica Um' },
    user: { id: 'u1', name: 'Ana', email: 'ana@clinica.dev' },
  };

  let prisma: any;
  let notifications: jest.Mocked<Pick<NotificationsService, 'notifyMany'>>;
  let service: FeedbackAdminService;

  beforeEach(() => {
    prisma = {
      feedbackReport: {
        findMany: jest.fn().mockResolvedValue([report]),
        count: jest.fn().mockResolvedValue(1),
        groupBy: jest.fn().mockResolvedValue([
          { status: 'OPEN', _count: { _all: 1 } },
          { status: 'CLOSED', _count: { _all: 4 } },
        ]),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn().mockResolvedValue(undefined),
      },
      platformAuditLog: { create: jest.fn() },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'u1', active: true }),
        findMany: jest.fn(),
      },
    };
    notifications = { notifyMany: jest.fn().mockResolvedValue(undefined) };
    service = new FeedbackAdminService(prisma, notifications as unknown as NotificationsService);
  });

  describe('list', () => {
    it('lista de todas as clínicas, com filtros e contadores por status', async () => {
      const spy = jest.spyOn(TenantContext, 'runUnscoped');

      const result = await service.list({
        tenantId: 'tenant-1',
        type: 'BUG',
        status: 'OPEN',
        search: ' salva ',
        from: '2026-10-01',
        to: '2026-10-31',
        page: 2,
        limit: 10,
      } as any);

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
      const args = prisma.feedbackReport.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        tenantId: 'tenant-1',
        type: 'BUG',
        status: 'OPEN',
        createdAt: { gte: new Date('2026-10-01T03:00:00Z'), lt: new Date('2026-11-01T03:00:00Z') },
        OR: [
          { title: { contains: 'salva', mode: 'insensitive' } },
          { description: { contains: 'salva', mode: 'insensitive' } },
        ],
      });
      expect(args).toMatchObject({ skip: 10, take: 10, orderBy: { createdAt: 'desc' } });
      // Lista não traz a descrição (só o detalhe)
      expect(args.select.description).toBeUndefined();
      expect(prisma.feedbackReport.groupBy.mock.calls[0][0].where.status).toBeUndefined();
      expect(result).toMatchObject({
        total: 1,
        page: 2,
        limit: 10,
        totalPages: 1,
        counts: { OPEN: 1, TRIAGED: 0, CLOSED: 4 },
      });
    });

    it('sem filtros: where vazio, página 1 de 25', async () => {
      await service.list({} as any);
      expect(prisma.feedbackReport.findMany.mock.calls[0][0]).toMatchObject({ where: {}, skip: 0, take: 25 });
    });
  });

  it('detalhe inclui a descrição e a resposta; 404 se não existe', async () => {
    prisma.feedbackReport.findUnique.mockResolvedValueOnce(report);
    await service.get('fb-1');
    expect(prisma.feedbackReport.findUnique.mock.calls[0][0].select).toMatchObject({
      description: true,
      replyText: true,
      repliedAt: true,
      repliedByName: true,
    });

    prisma.feedbackReport.findUnique.mockResolvedValueOnce(null);
    await expect(service.get('x')).rejects.toThrow(NotFoundException);
  });

  describe('setStatus', () => {
    it('muda o status e audita com a clínica alvo', async () => {
      prisma.feedbackReport.findUnique.mockResolvedValue(report);
      prisma.feedbackReport.update.mockResolvedValue({ ...report, status: 'CLOSED' });
      const tenantSpy = jest.spyOn(TenantContext, 'run').mockImplementation((_id, fn) => fn());

      const result = await service.setStatus('fb-1', 'CLOSED' as any, actor);

      tenantSpy.mockRestore();
      expect(result.status).toBe('CLOSED');
      expect(prisma.feedbackReport.update.mock.calls[0][0]).toMatchObject({
        where: { id: 'fb-1' },
        data: { status: 'CLOSED', statusChangedAt: expect.any(Date) },
      });
      expect(prisma.platformAuditLog.create.mock.calls[0][0].data).toMatchObject({
        action: 'FEEDBACK_STATUS_CHANGE',
        actorId: 'root-1',
        targetTenantId: 'tenant-1',
        targetName: 'Clínica Um',
        details: { feedbackId: 'fb-1', type: 'BUG', title: 'Botão não salva', old: 'OPEN', new: 'CLOSED' },
      });
      expect(notifications.notifyMany).toHaveBeenCalledWith(
        ['u1'],
        expect.objectContaining({
          type: 'FEEDBACK_CLOSED',
          title: 'Bug concluído',
          message: '"Botão não salva" foi finalizado pela equipe da plataforma.',
          link: '/procedimentos',
        }),
      );
    });

    it('CLOSED com reportador inativo: notifica admins da clínica', async () => {
      prisma.feedbackReport.findUnique.mockResolvedValue(report);
      prisma.feedbackReport.update.mockResolvedValue({ ...report, status: 'CLOSED' });
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', active: false });
      prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }]);
      jest.spyOn(TenantContext, 'run').mockImplementation((_id, fn) => fn());

      await service.setStatus('fb-1', 'CLOSED' as any, actor);

      expect(notifications.notifyMany).toHaveBeenCalledWith(['admin-1', 'admin-2'], expect.any(Object));
    });

    it('TRIAGED: não notifica a clínica', async () => {
      prisma.feedbackReport.findUnique.mockResolvedValue(report);
      prisma.feedbackReport.update.mockResolvedValue({ ...report, status: 'TRIAGED' });

      await service.setStatus('fb-1', 'TRIAGED' as any, actor);

      expect(notifications.notifyMany).not.toHaveBeenCalled();
    });

    it('mesmo status: não grava nem audita', async () => {
      prisma.feedbackReport.findUnique.mockResolvedValue(report);
      await service.setStatus('fb-1', 'OPEN' as any, actor);
      expect(prisma.feedbackReport.update).not.toHaveBeenCalled();
      expect(prisma.platformAuditLog.create).not.toHaveBeenCalled();
    });

    it('404 se não existe', async () => {
      prisma.feedbackReport.findUnique.mockResolvedValue(null);
      await expect(service.setStatus('x', 'CLOSED' as any, actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('reply', () => {
    beforeEach(() => {
      jest.spyOn(TenantContext, 'run').mockImplementation((_id, fn) => fn());
    });
    afterEach(() => jest.restoreAllMocks());

    it('grava texto, autor e data, audita e envia o texto ao autor sem mudar o status', async () => {
      prisma.feedbackReport.findUnique.mockResolvedValue(report);
      prisma.feedbackReport.update.mockResolvedValue({ ...report, replyText: 'Corrigido na 1.4' });

      const result = await service.reply('fb-1', 'Corrigido na 1.4', actor);

      expect(result.replyText).toBe('Corrigido na 1.4');
      const data = prisma.feedbackReport.update.mock.calls[0][0].data;
      expect(data).toEqual({
        replyText: 'Corrigido na 1.4',
        repliedAt: expect.any(Date),
        repliedById: 'root-1',
        repliedByName: 'Dono',
      });
      expect(data.status).toBeUndefined();
      expect(prisma.platformAuditLog.create.mock.calls[0][0].data).toMatchObject({
        action: 'FEEDBACK_REPLY',
        targetTenantId: 'tenant-1',
        details: { feedbackId: 'fb-1', title: 'Botão não salva', edited: false },
      });
      await new Promise(setImmediate);
      expect(notifications.notifyMany).toHaveBeenCalledWith(['u1'], {
        type: 'FEEDBACK_REPLIED',
        title: 'Resposta da plataforma: Botão não salva',
        message: 'Corrigido na 1.4',
        metadata: { feedbackId: 'fb-1', feedbackType: 'BUG' },
      });
    });

    it('responder de novo sobrescreve e marca como edição', async () => {
      prisma.feedbackReport.findUnique.mockResolvedValue({ ...report, replyText: 'Antiga' });
      prisma.feedbackReport.update.mockResolvedValue({ ...report, replyText: 'Nova' });

      await service.reply('fb-1', 'Nova', actor);

      expect(prisma.feedbackReport.update.mock.calls[0][0].data.replyText).toBe('Nova');
      expect(prisma.platformAuditLog.create.mock.calls[0][0].data.details.edited).toBe(true);
      await new Promise(setImmediate);
      expect(notifications.notifyMany).toHaveBeenCalledTimes(1);
    });

    it('autor inativo: notifica admins da clínica', async () => {
      prisma.feedbackReport.findUnique.mockResolvedValue(report);
      prisma.feedbackReport.update.mockResolvedValue(report);
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', active: false });
      prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);

      await service.reply('fb-1', 'Ok', actor);
      await new Promise(setImmediate);

      expect(notifications.notifyMany).toHaveBeenCalledWith(['admin-1'], expect.objectContaining({ message: 'Ok' }));
    });

    it('404 se não existe', async () => {
      prisma.feedbackReport.findUnique.mockResolvedValue(null);
      await expect(service.reply('x', 'Oi', actor)).rejects.toThrow(NotFoundException);
      expect(prisma.feedbackReport.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('apaga de vez e audita com a clínica e o título', async () => {
      prisma.feedbackReport.findUnique.mockResolvedValue(report);

      await expect(service.remove('fb-1', actor)).resolves.toEqual({ ok: true });

      expect(prisma.feedbackReport.delete).toHaveBeenCalledWith({ where: { id: 'fb-1' } });
      expect(prisma.platformAuditLog.create.mock.calls[0][0].data).toMatchObject({
        action: 'FEEDBACK_DELETE',
        actorId: 'root-1',
        targetTenantId: 'tenant-1',
        targetName: 'Clínica Um',
        details: { feedbackId: 'fb-1', type: 'BUG', title: 'Botão não salva', status: 'OPEN', author: 'ana@clinica.dev' },
      });
      expect(notifications.notifyMany).not.toHaveBeenCalled();
    });

    it('404 se não existe', async () => {
      prisma.feedbackReport.findUnique.mockResolvedValue(null);
      await expect(service.remove('x', actor)).rejects.toThrow(NotFoundException);
      expect(prisma.feedbackReport.delete).not.toHaveBeenCalled();
    });
  });
});
