import { BadRequestException, ConflictException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

import { getAppVersion } from '../common/version';
import { TenantContext } from '../tenancy/tenant-context';
import { ANNOUNCEMENT_AUDIENCE, AnnouncementsService, SYSTEM_ACTOR } from './announcements.service';
import { parseReleaseNotes, RELEASE_BODY_MAX } from './release-notes';

jest.mock('../common/version', () => ({ getAppVersion: jest.fn(() => '0.3.0') }));

const NOTES = `# Release Notes

Intro.

---

## v0.3.0 — 1 nov 2026

### Novidades

**Agenda**
- Botão **Novo agendamento** no topo.
- Lembretes por \`WhatsApp\`.

### Correções

- Corrigido o filtro do financeiro.

### Correções de segurança

- Só administradores mudam grupos.

A versão aparece no menu lateral.

---

## v0.2.0 — 15 jul 2026

### Novidades

- Coisa antiga.
`;

describe('parseReleaseNotes', () => {
  it('separa novidades e correções da versão pedida, sem markdown nem rodapé', () => {
    const section = parseReleaseNotes(NOTES, '0.3.0')!;

    expect(section.version).toBe('0.3.0');
    expect(section.drafts).toEqual([
      {
        kind: 'FEATURE',
        title: 'Novidades da versão 0.3.0',
        body: 'Agenda\n• Botão Novo agendamento no topo.\n• Lembretes por WhatsApp.',
      },
      {
        kind: 'FIX',
        title: 'Correções da versão 0.3.0',
        body: '• Corrigido o filtro do financeiro.\nCorreções de segurança\n• Só administradores mudam grupos.',
      },
    ]);
  });

  it('sem a versão pedida usa a seção mais recente; versão só com novidades gera um rascunho', () => {
    expect(parseReleaseNotes(NOTES, '9.9.9')?.version).toBe('0.3.0');
    const old = parseReleaseNotes(NOTES.replace(/## v0\.3\.0[\s\S]*?---\n\n/, ''), '0.2.0')!;
    expect(old.drafts.map((d) => d.kind)).toEqual(['FEATURE']);
  });

  it('corta corpos longos e o RELEASE_NOTES.md do repositório é lido', () => {
    const long = `## v1.0.0\n\n### Novidades\n\n${Array.from({ length: 200 }, (_, i) => `- Item ${i} ${'x'.repeat(30)}`).join('\n')}`;
    const body = parseReleaseNotes(long)!.drafts[0].body;
    expect(body.length).toBeLessThanOrEqual(RELEASE_BODY_MAX);
    expect(body.endsWith('• E outras melhorias.')).toBe(true);

    const real = readFileSync(join(__dirname, '../../../RELEASE_NOTES.md'), 'utf8');
    expect(parseReleaseNotes(real)?.drafts.length).toBeGreaterThan(0);
  });
});

describe('AnnouncementsService', () => {
  const actor = { id: 'root-1', name: 'Dono', email: 'root@platform.dev', isSuperAdmin: true } as any;
  const draft = {
    id: 'a-1',
    version: '0.3.0',
    kind: 'FEATURE',
    title: 'Novidades da versão 0.3.0',
    body: '• Algo novo',
    status: 'DRAFT',
    scheduledAt: null,
    sentAt: null,
    recipientCount: null,
  };

  let prisma: any;
  let service: AnnouncementsService;
  let store: Map<string, any>;

  const audits = () => prisma.platformAuditLog.create.mock.calls.map((c: any[]) => c[0].data);

  beforeEach(() => {
    store = new Map([[draft.id, { ...draft }]]);
    prisma = {
      platformAnnouncement: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(({ where }) => Promise.resolve(store.get(where.id) ?? null)),
        create: jest.fn(({ data }) => Promise.resolve({ id: `new-${data.kind}`, status: 'DRAFT', ...data })),
        update: jest.fn(({ where, data }) => {
          const next = { ...store.get(where.id), ...data };
          store.set(where.id, next);
          return Promise.resolve(next);
        }),
        updateMany: jest.fn(({ where, data }) => {
          const a = store.get(where.id);
          if (!a || !where.status.in.includes(a.status)) return Promise.resolve({ count: 0 });
          store.set(where.id, { ...a, ...data });
          return Promise.resolve({ count: 1 });
        }),
        delete: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'u-1', tenantId: 't-1' },
          { id: 'u-2', tenantId: 't-1' },
          { id: 'u-3', tenantId: 't-2' },
        ]),
        count: jest.fn(),
      },
      tenant: { count: jest.fn() },
      notification: { createMany: jest.fn().mockResolvedValue({ count: 3 }) },
      platformAuditLog: { create: jest.fn(), count: jest.fn().mockResolvedValue(0) },
    };
    service = new AnnouncementsService(prisma);
    jest.spyOn(require('./release-notes'), 'readReleaseNotes').mockReturnValue(NOTES);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('discardObsoleteDraftVersions', () => {
    it('remove só rascunhos DRAFT das versões informadas', async () => {
      prisma.platformAnnouncement.deleteMany.mockResolvedValue({ count: 2 });

      const result = await service.discardObsoleteDraftVersions(['0.2.1']);

      expect(result.deleted).toBe(2);
      expect(prisma.platformAnnouncement.deleteMany).toHaveBeenCalledWith({
        where: { version: { in: ['0.2.1'] }, status: 'DRAFT' },
      });
    });
  });

  describe('draftFromRelease', () => {
    it('cria um rascunho por tipo da versão atual e audita', async () => {
      const result = await service.draftFromRelease(actor);

      expect(result.created.map((a) => a.kind)).toEqual(['FEATURE', 'FIX']);
      expect(prisma.platformAnnouncement.create.mock.calls[0][0].data).toMatchObject({
        version: '0.3.0',
        kind: 'FEATURE',
        title: 'Novidades da versão 0.3.0',
      });
      expect(audits()[0]).toMatchObject({ action: 'ANNOUNCEMENT_GENERATE', actorId: 'root-1', targetTenantId: null });
    });

    it('não sobrescreve o tipo que já tem aviso dessa versão', async () => {
      prisma.platformAnnouncement.findMany.mockResolvedValue([{ kind: 'FEATURE' }]);

      const result = await service.draftFromRelease(actor);

      expect(result.created.map((a) => a.kind)).toEqual(['FIX']);
      expect(result.skipped).toEqual(['FEATURE']);
    });

    it('no boot roda uma vez por versão', async () => {
      prisma.platformAuditLog.count.mockResolvedValue(1);

      const result = await service.draftFromRelease(SYSTEM_ACTOR, { onBoot: true });

      expect(result.created).toEqual([]);
      expect(prisma.platformAnnouncement.create).not.toHaveBeenCalled();
      expect(prisma.platformAuditLog.count.mock.calls[0][0].where.details).toEqual({
        path: ['version'],
        equals: '0.3.0',
      });
    });

    it('recusa quando o RELEASE_NOTES.md não tem a versão do VERSION', async () => {
      (getAppVersion as jest.Mock).mockReturnValueOnce('0.9.9');
      await expect(service.draftFromRelease(actor)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('fluxo rascunho → envio', () => {
    it('edita, envia para os usuários das clínicas ativas e não envia de novo', async () => {
      const unscoped = jest.spyOn(TenantContext, 'runUnscoped');

      await service.update(draft.id, { title: 'Chegou a agenda nova', kind: 'FEATURE' as any }, actor);
      const sent = await service.send(draft.id, actor);

      expect(sent).toMatchObject({ status: 'SENT', recipientCount: 3 });
      expect(sent.sentAt).toBeInstanceOf(Date);
      expect(unscoped).toHaveBeenCalled();
      expect(prisma.user.findMany.mock.calls[0][0].where).toBe(ANNOUNCEMENT_AUDIENCE);
      expect(ANNOUNCEMENT_AUDIENCE).toMatchObject({ isSuperAdmin: false, tenant: { active: true } });
      const rows = prisma.notification.createMany.mock.calls[0][0].data;
      expect(rows).toHaveLength(3);
      expect(rows[2]).toMatchObject({
        tenantId: 't-2',
        userId: 'u-3',
        type: 'PLATFORM_ANNOUNCEMENT',
        title: 'Chegou a agenda nova',
        message: '• Algo novo',
      });
      expect(audits().map((a: any) => a.action)).toEqual(['ANNOUNCEMENT_UPDATE', 'ANNOUNCEMENT_SEND']);
      expect(audits()[1].details).toMatchObject({ recipientCount: 3, tenantCount: 2 });

      await expect(service.send(draft.id, actor)).rejects.toBeInstanceOf(ConflictException);
      await expect(service.update(draft.id, { title: 'Outro' }, actor)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.notification.createMany).toHaveBeenCalledTimes(1);
    });

    it('se a entrega falha, o aviso volta a ser rascunho', async () => {
      prisma.notification.createMany.mockRejectedValue(new Error('db fora'));

      await expect(service.send(draft.id, actor)).rejects.toThrow('db fora');

      expect(store.get(draft.id)).toMatchObject({ status: 'DRAFT', sentAt: null });
      expect(audits()).toEqual([]);
    });

    it('agenda no futuro e o timer envia quando vence, com o Sistema como autor', async () => {
      await expect(service.schedule(draft.id, new Date(Date.now() - 1000), actor)).rejects.toBeInstanceOf(
        BadRequestException,
      );

      const when = new Date(Date.now() + 60 * 60 * 1000);
      const scheduled = await service.schedule(draft.id, when, actor);
      expect(scheduled).toMatchObject({ status: 'SCHEDULED', scheduledAt: when });

      prisma.platformAnnouncement.findMany.mockResolvedValue([{ id: draft.id }]);
      await service.sendDue();

      expect(store.get(draft.id).status).toBe('SENT');
      const send = audits().at(-1);
      expect(send).toMatchObject({ action: 'ANNOUNCEMENT_SEND', actorId: 'system' });
      expect(send.details.scheduledAt).toBe(when.toISOString());
    });

    it('cancelar agendamento volta a rascunho', async () => {
      await service.schedule(draft.id, new Date(Date.now() + 60_000), actor);
      const back = await service.unschedule(draft.id, actor);

      expect(back).toMatchObject({ status: 'DRAFT', scheduledAt: null });
      await expect(service.unschedule(draft.id, actor)).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
