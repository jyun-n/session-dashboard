import { prisma } from "../config/db.js";
import {
  fetchPatientStats,
  fetchSessions,
  fetchDoctorTimes,
  fetchCloseInfo,
} from "./hospital.api.service.js";
import { aggregateData } from "./aggregate.service.js";
import { logger } from "../utils/logger.js";

// 동시 실행 풀. 외부 API에 무리 가지 않게 N개씩만 병렬로.
async function runWithConcurrency<T>(
  items:       T[],
  concurrency: number,
  worker:      (item: T) => Promise<void>,
): Promise<void> {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        await worker(items[idx]);
      }
    }),
  );
}

// yyyymmdd → UTC 자정 Date. 서버 TZ와 무관하게 동일한 캘린더 날짜로
// Postgres DATE 컬럼(@db.Date)에 저장하기 위해 Date.UTC 사용.
function parseDate(yyyymmdd: string): Date {
  const y = parseInt(yyyymmdd.slice(0, 4), 10);
  const m = parseInt(yyyymmdd.slice(4, 6), 10) - 1;
  const d = parseInt(yyyymmdd.slice(6, 8), 10);
  return new Date(Date.UTC(y, m, d));
}

function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function getDateRange(fromdd: string, todd: string): string[] {
  const dates: string[] = [];
  const current = parseDate(fromdd);
  const end     = parseDate(todd);

  while (current <= end) {
    dates.push(formatDate(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

export async function collectData(fromdd: string, todd: string) {
  logger.info(`수집 시작: ${fromdd} ~ ${todd}`);

  const dateRange = getDateRange(fromdd, todd);
  let totalPatientRows = 0;

  // ── 1. DRPMA00100 날짜별 수집 ──────────────────
  for (const yyyymmdd of dateRange) {
    const statDate    = parseDate(yyyymmdd);
    const patientRows = await fetchPatientStats(yyyymmdd);

    if (patientRows.length === 0) continue;

    // 교수명이 빈 경우 제외 (퇴사 등)
    const validPatientRows = patientRows.filter(r => r.doctorName.trim() !== "");
    if (validPatientRows.length === 0) continue;

    for (const row of validPatientRows) {
      await prisma.rawPatientStats.upsert({
        where: {
          statDate_doctorId_deptCd_fsexamFlag: {
            statDate,
            doctorId:   row.doctorId,
            deptCd:     row.deptCd,
            fsexamFlag: row.fsexamFlag,
          },
        },
        update: {
          doctorName:  row.doctorName,
          deptName:    row.deptName,
          avgOrdTime:  row.avgOrdTime,
          avgWaitTime: row.avgWaitTime,
          avgOrdMin:   row.avgOrdMin,
          avgWaitMin:  row.avgWaitMin,
          patCnt:      row.patCnt,
          collectedAt: new Date(),
        },
        create: {
          statDate,
          doctorId:    row.doctorId,
          doctorName:  row.doctorName,
          deptCd:      row.deptCd,
          deptName:    row.deptName,
          fsexamFlag:  row.fsexamFlag,
          avgOrdTime:  row.avgOrdTime,
          avgWaitTime: row.avgWaitTime,
          avgOrdMin:   row.avgOrdMin,
          avgWaitMin:  row.avgWaitMin,
          patCnt:      row.patCnt,
        },
      });
    }

    totalPatientRows += validPatientRows.length;
    logger.info(`DRPMA00100 ${yyyymmdd}: ${validPatientRows.length}건`);
  }

  logger.info(`DRPMA00100 저장 완료: 총 ${totalPatientRows}건`);

  // ── 2. DRPMA00200 기간 전체 수집 ──────────────────
  const sessionRows = await fetchSessions(fromdd, todd);
  logger.info(`DRPMA00200 수신: ${sessionRows.length}건`);

  // 마감 2개 필드는 별도 호출(fetchCloseInfo)로 받아 RawSession에 머지.
  // 보조 호출 실패 시 마감 필드만 NULL로 진행 (메인 수집은 영향 없음).
  let closeMap = new Map<string, { closeReason: string | null; closeRequestTime: string | null }>();
  try {
    const closeRows = await fetchCloseInfo(fromdd, todd);
    closeMap = new Map(
      closeRows.map((c) => [
        `${c.statDate}|${c.doctorId}|${c.deptCd}`,
        { closeReason: c.closeReason, closeRequestTime: c.closeRequestTime },
      ]),
    );
    logger.info(`DRPMA00200(마감) 수신: ${closeRows.length}건`);
  } catch (err) {
    logger.warn(`DRPMA00200(마감) 실패 — 마감 필드 NULL로 진행`, {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  for (const row of sessionRows) {
    // 교수명이 빈 경우 제외 (퇴사 등)
    if (row.doctorName.trim() === "") continue;

    const statDate = parseDate(row.statDate);

    // 같은 (날짜, 의사, 과) 키로 보조 호출에서 가져온 마감 머지.
    // 운영 응답에는 마감 필드 태그가 없어 row.closeReason/closeRequestTime은 항상 null이므로 무시.
    const close = closeMap.get(`${row.statDate}|${row.doctorId}|${row.deptCd}`);

    await prisma.rawSession.upsert({
      where: {
        statDate_doctorId_deptCd: {
          statDate,
          doctorId: row.doctorId,
          deptCd:   row.deptCd,
        },
      },
      update: {
        deptName:         row.deptName,
        doctorName:       row.doctorName,
        planSession:      row.planSession,
        realSession:      row.realSession,
        totalExamCap:     row.totalExamCap,
        closeReason:      close?.closeReason      ?? null,
        closeRequestTime: close?.closeRequestTime ?? null,
        collectedAt:      new Date(),
      },
      create: {
        statDate,
        deptCd:           row.deptCd,
        deptName:         row.deptName,
        doctorId:         row.doctorId,
        doctorName:       row.doctorName,
        planSession:      row.planSession,
        realSession:      row.realSession,
        totalExamCap:     row.totalExamCap,
        closeReason:      close?.closeReason      ?? null,
        closeRequestTime: close?.closeRequestTime ?? null,
      },
    });
  }

  logger.info(`DRPMA00200 저장 완료`);

  // ── 3. DRPMA00100 (srchflag=T) — 교수별 진료 시작/종료시간 ──────────────────
  // 호출 단위가 (날짜, 진료과, 진료의) 필수이므로 방금 저장한 RawSession을 순회 대상으로 사용.
  // 콜 수가 N(교수)×D(일)로 늘어나므로 동시성 제한 + 건별 try/catch로 격리.
  const fromDate = parseDate(fromdd);
  const toDate   = parseDate(todd);

  const targets = await prisma.rawSession.findMany({
    where: {
      statDate:   { gte: fromDate, lte: toDate },
      doctorName: { not: "" },
    },
    select: { statDate: true, deptCd: true, doctorId: true },
  });

  let timeSuccess = 0;
  let timeFail    = 0;

  await runWithConcurrency(targets, 5, async (t) => {
    const yyyymmdd = formatDate(t.statDate);
    try {
      // EMR 응답은 (date, dept) 단위로 같은 과의 여러 의사 row가 섞여 옴. 본인 의사 row만 추림.
      const rows   = await fetchDoctorTimes(yyyymmdd, t.deptCd, t.doctorId);
      const myRows = rows.filter((r) => r.doctorId === t.doctorId);

      if (myRows.length === 0) {
        timeSuccess++;
        return;     // 그날 그 의사에 진료 이벤트 없음 — RawDoctorTime row 안 만듦
      }

      // 환자별 진료 이벤트 다수 → 의사 단위 1행으로 MIN/MAX 머지.
      // 14자리 datetime은 lex 비교가 시간 순서와 일치하므로 문자열 그대로 비교 가능.
      const starts = myRows.map((r) => r.treatmentStartTime).filter((s): s is string => !!s);
      const ends   = myRows.map((r) => r.treatmentEndTime).filter((s): s is string => !!s);

      const treatmentStartTime = starts.length > 0 ? starts.reduce((a, b) => (a < b ? a : b)) : null;
      const treatmentEndTime   = ends.length   > 0 ? ends.reduce((a, b) => (a > b ? a : b))   : null;

      const nameRow    = myRows.find((r) => r.doctorName.trim() !== "") ?? myRows[0];
      const doctorName = nameRow.doctorName;
      const deptName   = nameRow.deptName;

      await prisma.rawDoctorTime.upsert({
        where: {
          statDate_doctorId_deptCd: {
            statDate: t.statDate,
            doctorId: t.doctorId,
            deptCd:   t.deptCd,
          },
        },
        update: {
          doctorName,
          deptName,
          treatmentStartTime,
          treatmentEndTime,
          collectedAt: new Date(),
        },
        create: {
          statDate: t.statDate,
          doctorId: t.doctorId,
          deptCd:   t.deptCd,
          doctorName,
          deptName,
          treatmentStartTime,
          treatmentEndTime,
        },
      });

      timeSuccess++;
    } catch (err) {
      timeFail++;
      logger.warn(`DRPMA00100(T) 실패: ${yyyymmdd} ${t.deptCd}/${t.doctorId}`, {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  logger.info(`DRPMA00100(T) 저장 완료: 대상 ${targets.length} / 성공 ${timeSuccess} / 실패 ${timeFail}`);

  // ── 4. 집계 실행 ──────────────────
  await aggregateData(fromDate, toDate);
  logger.info(`집계 완료`);

  return {
    patientRows:       totalPatientRows,
    sessionRows:       sessionRows.length,
    doctorTimeTargets: targets.length,
    doctorTimeSuccess: timeSuccess,
    doctorTimeFail:    timeFail,
  };
}