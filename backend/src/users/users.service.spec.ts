import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { R2StorageService } from '../documents/r2-storage.service';
import { PlanLimitsService } from '../plan-limits/plan-limits.service';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SYSTEM_ADMIN_ROLE_NAME } from '../common/permissions';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;
  let notifications: any;
  let auditLog: any;
  let planLimits: any;

  const mockUser = {
    id: 'user-1',
    name: 'Ana',
    email: 'ana@clinic.com',
    roleId: 'role-1',
    active: true,
    providesAppointments: true,
    isPrimary: false,
    role: { id: 'role-1', name: 'Profissional', isSystem: false },
  };

  const adminActor = {
    id: 'admin-1',
    name: 'Admin',
    roleName: SYSTEM_ADMIN_ROLE_NAME,
  } as AuthenticatedUser;

  const managerActor = {
    id: 'manager-1',
    name: 'Gerente',
    roleName: 'Gerente',
  } as AuthenticatedUser;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
        findMany: jest.fn().mockResolvedValue([mockUser]),
        create: jest.fn().mockResolvedValue(mockUser),
        update: jest.fn().mockResolvedValue(mockUser),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        delete: jest.fn().mockResolvedValue(mockUser),
      },
      role: {
        findUnique: jest.fn().mockResolvedValue({ id: 'role-1', name: 'Profissional' }),
      },
      appointment: {
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([]),
      },
      unavailability: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      workingHours: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    notifications = {
      findUsersWithPermission: jest.fn().mockResolvedValue([]),
      notifyMany: jest.fn().mockResolvedValue(undefined),
    };

    auditLog = {
      logCreate: jest.fn().mockResolvedValue(undefined),
      logUpdate: jest.fn().mockResolvedValue(undefined),
      logDelete: jest.fn().mockResolvedValue(undefined),
    };

    planLimits = { assertCanAddUser: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: AuditLogService, useValue: auditLog },
        { provide: R2StorageService, useValue: { upload: jest.fn(), remove: jest.fn(), getPresignedUrl: jest.fn() } },
        { provide: PlanLimitsService, useValue: planLimits },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findByEmail', () => {
    it('should return user with role and clinic', async () => {
      const result = await service.findByEmail('ana@clinic.com');
      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'ana@clinic.com' },
        include: {
          role: true,
          tenant: { include: { plan: { select: { features: true } } } },
        },
      });
    });
  });

  describe('list', () => {
    it('should return users with safe select', async () => {
      await service.list();
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: 'asc' } }),
      );
    });
  });

  describe('create', () => {
    it('should throw ConflictException if email exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.create({ name: 'Ana', email: 'ana@clinic.com', roleId: 'role-1' } as any, managerActor),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for invalid role', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ name: 'Ana', email: 'new@clinic.com', roleId: 'invalid' } as any, managerActor),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create user with hashed password', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.create(
        {
          name: 'Ana',
          email: 'new@clinic.com',
          roleId: 'role-1',
        } as any,
        managerActor,
      );

      expect(prisma.user.create).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('não cria usuário ativo quando o limite do plano foi atingido', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      planLimits.assertCanAddUser.mockRejectedValue(new ForbiddenException('Limite do plano atingido'));

      await expect(
        service.create({ name: 'Ana', email: 'new@clinic.com', roleId: 'role-1' } as any, managerActor),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('usuário criado inativo não consulta o limite', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await service.create(
        { name: 'Ana', email: 'new@clinic.com', roleId: 'role-1', active: false } as any,
        managerActor,
      );
      expect(planLimits.assertCanAddUser).not.toHaveBeenCalled();
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should unset other primary users when isPrimary is true', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await service.create(
        {
          name: 'Ana',
          email: 'new@clinic.com',
          roleId: 'role-1',
          isPrimary: true,
        } as any,
        managerActor,
      );

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { isPrimary: true },
        data: { isPrimary: false },
      });
    });

    it('should forbid non-admin from creating an Administrador', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-admin',
        name: SYSTEM_ADMIN_ROLE_NAME,
      });

      await expect(
        service.create(
          { name: 'Boss', email: 'boss@clinic.com', roleId: 'role-admin' } as any,
          managerActor,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should allow admin to create an Administrador', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-admin',
        name: SYSTEM_ADMIN_ROLE_NAME,
      });

      await service.create(
        { name: 'Boss', email: 'boss@clinic.com', roleId: 'role-admin' } as any,
        adminActor,
      );

      expect(prisma.user.create).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.update('invalid', {} as any, managerActor)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if new email already exists', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(mockUser) // findById
        .mockResolvedValueOnce({ id: 'other' }); // findByEmail

      await expect(
        service.update('user-1', { email: 'taken@clinic.com' } as any, managerActor),
      ).rejects.toThrow(ConflictException);
    });

    it('should update user successfully', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.update('user-1', { name: 'Ana Maria' } as any, managerActor);
      expect(prisma.user.update).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(planLimits.assertCanAddUser).not.toHaveBeenCalled();
    });

    it('reativar usuário respeita o limite do plano', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, active: false });
      planLimits.assertCanAddUser.mockRejectedValue(new ForbiddenException('Limite do plano atingido'));

      await expect(service.update('user-1', { active: true } as any, managerActor)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should forbid self role change', async () => {
      const self = { ...mockUser, id: 'manager-1' };
      prisma.user.findUnique.mockResolvedValue(self);
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-admin',
        name: SYSTEM_ADMIN_ROLE_NAME,
      });

      await expect(
        service.update('manager-1', { roleId: 'role-admin' } as any, managerActor),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should forbid non-admin from promoting someone to Administrador', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-admin',
        name: SYSTEM_ADMIN_ROLE_NAME,
      });

      await expect(
        service.update('user-1', { roleId: 'role-admin' } as any, managerActor),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should allow admin to promote someone to Administrador', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-admin',
        name: SYSTEM_ADMIN_ROLE_NAME,
      });

      await service.update('user-1', { roleId: 'role-admin' } as any, adminActor);

      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('should forbid non-admin from demoting an Administrador', async () => {
      const adminUser = {
        ...mockUser,
        id: 'admin-user',
        roleId: 'role-admin',
        role: { id: 'role-admin', name: SYSTEM_ADMIN_ROLE_NAME, isSystem: true },
      };
      prisma.user.findUnique.mockResolvedValue(adminUser);
      prisma.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'Profissional' });

      await expect(
        service.update('admin-user', { roleId: 'role-1' } as any, managerActor),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should allow manager to assign a non-admin role to another user', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.role.findUnique.mockResolvedValue({ id: 'role-2', name: 'Recepção' });

      await service.update('user-1', { roleId: 'role-2' } as any, managerActor);

      expect(prisma.user.update).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should throw if deleting yourself', async () => {
      await expect(service.remove('user-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should deactivate user if has appointments', async () => {
      prisma.appointment.count.mockResolvedValue(5);

      await service.remove('user-1', 'admin-1');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { active: false } }),
      );
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('should hard-delete user if no appointments', async () => {
      prisma.appointment.count.mockResolvedValue(0);

      await service.remove('user-1', 'admin-1');

      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });
  });
});
