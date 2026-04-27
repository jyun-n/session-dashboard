/*
  Warnings:

  - You are about to drop the column `fromDate` on the `raw_patient_stats` table. All the data in the column will be lost.
  - You are about to drop the column `toDate` on the `raw_patient_stats` table. All the data in the column will be lost.
  - You are about to drop the column `fromDate` on the `raw_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `toDate` on the `raw_sessions` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[statDate,doctorId,deptCd,fsexamFlag]` on the table `raw_patient_stats` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[statDate,doctorId,deptCd]` on the table `raw_sessions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `statDate` to the `raw_patient_stats` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "raw_patient_stats_fromDate_toDate_deptCd_idx";

-- DropIndex
DROP INDEX "raw_patient_stats_fromDate_toDate_doctorId_deptCd_fsexamFla_key";

-- DropIndex
DROP INDEX "raw_sessions_fromDate_toDate_statDate_doctorId_deptCd_key";

-- AlterTable
ALTER TABLE "raw_patient_stats" DROP COLUMN "fromDate",
DROP COLUMN "toDate",
ADD COLUMN     "statDate" DATE NOT NULL;

-- AlterTable
ALTER TABLE "raw_sessions" DROP COLUMN "fromDate",
DROP COLUMN "toDate";

-- CreateIndex
CREATE INDEX "raw_patient_stats_statDate_deptCd_idx" ON "raw_patient_stats"("statDate", "deptCd");

-- CreateIndex
CREATE UNIQUE INDEX "raw_patient_stats_statDate_doctorId_deptCd_fsexamFlag_key" ON "raw_patient_stats"("statDate", "doctorId", "deptCd", "fsexamFlag");

-- CreateIndex
CREATE UNIQUE INDEX "raw_sessions_statDate_doctorId_deptCd_key" ON "raw_sessions"("statDate", "doctorId", "deptCd");
