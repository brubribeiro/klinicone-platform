-- CreateEnum
CREATE TYPE "PaymentMethodKind" AS ENUM ('CASH', 'PIX', 'DEBIT', 'CREDIT', 'OTHER');

-- AlterTable
ALTER TABLE "payment_methods" ADD COLUMN "kind" "PaymentMethodKind" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "payment_methods" ADD COLUMN "settlementDays" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "financial_entries" ADD COLUMN "installments" INTEGER;
ALTER TABLE "financial_entries" ADD COLUMN "cardBrand" TEXT;
ALTER TABLE "financial_entries" ADD COLUMN "authorizationCode" TEXT;

-- Backfill tipos e prazos das formas padrão (por nome, em qualquer tenant)
UPDATE "payment_methods" SET "kind" = 'CASH', "settlementDays" = 0 WHERE "name" ILIKE 'Dinheiro%';
UPDATE "payment_methods" SET "kind" = 'PIX', "settlementDays" = 0 WHERE "name" ILIKE 'PIX%';
UPDATE "payment_methods" SET "kind" = 'DEBIT', "settlementDays" = 1 WHERE "name" ILIKE 'Débito%' OR "name" ILIKE 'Debito%';
UPDATE "payment_methods" SET "kind" = 'CREDIT', "settlementDays" = 30 WHERE "name" ILIKE 'Crédito%' OR "name" ILIKE 'Credito%';
