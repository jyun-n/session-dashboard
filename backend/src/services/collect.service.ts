import { prisma } from "../config/db.js";
import {
  fetchPatientStats,
  fetchSessions,
  fetchCloseInfo,
  fetchSessionTimes,
} from "./hospital.api.service.js";
import { aggregateData } from "./aggregate.service.js";
import { logger } from "../utils/logger.js";

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

  // 보조 호출 2종을 동시에 받아 RawSession에 머지:
  //  - fetchCloseInfo:    마감 사유/시간 (운영 URL — 운영 EMR에 적용 완료)
  //  - fetchSessionTimes: 오전/오후 진료 시작·종료시간 4필드 (교육 URL — 운영 EMR 적용 대기 중)
  // 둘 다 (statDate, doctorId, deptCd)로 매핑.
  // 보조 호출 실패 시 해당 필드만 NULL로 진행 (메인 수집은 영향 없음).
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

  let timeMap = new Map<string, {
    morningStartTime:   string | null;
    morningEndTime:     string | null;
    afternoonStartTime: string | null;
    afternoonEndTime:   string | null;
  }>();
  try {
    const timeRows = await fetchSessionTimes(fromdd, todd);
    timeMap = new Map(
      timeRows.map((t) => [
        `${t.statDate}|${t.doctorId}|${t.deptCd}`,
        {
          morningStartTime:   t.morningStartTime,
          morningEndTime:     t.morningEndTime,
          afternoonStartTime: t.afternoonStartTime,
          afternoonEndTime:   t.afternoonEndTime,
        },
      ]),
    );
    logger.info(`DRPMA00200(진료시간) 수신: ${timeRows.length}건`);
  } catch (err) {
    logger.warn(`DRPMA00200(진료시간) 실패 — 진료시간 필드 NULL로 진행`, {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  for (const row of sessionRows) {
    // 교수명이 빈 경우 제외 (퇴사 등)
    if (row.doctorName.trim() === "") continue;

    const statDate = parseDate(row.statDate);
    const key      = `${row.statDate}|${row.doctorId}|${row.deptCd}`;
    const close    = closeMap.get(key);
    const time     = timeMap.get(key);

    await prisma.rawSession.upsert({
      where: {
        statDate_doctorId_deptCd: {
          statDate,
          doctorId: row.doctorId,
          deptCd:   row.deptCd,
        },
      },
      update: {
        deptName:           row.deptName,
        doctorName:         row.doctorName,
        planSession:        row.planSession,
        realSession:        row.realSession,
        totalExamCap:       row.totalExamCap,
        closeReason:        close?.closeReason         ?? null,
        closeRequestTime:   close?.closeRequestTime    ?? null,
        morningStartTime:   time?.morningStartTime     ?? null,
        morningEndTime:     time?.morningEndTime       ?? null,
        afternoonStartTime: time?.afternoonStartTime   ?? null,
        afternoonEndTime:   time?.afternoonEndTime     ?? null,
        collectedAt:        new Date(),
      },
      create: {
        statDate,
        deptCd:             row.deptCd,
        deptName:           row.deptName,
        doctorId:           row.doctorId,
        doctorName:         row.doctorName,
        planSession:        row.planSession,
        realSession:        row.realSession,
        totalExamCap:       row.totalExamCap,
        closeReason:        close?.closeReason         ?? null,
        closeRequestTime:   close?.closeRequestTime    ?? null,
        morningStartTime:   time?.morningStartTime     ?? null,
        morningEndTime:     time?.morningEndTime       ?? null,
        afternoonStartTime: time?.afternoonStartTime   ?? null,
        afternoonEndTime:   time?.afternoonEndTime     ?? null,
      },
    });
  }

  logger.info(`DRPMA00200 저장 완료`);

  // ── 3. 집계 실행 ──────────────────
  const fromDate = parseDate(fromdd);
  const toDate   = parseDate(todd);
  await aggregateData(fromDate, toDate);
  logger.info(`집계 완료`);

  return {
    patientRows: totalPatientRows,
    sessionRows: sessionRows.length,
  };
}