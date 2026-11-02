-- Tipos de medida corporal cadastráveis no /admin; cintura, abdômen e quadril viram tipos opcionais.
-- CreateTable
CREATE TABLE "measurement_types" (
    "id" TEXT NOT NULL,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "measurement_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_measurement_values" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT current_setting('app.tenant_id'::text, true),
    "measurementId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "value" DECIMAL(7,2) NOT NULL,

    CONSTRAINT "patient_measurement_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "measurement_types_key_key" ON "measurement_types"("key");

-- CreateIndex
CREATE INDEX "measurement_types_active_sortOrder_idx" ON "measurement_types"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "patient_measurement_values_typeId_idx" ON "patient_measurement_values"("typeId");

-- CreateIndex
CREATE INDEX "patient_measurement_values_tenantId_idx" ON "patient_measurement_values"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "patient_measurement_values_measurementId_typeId_key" ON "patient_measurement_values"("measurementId", "typeId");

-- AddForeignKey
ALTER TABLE "patient_measurement_values" ADD CONSTRAINT "patient_measurement_values_measurementId_fkey" FOREIGN KEY ("measurementId") REFERENCES "patient_measurements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_measurement_values" ADD CONSTRAINT "patient_measurement_values_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "measurement_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_measurement_values" ADD CONSTRAINT "patient_measurement_values_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Bloqueia acesso via anon/authenticated key do Supabase (ver 20260623120000_enable_rls_all_tables)
ALTER TABLE "measurement_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_measurement_values" ENABLE ROW LEVEL SECURITY;

-- Medição precisa ser da mesma clínica (ver 20261025120000_multi_tenant)
CREATE TRIGGER "patient_measurement_values_measurementId_same_tenant" BEFORE INSERT OR UPDATE OF "measurementId", "tenantId" ON "patient_measurement_values"
  FOR EACH ROW EXECUTE FUNCTION enforce_same_tenant('measurementId', 'patient_measurements');

-- Peso e altura básicos (colunas próprias); os demais começam inativos
INSERT INTO "measurement_types" ("id", "key", "name", "unit", "sortOrder", "active", "updatedAt") VALUES
  (gen_random_uuid()::text, 'weightKg', 'Peso', 'kg', 0, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'heightCm', 'Altura', 'cm', 1, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'Cintura', 'cm', 2, false, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'Abdômen', 'cm', 3, false, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'Quadril', 'cm', 4, false, CURRENT_TIMESTAMP);

-- Preserva os valores já registrados nas colunas antigas
INSERT INTO "patient_measurement_values" ("id", "tenantId", "measurementId", "typeId", "value")
SELECT gen_random_uuid()::text, m."tenantId", m."id", t."id", v.value
FROM "patient_measurements" m
CROSS JOIN LATERAL (VALUES ('Cintura', m."waistCm"), ('Abdômen', m."abdomenCm"), ('Quadril', m."hipCm")) AS v(name, value)
JOIN "measurement_types" t ON t."name" = v.name AND t."key" IS NULL
WHERE v.value IS NOT NULL;

-- AlterTable
ALTER TABLE "patient_measurements" DROP COLUMN "abdomenCm",
DROP COLUMN "hipCm",
DROP COLUMN "waistCm";
