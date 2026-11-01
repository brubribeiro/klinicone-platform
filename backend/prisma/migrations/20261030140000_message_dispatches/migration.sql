-- CreateEnum
CREATE TYPE "MessageDispatchStatus" AS ENUM ('PENDING', 'SENT', 'SKIPPED');

-- CreateEnum
CREATE TYPE "MessageDispatchSource" AS ENUM ('AUTO', 'MANUAL');

-- CreateTable
CREATE TABLE "message_dispatches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "trigger" "MessageTrigger" NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "phone" TEXT,
    "renderedMessage" TEXT NOT NULL,
    "waMeUrl" TEXT,
    "status" "MessageDispatchStatus" NOT NULL DEFAULT 'PENDING',
    "source" "MessageDispatchSource" NOT NULL DEFAULT 'AUTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "message_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_dispatches_status_createdAt_idx" ON "message_dispatches"("status", "createdAt");

-- CreateIndex
CREATE INDEX "message_dispatches_tenantId_idx" ON "message_dispatches"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "message_dispatches_tenantId_dedupKey_key" ON "message_dispatches"("tenantId", "dedupKey");

-- AddForeignKey
ALTER TABLE "message_dispatches" ADD CONSTRAINT "message_dispatches_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "message_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_dispatches" ADD CONSTRAINT "message_dispatches_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_dispatches" ADD CONSTRAINT "message_dispatches_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_dispatches" ADD CONSTRAINT "message_dispatches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Same-tenant FK enforcement (multi-tenant)
CREATE TRIGGER "message_dispatches_templateId_same_tenant" BEFORE INSERT OR UPDATE OF "templateId", "tenantId" ON "message_dispatches"
  FOR EACH ROW EXECUTE FUNCTION enforce_same_tenant('templateId', 'message_templates');
CREATE TRIGGER "message_dispatches_patientId_same_tenant" BEFORE INSERT OR UPDATE OF "patientId", "tenantId" ON "message_dispatches"
  FOR EACH ROW EXECUTE FUNCTION enforce_same_tenant('patientId', 'patients');
CREATE TRIGGER "message_dispatches_appointmentId_same_tenant" BEFORE INSERT OR UPDATE OF "appointmentId", "tenantId" ON "message_dispatches"
  FOR EACH ROW EXECUTE FUNCTION enforce_same_tenant('appointmentId', 'appointments');

-- Row level security (Supabase hardening; Prisma bypasses)
ALTER TABLE "message_dispatches" ENABLE ROW LEVEL SECURITY;
