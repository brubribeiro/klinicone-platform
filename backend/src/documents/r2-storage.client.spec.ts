import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { TenantContext } from '../tenancy/tenant-context';
import { R2StorageService } from './r2-storage.service';

const send = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ kind: 'put', input })),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ kind: 'delete', input })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ kind: 'get', input })),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/file'),
}));

function make(values: Record<string, string | undefined>) {
  const service = new R2StorageService({
    get: (k: string, d?: string) => values[k] ?? d,
  } as unknown as ConfigService);
  service.onModuleInit();
  return service;
}

const configured = { R2_ACCOUNT_ID: 'acc', R2_ACCESS_KEY_ID: 'key', R2_SECRET_ACCESS_KEY: 'secret' };

beforeEach(() => send.mockReset());

describe('R2StorageService sem configuração', () => {
  it('fica desabilitado e recusa operações', async () => {
    const s = make({});
    expect(s.isConfigured).toBe(false);
    await expect(s.upload('a.txt', 'text/plain', Buffer.from('x'))).rejects.toThrow('não está configurado');
    await expect(s.getPresignedUrl('k')).rejects.toThrow('não está configurado');
    await expect(s.download('k')).rejects.toThrow('não está configurado');
    await expect(s.remove('k')).resolves.toBeUndefined();
  });
});

describe('R2StorageService configurado (S3 simulado)', () => {
  it('envia o arquivo sob o prefixo da clínica com nome saneado', async () => {
    const s = make(configured);
    expect(s.isConfigured).toBe(true);
    send.mockResolvedValue({});
    const { key } = await TenantContext.run('t1', () => s.upload('meu arquivo (1).pdf', 'application/pdf', Buffer.from('x'), 'docs'));
    expect(key).toMatch(/^tenants\/t1\/docs\/[0-9a-f]{8}-meu_arquivo__1_.pdf$/);
    expect(send.mock.calls[0][0].input).toMatchObject({ Bucket: 'klinicone-platform', Key: key, ContentType: 'application/pdf' });

    const { key: plain } = await TenantContext.run('t1', () => s.upload('a.txt', 'text/plain', Buffer.from('x')));
    expect(plain).toMatch(/^tenants\/t1\/[0-9a-f]{8}-a.txt$/);
  });

  it('remove, engolindo falhas do storage, e recusa chave de outra clínica', async () => {
    const s = make({ ...configured, R2_BUCKET_NAME: 'outro' });
    send.mockResolvedValueOnce({});
    await TenantContext.run('t1', () => s.remove('tenants/t1/x'));
    expect(send.mock.calls[0][0]).toMatchObject({ kind: 'delete', input: { Bucket: 'outro', Key: 'tenants/t1/x' } });

    send.mockRejectedValueOnce(new Error('rede'));
    await expect(TenantContext.run('t1', () => s.remove('tenants/t1/y'))).resolves.toBeUndefined();
    await expect(TenantContext.run('t1', () => s.remove('tenants/t2/y'))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(TenantContext.run('t1', async () => s.assertKeyBelongsToTenant('../etc'))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('gera URL assinada e baixa o conteúdo', async () => {
    const s = make(configured);
    expect(await TenantContext.run('t1', () => s.getPresignedUrl('tenants/t1/x', 60))).toBe('https://signed.example/file');

    send.mockResolvedValueOnce({
      Body: (async function* () {
        yield Buffer.from('ab');
        yield Buffer.from('cd');
      })(),
      ContentType: 'image/png',
    });
    const file = await TenantContext.run('t1', () => s.download('tenants/t1/x'));
    expect(file.buffer.toString()).toBe('abcd');
    expect(file.contentType).toBe('image/png');

    send.mockResolvedValueOnce({ Body: (async function* () {})() });
    expect((await TenantContext.run('t1', () => s.download('tenants/t1/x'))).contentType).toBe('application/octet-stream');
  });
});
