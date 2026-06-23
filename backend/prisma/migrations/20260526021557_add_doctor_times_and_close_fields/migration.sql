-- AlterTable
ALTER TABLE "daily_stats_by_doctor" ADD COLUMN     "closeReason" TEXT,
ADD COLUMN     "closeRequestTime" TEXT,
ADD COLUMN     "treatmentEndTime" TEXT,
ADD COLUMN     "treatmentStartTime" TEXT;

-- AlterTable
ALTER TABLE "raw_sessions" ADD COLUMN     "closeReason" TEXT,
ADD COLUMN     "closeRequestTime" TEXT;

-- CreateTable
CREATE TABLE "raw_doctor_times" (
    "id" SERIAL NOT NULL,
    "statDate" DATE NOT NULL,
    "doctorId" TEXT NOT NULL,
    "doctorName" TEXT NOT NULL,
    "deptCd" TEXT NOT NULL,
    "deptName" TEXT NOT NULL,
    "fsexamFlag" TEXT NOT NULL,
    "treatmentStartTime" TEXT,
    "treatmentEndTime" TEXT,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_doctor_times_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "raw_doctor_times_statDate_deptCd_idx" ON "raw_doctor_times"("statDate", "deptCd");

-- CreateIndex
CREATE UNIQUE INDEX "raw_doctor_times_statDate_doctorId_deptCd_fsexamFlag_key" ON "raw_doctor_times"("statDate", "doctorId", "deptCd", "fsexamFlag");
