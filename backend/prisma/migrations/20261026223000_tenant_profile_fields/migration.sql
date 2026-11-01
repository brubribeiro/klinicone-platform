-- Perfil da clínica no control plane (super-admin).
ALTER TABLE "tenants" ADD COLUMN "specialties" JSONB;
ALTER TABLE "tenants" ADD COLUMN "foundedAt" DATE;
ALTER TABLE "tenants" ADD COLUMN "legalName" TEXT;
ALTER TABLE "tenants" ADD COLUMN "document" TEXT;
ALTER TABLE "tenants" ADD COLUMN "phone" TEXT;
ALTER TABLE "tenants" ADD COLUMN "email" TEXT;
ALTER TABLE "tenants" ADD COLUMN "city" TEXT;
ALTER TABLE "tenants" ADD COLUMN "state" TEXT;
ALTER TABLE "tenants" ADD COLUMN "notes" TEXT;
