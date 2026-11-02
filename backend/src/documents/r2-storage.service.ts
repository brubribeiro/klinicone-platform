import { ForbiddenException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

import { TenantContext } from '../tenancy/tenant-context';

@Injectable()
export class R2StorageService implements OnModuleInit {
  private client: S3Client | null = null;
  private bucket: string;
  private readonly logger = new Logger(R2StorageService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const accountId = this.config.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY');
    this.bucket = this.config.get<string>('R2_BUCKET_NAME', 'mila-barreto-platform');

    if (!accountId || !accessKeyId || !secretAccessKey) {
      this.logger.warn(
        'Cloudflare R2 não configurado (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY ausentes). Upload desabilitado.',
      );
      return;
    }

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.logger.log('Cloudflare R2 configurado com sucesso.');
  }

  get isConfigured(): boolean {
    return !!this.client;
  }

  /**
   * Keys novas: `tenants/<tenantId>/...`. Keys legadas (sem prefixo) são aceitas
   * só com tenant no contexto. Keys de outro tenant são sempre recusadas.
   */
  assertKeyBelongsToTenant(key: string): void {
    if (!key || key.includes('..') || key.startsWith('/')) {
      throw new ForbiddenException('Chave de armazenamento inválida.');
    }
    const store = TenantContext.current();
    if (store?.unscoped) return;

    const tenantId = store?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Operação de arquivo exige o contexto de uma clínica.');
    }

    if (key.startsWith('tenants/')) {
      const prefix = `tenants/${tenantId}/`;
      if (!key.startsWith(prefix)) {
        throw new ForbiddenException('Arquivo fora do escopo desta clínica.');
      }
    }
    // legado pré-multi-tenant: sem prefixo tenants/ — permitido só com tenant ativo
  }

  /**
   * Faz upload de um arquivo para o R2.
   * Retorna só a key; acesso posterior via URL assinada (presign), nunca URL pública durável.
   */
  async upload(
    fileName: string,
    mimeType: string,
    buffer: Buffer,
    subfolder?: string,
  ): Promise<{ key: string }> {
    if (!this.client) throw new Error('Cloudflare R2 não está configurado.');

    const uuid = randomUUID().slice(0, 8);
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const tenantPrefix = `tenants/${TenantContext.requireTenantId()}`;
    const key = subfolder
      ? `${tenantPrefix}/${subfolder}/${uuid}-${safeName}`
      : `${tenantPrefix}/${uuid}-${safeName}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ContentDisposition: 'attachment',
      }),
    );

    return { key };
  }

  /** Remove um arquivo do R2 pela key. */
  async remove(key: string): Promise<void> {
    if (!this.client) return;
    this.assertKeyBelongsToTenant(key);
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (err) {
      this.logger.warn(`Falha ao excluir arquivo do R2 (${key}): ${err.message}`);
    }
  }

  /** Gera URL temporária assinada para acesso privado ao arquivo no R2. */
  async getPresignedUrl(key: string, expiresInSeconds = 900): Promise<string> {
    if (!this.client) throw new Error('Cloudflare R2 não está configurado.');
    this.assertKeyBelongsToTenant(key);

    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: 'attachment',
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  /** Retorna o conteúdo de um arquivo como Buffer (para proxy/download). */
  async download(key: string): Promise<{ buffer: Buffer; contentType: string }> {
    if (!this.client) throw new Error('Cloudflare R2 não está configurado.');
    this.assertKeyBelongsToTenant(key);

    const res = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    const chunks: Buffer[] = [];
    for await (const chunk of res.Body as any) {
      chunks.push(Buffer.from(chunk));
    }

    return {
      buffer: Buffer.concat(chunks),
      contentType: res.ContentType ?? 'application/octet-stream',
    };
  }
}
