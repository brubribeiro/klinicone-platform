-- CreateTable
CREATE TABLE "appointment_procedures" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "appointment_procedures_pkey" PRIMARY KEY ("id")
);

-- Backfill from legacy single procedureId
INSERT INTO "appointment_procedures" ("id", "tenantId", "appointmentId", "procedureId", "sortOrder")
SELECT gen_random_uuid()::text, "tenantId", "id", "procedureId", 0
FROM "appointments"
WHERE "procedureId" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "appointment_procedures_appointmentId_procedureId_key" ON "appointment_procedures"("appointmentId", "procedureId");
CREATE INDEX "appointment_procedures_tenantId_idx" ON "appointment_procedures"("tenantId");
CREATE INDEX "appointment_procedures_procedureId_idx" ON "appointment_procedures"("procedureId");

-- AddForeignKey
ALTER TABLE "appointment_procedures" ADD CONSTRAINT "appointment_procedures_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appointment_procedures" ADD CONSTRAINT "appointment_procedures_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "procedures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointment_procedures" ADD CONSTRAINT "appointment_procedures_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- enforce_same_tenant (appointment + procedure same clinic)
CREATE OR REPLACE FUNCTION enforce_appointment_procedure_same_tenant()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT "tenantId" FROM "appointments" WHERE "id" = NEW."appointmentId")
     IS DISTINCT FROM (SELECT "tenantId" FROM "procedures" WHERE "id" = NEW."procedureId") THEN
    RAISE EXCEPTION 'appointment_procedures: tenant mismatch';
  END IF;
  NEW."tenantId" := (SELECT "tenantId" FROM "appointments" WHERE "id" = NEW."appointmentId");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER appointment_procedures_same_tenant
BEFORE INSERT OR UPDATE ON "appointment_procedures"
FOR EACH ROW EXECUTE FUNCTION enforce_appointment_procedure_same_tenant();
