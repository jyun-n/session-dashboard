-- AlterTable
ALTER TABLE "raw_sessions"
  ADD COLUMN "morningStartTime"   TEXT,
  ADD COLUMN "morningEndTime"     TEXT,
  ADD COLUMN "afternoonStartTime" TEXT,
  ADD COLUMN "afternoonEndTime"   TEXT;
