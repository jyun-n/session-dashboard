-- CreateTable
CREATE TABLE "raw_patient_stats" (
    "id" SERIAL NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "doctorId" TEXT NOT NULL,
    "doctorName" TEXT NOT NULL,
    "deptCd" TEXT NOT NULL,
    "deptName" TEXT NOT NULL,
    "fsexamFlag" TEXT NOT NULL,
    "avgOrdTime" TEXT,
    "avgWaitTime" TEXT,
    "avgOrdMin" DECIMAL(8,2),
    "avgWaitMin" DECIMAL(8,2),
    "patCnt" INTEGER NOT NULL DEFAULT 0,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_patient_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_sessions" (
    "id" SERIAL NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "statDate" DATE NOT NULL,
    "deptCd" TEXT NOT NULL,
    "deptName" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "doctorName" TEXT NOT NULL,
    "planSession" INTEGER NOT NULL DEFAULT 0,
    "realSession" INTEGER NOT NULL DEFAULT 0,
    "fstExamCap" INTEGER NOT NULL DEFAULT 0,
    "reExamCap" INTEGER NOT NULL DEFAULT 0,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_stats_by_doctor" (
    "id" SERIAL NOT NULL,
    "statDate" DATE NOT NULL,
    "deptCd" TEXT NOT NULL,
    "deptName" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "doctorName" TEXT NOT NULL,
    "planSession" INTEGER,
    "realSession" INTEGER,
    "sessionUtilization" DECIMAL(5,2),
    "fstExamCap" INTEGER,
    "reExamCap" INTEGER,
    "avgOrdTime" TEXT,
    "avgWaitTime" TEXT,
    "avgOrdMin" DECIMAL(8,2),
    "avgWaitMin" DECIMAL(8,2),
    "firstVisitCount" INTEGER,
    "revisitCount" INTEGER,
    "totalPatients" INTEGER,
    "bookingRate" DECIMAL(5,2),
    "aggregatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_stats_by_doctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_stats_by_dept" (
    "id" SERIAL NOT NULL,
    "statDate" DATE NOT NULL,
    "deptCd" TEXT NOT NULL,
    "deptName" TEXT NOT NULL,
    "planSession" INTEGER,
    "realSession" INTEGER,
    "sessionUtilization" DECIMAL(5,2),
    "fstExamCap" INTEGER,
    "reExamCap" INTEGER,
    "avgOrdTime" TEXT,
    "avgWaitTime" TEXT,
    "firstVisitCount" INTEGER,
    "revisitCount" INTEGER,
    "totalPatients" INTEGER,
    "bookingRate" DECIMAL(5,2),
    "doctorCount" INTEGER,
    "aggregatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_stats_by_dept_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "raw_patient_stats_fromDate_toDate_deptCd_idx" ON "raw_patient_stats"("fromDate", "toDate", "deptCd");

-- CreateIndex
CREATE UNIQUE INDEX "raw_patient_stats_fromDate_toDate_doctorId_deptCd_fsexamFla_key" ON "raw_patient_stats"("fromDate", "toDate", "doctorId", "deptCd", "fsexamFlag");

-- CreateIndex
CREATE INDEX "raw_sessions_statDate_deptCd_idx" ON "raw_sessions"("statDate", "deptCd");

-- CreateIndex
CREATE UNIQUE INDEX "raw_sessions_fromDate_toDate_statDate_doctorId_deptCd_key" ON "raw_sessions"("fromDate", "toDate", "statDate", "doctorId", "deptCd");

-- CreateIndex
CREATE INDEX "daily_stats_by_doctor_statDate_deptCd_idx" ON "daily_stats_by_doctor"("statDate", "deptCd");

-- CreateIndex
CREATE UNIQUE INDEX "daily_stats_by_doctor_statDate_doctorId_deptCd_key" ON "daily_stats_by_doctor"("statDate", "doctorId", "deptCd");

-- CreateIndex
CREATE INDEX "daily_stats_by_dept_statDate_deptCd_idx" ON "daily_stats_by_dept"("statDate", "deptCd");

-- CreateIndex
CREATE UNIQUE INDEX "daily_stats_by_dept_statDate_deptCd_key" ON "daily_stats_by_dept"("statDate", "deptCd");
