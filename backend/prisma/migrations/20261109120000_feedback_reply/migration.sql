-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FEEDBACK_REPLIED';

-- AlterTable
ALTER TABLE "feedback_reports"
  ADD COLUMN "replyText" TEXT,
  ADD COLUMN "repliedAt" TIMESTAMP(3),
  ADD COLUMN "repliedById" TEXT,
  ADD COLUMN "repliedByName" TEXT;
