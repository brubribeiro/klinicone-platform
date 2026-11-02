-- CreateTable
CREATE TABLE "api_route_metrics" (
    "id" TEXT NOT NULL,
    "hour" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "tenantKey" TEXT NOT NULL DEFAULT '',
    "count" INTEGER NOT NULL DEFAULT 0,
    "clientErrors" INTEGER NOT NULL DEFAULT 0,
    "serverErrors" INTEGER NOT NULL DEFAULT 0,
    "totalMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxMs" INTEGER NOT NULL DEFAULT 0,
    "le50" INTEGER NOT NULL DEFAULT 0,
    "le100" INTEGER NOT NULL DEFAULT 0,
    "le250" INTEGER NOT NULL DEFAULT 0,
    "le500" INTEGER NOT NULL DEFAULT 0,
    "le1000" INTEGER NOT NULL DEFAULT 0,
    "le2500" INTEGER NOT NULL DEFAULT 0,
    "le5000" INTEGER NOT NULL DEFAULT 0,
    "gt5000" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "api_route_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_request_errors" (
    "id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "errorName" TEXT,
    "message" TEXT,
    "targetTenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_request_errors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "api_route_metrics_hour_idx" ON "api_route_metrics"("hour");

-- CreateIndex
CREATE UNIQUE INDEX "api_route_metrics_hour_method_route_tenantKey_key" ON "api_route_metrics"("hour", "method", "route", "tenantKey");

-- CreateIndex
CREATE INDEX "api_request_errors_createdAt_idx" ON "api_request_errors"("createdAt");

-- AddForeignKey
ALTER TABLE "api_request_errors" ADD CONSTRAINT "api_request_errors_targetTenantId_fkey" FOREIGN KEY ("targetTenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mesmo padrão das demais tabelas: bloqueia acesso pela anon key do Supabase
ALTER TABLE "api_route_metrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "api_request_errors" ENABLE ROW LEVEL SECURITY;
