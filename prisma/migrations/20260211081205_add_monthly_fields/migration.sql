-- AlterTable
ALTER TABLE "EmailSchedule" ADD COLUMN "dayPattern" TEXT;
ALTER TABLE "EmailSchedule" ADD COLUMN "monthlyType" TEXT;
ALTER TABLE "EmailSchedule" ADD COLUMN "specificDate" INTEGER;
ALTER TABLE "EmailSchedule" ADD COLUMN "weekPattern" TEXT;
