import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

import { RolesService } from './roles.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { DeletionConflictException } from '../common/deletion/deletion-dependencies';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ALL_PERMISSIONS, SYSTEM_ADMIN_ROLE_NAME } from '../common/permissions';

describe('RolesService', () => {
  let service: RolesService;
  let prisma: any;
  let auditLog: any;

  const mockRole = {
    id: 'role-1',
    name: 'Profissional',
    description: 'Profissional da clínica',
    permissions: ['appointments:view', 'appointments:edit'],
    restrictToOwnAppointments: true,
    isSystem: false,
    _count: { users: 2 },
  };

  const adminActor = {
    id: 'admin-1',
    name: 'Admin',
    roleId: 'role-admin',
    roleName: SYSTEM_ADMIN_ROLE_NAME,
  } as AuthenticatedUser;

  const managerActor = {
    id: 'manager-1',
    name: 'Gerente',
    roleId: 'role-gerente',
    roleName: 'Gerente',
  } as AuthenticatedUser;

  beforeEach(async () => {
    prisma = {
      role: {
        findMany: jest.fn().mockResolvedValue([mockRole]),
        findUnique: jest.fn().mockResolvedValue(mockRole),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(mockRole),
        update: jest.fn().mockResolvedValue(mockRole),
        delete: jest.fn().mockResolvedValue(mockRole),
      },
    };

    auditLog = {
      logCreate: jest.fn().mockResolvedValue(undefined),
      logUpdate: jest.fn().mockResolvedValue(undefined),
      logDelete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  describe('findOne', () => {
    it('should throw NotFoundException if not found', async () => {
      prisma.role.findUnique.mockResolvedValue(null);
      await expect(service.findOne('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should forbid non-admin from creating roles', async () => {
      await expect(
        service.create({ name: 'Test', permissions: ['appointments:view'] } as any, managerActor),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.role.create).not.toHaveBeenCalled();
    });

    it('should throw for invalid permissions', async () => {
      await expect(
        service.create({ name: 'Test', permissions: ['invalid:perm'] } as any, adminActor),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException for duplicate name', async () => {
      prisma.role.findFirst.mockResolvedValue(mockRole);
      await expect(
        service.create({ name: 'Profissional', permissions: ['appointments:view'] } as any, adminActor),
      ).rejects.toThrow(ConflictException);
    });

    it('should create role when valid admin', async () => {
      prisma.role.findFirst.mockResolvedValue(null);
      await service.create(
        {
          name: 'Novo Grupo',
          permissions: ['appointments:view'],
        } as any,
        adminActor,
      );
      expect(prisma.role.create).toHaveBeenCalled();
    });

    it('should forbid non-admin from creating a role with full catalog', async () => {
      await expect(
        service.create(
          { name: 'Super', permissions: [...ALL_PERMISSIONS] } as any,
          managerActor,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.role.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should forbid non-admin from editing roles (self-escalation)', async () => {
      await expect(
        service.update(
          'role-gerente',
          { permissions: [...ALL_PERMISSIONS] } as any,
          managerActor,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.role.update).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if renaming system role', async () => {
      prisma.role.findUnique.mockResolvedValue({ ...mockRole, isSystem: true });
      await expect(
        service.update('role-1', { name: 'Novo Nome' } as any, adminActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should sync admin permissions to full catalog on update', async () => {
      const adminRole = {
        ...mockRole,
        isSystem: true,
        name: 'Administrador',
        permissions: ['appointments:view'],
      };
      prisma.role.findUnique.mockResolvedValue(adminRole);
      prisma.role.update.mockResolvedValue(adminRole);

      await service.update('role-1', { permissions: ['appointments:view'] } as any, adminActor);

      expect(prisma.role.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            permissions: expect.arrayContaining(['appointments:view', 'patients:view']),
          }),
        }),
      );
    });

    it('should allow admin to update a custom role permissions', async () => {
      await service.update(
        'role-1',
        { permissions: ['appointments:view', 'patients:view'] } as any,
        adminActor,
      );
      expect(prisma.role.update).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should forbid non-admin from deleting roles', async () => {
      await expect(service.remove('role-1', managerActor)).rejects.toThrow(ForbiddenException);
      expect(prisma.role.delete).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException for system role', async () => {
      prisma.role.findUnique.mockResolvedValue({ ...mockRole, isSystem: true });
      await expect(service.remove('role-1', adminActor)).rejects.toThrow(ForbiddenException);
    });

    it('responde 409 sem opção de desvincular quando o grupo tem usuários', async () => {
      prisma.user = { findMany: jest.fn().mockResolvedValue([{ name: 'Ana' }, { name: 'Bia' }]) };
      const err = await service.remove('role-1', adminActor).catch((e) => e);
      expect(err).toBeInstanceOf(DeletionConflictException);
      const body = err.getResponse();
      expect(body.canUnlink).toBe(false);
      expect(body.dependencies).toEqual([
        expect.objectContaining({ type: 'users', count: 2, names: ['Ana', 'Bia'], unlinkable: false }),
      ]);
      expect(prisma.role.delete).not.toHaveBeenCalled();
    });

    it('should delete role with no users', async () => {
      prisma.role.findUnique.mockResolvedValue({ ...mockRole, _count: { users: 0 } });
      await service.remove('role-1', adminActor);
      expect(prisma.role.delete).toHaveBeenCalledWith({ where: { id: 'role-1' } });
    });
  });

  describe('catalog', () => {
    it('should return permissions array', () => {
      const result = service.catalog();
      expect(result).toHaveProperty('permissions');
      expect(Array.isArray(result.permissions)).toBe(true);
    });
  });
});
