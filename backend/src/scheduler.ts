import { collectData } from "./services/collect.service.js";
import { logger } from "./utils/logger.js";
import { prisma } from "./config/db.js";

type Slot = {
  label: string;
  kstHour: number;
  kstMin: number;
  // 00:05 슬롯은 "전날 마감본"이라 어제 날짜를 수집한다. 그 외 슬롯은 오늘 데이터.
  useYesterday: boolean;
};

// 수집 스케줄(KST). 시간 변경 시 이 배열만 수정하면 catchup·라이브 트리거 양쪽에 일괄 반영됨.
const SLOTS: Slot[] = [
  { label: "전날마감", kstHour: 0,  kstMin: 5,  useYesterday: true  },
  { label: "08:40",    kstHour: 8,  kstMin: 40, useYesterday: false },
  { label: "09:00",    kstHour: 9,  kstMin: 0,  useYesterday: false },
  { label: "10:30",    kstHour: 10, kstMin: 30, useYesterday: false },
  { label: "11:30",    kstHour: 11, kstMin: 30, useYesterday: false },
  { label: "12:30",    kstHour: 12, kstMin: 30, useYesterday: false },
  { label: "14:00",    kstHour: 14, kstMin: 0,  useYesterday: false },
  { label: "15:30",    kstHour: 15, kstMin: 30, useYesterday: false },
  { label: "17:30",    kstHour: 17, kstMin: 30, useYesterday: false },
];

const SCHEDULE_SUMMARY = SLOTS
  .map((s) => `${String(s.kstHour).padStart(2, "0")}:${String(s.kstMin).padStart(2, "0")}`)
  .join(" / ");

function getKstTimeInfo(): { hour: number; minute: number; yyyymmdd: string; yesterddYyyymmdd: string } {
  const now = new Date();
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const hour   = kst.getHours();
  const minute = kst.getMinutes();

  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, "0");
  const d = String(kst.getDate()).padStart(2, "0");
  const yyyymmdd = `${y}${m}${d}`;

  const yesterday = new Date(kst);
  yesterday.setDate(yesterday.getDate() - 1);
  const yy = yesterday.getFullYear();
  const ym = String(yesterday.getMonth() + 1).padStart(2, "0");
  const yd = String(yesterday.getDate()).padStart(2, "0");
  const yesterddYyyymmdd = `${yy}${ym}${yd}`;

  return { hour, minute, yyyymmdd, yesterddYyyymmdd };
}

// 서버 시작 시 1회 실행. DB의 마지막 수집 시각 이후 지나간 슬롯이 있으면 즉시 보정 수집한다.
// 절전, 재시작, 배포로 놓친 SLOTS의 슬롯을 자동으로 메운다.
async function catchUpMissedSlots(): Promise<void> {
  const { hour: nowH, minute: nowM, yyyymmdd, yesterddYyyymmdd } = getKstTimeInfo();

  const lastRow = await prisma.rawPatientStats.findFirst({
    orderBy: { collectedAt: "desc" },
    select: { collectedAt: true },
  });
  const lastAt = lastRow?.collectedAt ?? new Date(0);

  for (const s of SLOTS) {
    // 슬롯 시각이 아직 안 지났으면 건너뜀
    const passed = nowH > s.kstHour || (nowH === s.kstHour && nowM >= s.kstMin);
    if (!passed) continue;

    // 슬롯 발동 시각은 "오늘 KST kstHour:kstMin" — dateStr(수집 대상 날짜)과 별개.
    // 전날마감은 오늘 0:05 KST에 발동되어 어제 데이터를 수집하기 때문.
    const slotAt = new Date(
      `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}` +
      `T${String(s.kstHour).padStart(2, "0")}:${String(s.kstMin).padStart(2, "0")}:00+09:00`,
    );

    // 마지막 수집이 슬롯 시각 이후면 이미 수집됨 → 건너뜀
    if (lastAt >= slotAt) continue;

    const dateStr = s.useYesterday ? yesterddYyyymmdd : yyyymmdd;
    logger.info(`[스케줄러:catchup] ${s.label} 놓침 감지 → 보정 수집: ${dateStr}`);
    await runCollect(`catchup-${s.label}`, dateStr);
  }
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
  // 이미 실행된 시간 추적 (중복 실행 방지)
  const executed = new Set<string>();

  setInterval(() => {
    const { hour, minute, yyyymmdd, yesterddYyyymmdd } = getKstTimeInfo();
    const key = `${yyyymmdd}-${hour}-${minute}`;

    if (executed.has(key)) return;

    const matched = SLOTS.find((s) => s.kstHour === hour && s.kstMin === minute);
    if (matched) {
      executed.add(key);
      const dateStr = matched.useYesterday ? yesterddYyyymmdd : yyyymmdd;
      runCollect(matched.label, dateStr);
    }

    // executed 크기 제한 (메모리 관리)
    if (executed.size > 100) {
      const first = executed.values().next().value;
      if (first !== undefined) executed.delete(first);
    }
  }, 10_000); // 10초마다 체크

  logger.info(`[스케줄러] 시작 완료 (${SCHEDULE_SUMMARY} KST)`);

  // 서버 시작 시 놓친 슬롯 보정 (절전·재시작·배포로 놓친 슬롯을 메움)
  catchUpMissedSlots().catch((err) => {
    logger.error("[스케줄러:catchup] 보정 실패", {
      message: err instanceof Error ? err.message : String(err),
    });
  });
}
