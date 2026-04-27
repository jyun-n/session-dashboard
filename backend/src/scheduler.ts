import cron from "node-cron";
import { collectData } from "./services/collect.service.js";
import { logger } from "./utils/logger.js";

function getTodayYyyymmdd(): string {
  const now = new Date();
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, "0");
  const d = String(kst.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

async function runCollect(label: string, yyyymmdd: string) {
  logger.info(`[스케줄러] ${label} 수집 시작: ${yyyymmdd}`);
  try {
    const result = await collectData(yyyymmdd, yyyymmdd);
    logger.info(`[스케줄러] ${label} 수집 완료`, result);
  } catch (err) {
    logger.error(`[스케줄러] ${label} 수집 실패`, {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

export function startScheduler() {
  cron.schedule("0 6 * * *", () => {
    runCollect("06시", getTodayYyyymmdd());
  }, { timezone: "Asia/Seoul" });

  cron.schedule("0 18 * * *", () => {
    runCollect("18시", getTodayYyyymmdd());
  }, { timezone: "Asia/Seoul" });

  logger.info("[스케줄러] 시작 완료 (06:00 / 18:00 KST)");
}