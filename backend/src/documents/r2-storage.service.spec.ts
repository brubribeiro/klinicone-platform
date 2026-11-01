import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { TenantContext } from '../tenancy/tenant-context';
import { R2StorageService } from './r2-storage.service';

describe('R2StorageService.assertKeyBelongsToTenant', () => {
  let service: R2StorageService;

  beforeEach(() => {
    service = new R2StorageService({
      get: () => undefined,
    } as unknown as ConfigService);
  });

  it('rejects keys of another tenant', async () => {
    await TenantContext.run('tenant-a', async () => {
      expect(() => service.assertKeyBelongsToTenant('tenants/tenant-b/docs/x.pdf')).toThrow(
        ForbiddenException,
      );
    });
  });

  it('allows keys of the current tenant', async () => {
    await TenantContext.run('tenant-a', async () => {
      expect(() => service.assertKeyBelongsToTenant('tenants/tenant-a/docs/x.pdf')).not.toThrow();
    });
  });

  it('allows legacy keys without tenants/ prefix when tenant is set', async () => {
    await TenantContext.run('tenant-a', async () => {
      expect(() => service.assertKeyBelongsToTenant('pacientes/old/foto.jpg')).not.toThrow();
    });
  });

  it('allows any key when unscoped', async () => {
    await TenantContext.runUnscoped(async () => {
      expect(() => service.assertKeyBelongsToTenant('tenants/other/x')).not.toThrow();
    });
  });

  it('rejects when there is no tenant context', () => {
    expect(() => service.assertKeyBelongsToTenant('tenants/tenant-a/x')).toThrow(ForbiddenException);
  });
});
