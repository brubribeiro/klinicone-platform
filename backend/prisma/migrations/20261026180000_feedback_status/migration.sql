-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('OPEN', 'TRIAGED', 'CLOSED');

-- AlterTable
ALTER TABLE "feedback_reports" ADD COLUMN "status" "FeedbackStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN "statusChangedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "feedback_reports_status_idx" ON "feedback_reports"("status");
