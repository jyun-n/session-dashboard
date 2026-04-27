/*
  Warnings:

  - You are about to drop the column `fstExamCap` on the `daily_stats_by_dept` table. All the data in the column will be lost.
  - You are about to drop the column `reExamCap` on the `daily_stats_by_dept` table. All the data in the column will be lost.
  - You are about to drop the column `fstExamCap` on the `daily_stats_by_doctor` table. All the data in the column will be lost.
  - You are about to drop the column `reExamCap` on the `daily_stats_by_doctor` table. All the data in the column will be lost.
  - You are about to drop the column `fstExamCap` on the `raw_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `reExamCap` on the `raw_sessions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "daily_stats_by_dept" DROP COLUMN "fstExamCap",
DROP COLUMN "reExamCap",
ADD COLUMN     "totalExamCap" INTEGER;

-- AlterTable
ALTER TABLE "daily_stats_by_doctor" DROP COLUMN "fstExamCap",
DROP COLUMN "reExamCap",
ADD COLUMN     "totalExamCap" INTEGER;

-- AlterTable
ALTER TABLE "raw_sessions" DROP COLUMN "fstExamCap",
DROP COLUMN "reExamCap",
ADD COLUMN     "totalExamCap" INTEGER NOT NULL DEFAULT 0;
