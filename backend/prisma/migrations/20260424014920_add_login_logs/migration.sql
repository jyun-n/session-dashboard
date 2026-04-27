-- CreateTable
CREATE TABLE "login_logs" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "loginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "login_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "login_logs_accountId_loginAt_idx" ON "login_logs"("accountId", "loginAt" DESC);

-- AddForeignKey
ALTER TABLE "login_logs" ADD CONSTRAINT "login_logs_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
