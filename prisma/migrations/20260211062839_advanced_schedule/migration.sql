/*
  Warnings:

  - Added the required column `frequency` to the `EmailSchedule` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EmailSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "frequency" TEXT NOT NULL,
    "repeatEvery" INTEGER NOT NULL DEFAULT 1,
    "runDays" TEXT,
    "scheduleTime" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_EmailSchedule" ("createdAt", "email", "id", "isEnabled", "scheduleTime", "shop") SELECT "createdAt", "email", "id", "isEnabled", "scheduleTime", "shop" FROM "EmailSchedule";
DROP TABLE "EmailSchedule";
ALTER TABLE "new_EmailSchedule" RENAME TO "EmailSchedule";
CREATE UNIQUE INDEX "EmailSchedule_shop_key" ON "EmailSchedule"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
