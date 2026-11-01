-- CreateEnum
CREATE TYPE "AnnouncementKind" AS ENUM ('FEATURE', 'FIX');

-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENT');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PLATFORM_ANNOUNCEMENT';

-- CreateTable
CREATE TABLE "platform_announcements" (
    "id" TEXT NOT NULL,
    "version" TEXT,
    "kind" "AnnouncementKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "recipientCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_announcements_status_scheduledAt_idx" ON "platform_announcements"("status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "platform_announcements_version_kind_key" ON "platform_announcements"("version", "kind");
