-- Perguntas cadastráveis da anamnese (geral e de pele) por clínica e link público para a paciente preencher.
-- As perguntas iniciais são criadas pela API na primeira leitura de cada clínica (anamnesis.constants.ts).
-- CreateEnum
CREATE TYPE "AnamnesisKind" AS ENUM ('GENERAL', 'SKIN');

-- CreateEnum
CREATE TYPE "AnamnesisQuestionType" AS ENUM ('TEXT', 'BOOLEAN', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'NUMBER');

-- CreateTable
CREATE TABLE "anamnesis_questions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT current_setting('app.tenant_id'::text, true),
    "kind" "AnamnesisKind" NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "AnamnesisQuestionType" NOT NULL,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "section" TEXT,
    "placeholder" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anamnesis_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anamnesis_links" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT current_setting('app.tenant_id'::text, true),
    "patientId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anamnesis_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "anamnesis_questions_tenantId_idx" ON "anamnesis_questions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "anamnesis_questions_tenantId_kind_key_key" ON "anamnesis_questions"("tenantId", "kind", "key");

-- CreateIndex
CREATE UNIQUE INDEX "anamnesis_links_tokenHash_key" ON "anamnesis_links"("tokenHash");

-- CreateIndex
CREATE INDEX "anamnesis_links_patientId_idx" ON "anamnesis_links"("patientId");

-- CreateIndex
CREATE INDEX "anamnesis_links_tenantId_idx" ON "anamnesis_links"("tenantId");

-- AddForeignKey
ALTER TABLE "anamnesis_questions" ADD CONSTRAINT "anamnesis_questions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamnesis_links" ADD CONSTRAINT "anamnesis_links_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamnesis_links" ADD CONSTRAINT "anamnesis_links_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Bloqueia acesso via anon/authenticated key do Supabase (ver 20260623120000_enable_rls_all_tables)
ALTER TABLE "anamnesis_questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "anamnesis_links" ENABLE ROW LEVEL SECURITY;

-- Paciente precisa ser da mesma clínica do link (ver 20261025120000_multi_tenant)
CREATE TRIGGER "anamnesis_links_patientId_same_tenant" BEFORE INSERT OR UPDATE OF "patientId", "tenantId" ON "anamnesis_links"
  FOR EACH ROW EXECUTE FUNCTION enforce_same_tenant('patientId', 'patients');
