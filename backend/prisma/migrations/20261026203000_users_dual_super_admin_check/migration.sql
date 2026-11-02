-- Permite super-admin dual (isSuperAdmin + tenantId + roleId da clínica); super-admin puro continua sem tenant.
ALTER TABLE "users" DROP CONSTRAINT "users_tenant_or_super_admin_check";

ALTER TABLE "users" ADD CONSTRAINT "users_tenant_or_super_admin_check" CHECK (
  ("isSuperAdmin" AND "tenantId" IS NULL)
  OR ("tenantId" IS NOT NULL AND "roleId" IS NOT NULL)
);
