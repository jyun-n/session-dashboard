import { prisma } from "../config/db.js";
import {
  fetchPatientStats,
  fetchSessions,
} from "./hospital.api.service.js";
import { aggregateData } from "./aggregate.service.js";
import { logger } from "../utils/logger.js";

function parseDate(yyyymmdd: string): Date {
  const y = parseInt(yyyymmdd.slice(0, 4), 10);
  const m = parseInt(yyyymmdd.slice(4, 6), 10) - 1;
  const d = parseInt(yyyymmdd.slice(6, 8), 10);
  return new Date(y, m, d);
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function getDateRange(fromdd: string, todd: string): string[] {
  const dates: string[] = [];
  const current = parseDate(fromdd);
  const end     = parseDate(todd);

  while (current <= end) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
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

    for (const row of patientRows) {
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

    totalPatientRows += patientRows.length;
    logger.info(`DRPMA00100 ${yyyymmdd}: ${patientRows.length}건`);
  }

  logger.info(`DRPMA00100 저장 완료: 총 ${totalPatientRows}건`);

  // ── 2. DRPMA00200 기간 전체 수집 ──────────────────
  const sessionRows = await fetchSessions(fromdd, todd);
  logger.info(`DRPMA00200 수신: ${sessionRows.length}건`);

  for (const row of sessionRows) {
    const statDate = parseDate(row.statDate);

    await prisma.rawSession.upsert({
      where: {
        statDate_doctorId_deptCd: {
          statDate,
          doctorId: row.doctorId,
          deptCd:   row.deptCd,
        },
      },
      update: {
        deptName:    row.deptName,
        doctorName:  row.doctorName,
        planSession: row.planSession,
        realSession: row.realSession,
        fstExamCap:  row.fstExamCap,
        reExamCap:   row.reExamCap,
        collectedAt: new Date(),
      },
      create: {
        statDate,
        deptCd:      row.deptCd,
        deptName:    row.deptName,
        doctorId:    row.doctorId,
        doctorName:  row.doctorName,
        planSession: row.planSession,
        realSession: row.realSession,
        fstExamCap:  row.fstExamCap,
        reExamCap:   row.reExamCap,
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