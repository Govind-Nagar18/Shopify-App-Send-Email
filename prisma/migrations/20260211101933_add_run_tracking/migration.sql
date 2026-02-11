-- AlterTable
ALTER TABLE "EmailSchedule" ADD COLUMN "lastRunAt" DATETIME;
ALTER TABLE "EmailSchedule" ADD COLUMN "nextRunAt" DATETIME;
