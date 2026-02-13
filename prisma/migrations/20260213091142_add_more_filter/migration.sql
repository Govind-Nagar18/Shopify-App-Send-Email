-- AlterTable
ALTER TABLE "EmailSchedule" ADD COLUMN "customerTags" TEXT;
ALTER TABLE "EmailSchedule" ADD COLUMN "minItems" INTEGER;
ALTER TABLE "EmailSchedule" ADD COLUMN "minOrderValue" INTEGER;
ALTER TABLE "EmailSchedule" ADD COLUMN "orderTags" TEXT;
