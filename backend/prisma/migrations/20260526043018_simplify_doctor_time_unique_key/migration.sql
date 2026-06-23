-- DropIndex
DROP INDEX "public"."raw_doctor_times_statDate_doctorId_deptCd_fsexamFlag_key";

-- AlterTable
ALTER TABLE "raw_doctor_times" DROP COLUMN "fsexamFlag";

-- CreateIndex
CREATE UNIQUE INDEX "raw_doctor_times_statDate_doctorId_deptCd_key" ON "raw_doctor_times"("statDate", "doctorId", "deptCd");
