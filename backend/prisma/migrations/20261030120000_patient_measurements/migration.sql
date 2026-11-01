-- Histórico de medidas corporais do paciente (#65).
-- CreateTable
CREATE TABLE "patient_measurements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT current_setting('app.tenant_id'::text, true),
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "weightKg" DECIMAL(5,2),
    "heightCm" DECIMAL(5,1),
    "waistCm" DECIMAL(5,1),
    "abdomenCm" DECIMAL(5,1),
    "hipCm" DECIMAL(5,1),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patient_measurements_patientId_measuredAt_idx" ON "patient_measurements"("patientId", "measuredAt");

-- CreateIndex
CREATE INDEX "patient_measurements_appointmentId_idx" ON "patient_measurements"("appointmentId");

-- CreateIndex
CREATE INDEX "patient_measurements_tenantId_idx" ON "patient_measurements"("tenantId");

-- AddForeignKey
ALTER TABLE "patient_measurements" ADD CONSTRAINT "patient_measurements_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_measurements" ADD CONSTRAINT "patient_measurements_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_measurements" ADD CONSTRAINT "patient_measurements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Bloqueia acesso via anon/authenticated key do Supabase (ver 20260623120000_enable_rls_all_tables)
ALTER TABLE "patient_measurements" ENABLE ROW LEVEL SECURITY;

-- Paciente e agendamento precisam ser da mesma clínica (ver 20261025120000_multi_tenant)
CREATE TRIGGER "patient_measurements_patientId_same_tenant" BEFORE INSERT OR UPDATE OF "patientId", "tenantId" ON "patient_measurements"
  FOR EACH ROW EXECUTE FUNCTION enforce_same_tenant('patientId', 'patients');
CREATE TRIGGER "patient_measurements_appointmentId_same_tenant" BEFORE INSERT OR UPDATE OF "appointmentId", "tenantId" ON "patient_measurements"
  FOR EACH ROW EXECUTE FUNCTION enforce_same_tenant('appointmentId', 'appointments');
