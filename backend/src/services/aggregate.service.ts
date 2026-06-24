import { prisma } from "../config/db.js";
import { minToHhmi } from "./hospital.api.service.js";
import { logger } from "../utils/logger.js";
import { Decimal } from "@prisma/client/runtime/library.js";

const VALID_FLAGS   = ["F", "R", "D", "S"];
const REVISIT_FLAGS = ["D", "S", "R"];

function toDecimal(n: number | null): Decimal | null {
  return n !== null ? new Decimal(n) : null;
}

// 오전·오후 시작/종료 4필드 중 NOT NULL인 값으로 MIN(start) / MAX(end) 계산.
// 4필드 HHMM 4자리. lex 비교가 시간 순서와 일치하므로 문자열 그대로 비교.
function mergeTreatmentTimes(session: {
  morningStartTime:   string | null;
  morningEndTime:     string | null;
  afternoonStartTime: string | null;
  afternoonEndTime:   string | null;
}): { treatmentStartTime: string | null; treatmentEndTime: string | null } {
  const starts = [session.morningStartTime, session.afternoonStartTime].filter((s): s is string => !!s);
  const ends   = [session.morningEndTime,   session.afternoonEndTime].filter((s): s is string => !!s);
  return {
    treatmentStartTime: starts.length > 0 ? starts.reduce((a, b) => (a < b ? a : b)) : null,
    treatmentEndTime:   ends.length   > 0 ? ends.reduce((a, b) => (a > b ? a : b))   : null,
  };
}

async function aggregateByDoctor(fromDate: Date, toDate: Date) {
  const sessions = await prisma.rawSession.findMany({
    where: { statDate: { gte: fromDate, lte: toDate } },
  });

  for (const session of sessions) {
    const { statDate, doctorId, deptCd } = session;

    const patientRows = await prisma.rawPatientStats.findMany({
      where: { statDate, doctorId, deptCd },
    });

    const { treatmentStartTime, treatmentEndTime } = mergeTreatmentTimes(session);

    const validRows       = patientRows.filter(r => VALID_FLAGS.includes(r.fsexamFlag));
    const fRow            = patientRows.find(r => r.fsexamFlag === "F");
    const firstVisitCount = fRow?.patCnt ?? 0;
    // 재진 = D + S + R 합산 (재진 유형이 여러 코드로 분리되어 들어와 모두 합쳐야 함)
    const revisitCount    = patientRows
      .filter(r => REVISIT_FLAGS.includes(r.fsexamFlag))
      .reduce((sum, r) => sum + r.patCnt, 0);
    const totalPatients   = validRows.reduce((sum, r) => sum + r.patCnt, 0);

    // 평균 진료시간 / 대기시간 가중평균 (D+S+R+F, 4/5 제외)
    let avgOrdMin:  number | null = null;
    let avgWaitMin: number | null = null;

    const validWithTime = validRows.filter(r => r.avgOrdMin !== null);
    const totalValidPat = validWithTime.reduce((sum, r) => sum + r.patCnt, 0);

    if (totalValidPat > 0) {
      const ordSum  = validWithTime.reduce((sum, r) => sum + (Number(r.avgOrdMin)  * r.patCnt), 0);
      const waitSum = validWithTime.reduce((sum, r) => sum + (Number(r.avgWaitMin) * r.patCnt), 0);
      avgOrdMin  = ordSum  / totalValidPat;
      avgWaitMin = waitSum / totalValidPat;
    }

    const avgOrdTime  = avgOrdMin  !== null ? minToHhmi(Math.round(avgOrdMin))  : null;
    const avgWaitTime = avgWaitMin !== null ? minToHhmi(Math.round(avgWaitMin)) : null;

    // 세션 가동률
    const sessionUtilization = session.planSession > 0
      ? new Decimal(session.realSession / session.planSession * 100).toDecimalPlaces(2)
      : null;

    // 예약현황 가동률 = totalPatients / totalExamCap × 100
    const bookingRate = session.totalExamCap > 0
      ? new Decimal(totalPatients / session.totalExamCap * 100).toDecimalPlaces(2)
      : null;

    await prisma.dailyStatsByDoctor.upsert({
      where: {
        statDate_doctorId_deptCd: { statDate, doctorId, deptCd },
      },
      update: {
        deptName: session.deptName, doctorName: session.doctorName,
        planSession: session.planSession, realSession: session.realSession,
        sessionUtilization, totalExamCap: session.totalExamCap,
        avgOrdTime, avgWaitTime,
        avgOrdMin: toDecimal(avgOrdMin), avgWaitMin: toDecimal(avgWaitMin),
        firstVisitCount, revisitCount, totalPatients, bookingRate,
        treatmentStartTime,
        treatmentEndTime,
        closeRequestTime:   session.closeRequestTime,
        closeReason:        session.closeReason,
        aggregatedAt: new Date(),
      },
      create: {
        statDate, deptCd, deptName: session.deptName,
        doctorId, doctorName: session.doctorName,
        planSession: session.planSession, realSession: session.realSession,
        sessionUtilization, totalExamCap: session.totalExamCap,
        avgOrdTime, avgWaitTime,
        avgOrdMin: toDecimal(avgOrdMin), avgWaitMin: toDecimal(avgWaitMin),
        firstVisitCount, revisitCount, totalPatients, bookingRate,
        treatmentStartTime,
        treatmentEndTime,
        closeRequestTime:   session.closeRequestTime,
        closeReason:        session.closeReason,
      },
    });
  }

  logger.info(`교수별 집계 완료: ${sessions.length}건`);
}

async function aggregateByDept(fromDate: Date, toDate: Date) {
  const deptList = await prisma.dailyStatsByDoctor.groupBy({
    by: ["statDate", "deptCd"],
    where: { statDate: { gte: fromDate, lte: toDate } },
  });

  for (const { statDate, deptCd } of deptList) {
    const doctors = await prisma.dailyStatsByDoctor.findMany({
      where: { statDate, deptCd },
    });

    if (doctors.length === 0) continue;

    const deptName    = doctors[0].deptName;
    const doctorCount = doctors.length;
    const planSession = doctors.reduce((sum, d) => sum + (d.planSession ?? 0), 0);
    const realSession = doctors.reduce((sum, d) => sum + (d.realSession ?? 0), 0);
    const totalExamCap = doctors.reduce((sum, d) => sum + (d.totalExamCap ?? 0), 0);

    const sessionUtilization = planSession > 0
      ? new Decimal(realSession / planSession * 100).toDecimalPlaces(2)
      : null;

    const firstVisitCount = doctors.reduce((sum, d) => sum + (d.firstVisitCount ?? 0), 0);
    const revisitCount    = doctors.reduce((sum, d) => sum + (d.revisitCount    ?? 0), 0);
    const totalPatients   = doctors.reduce((sum, d) => sum + (d.totalPatients   ?? 0), 0);

    // 예약현황 가동률 = totalPatients / totalExamCap × 100
    const bookingRate = totalExamCap > 0
      ? new Decimal(totalPatients / totalExamCap * 100).toDecimalPlaces(2)
      : null;

    let avgOrdMin:  number | null = null;
    let avgWaitMin: number | null = null;

    const doctorsWithTime = doctors.filter(
      d => d.avgOrdMin !== null && (d.totalPatients ?? 0) > 0
    );
    const totalPat = doctorsWithTime.reduce((sum, d) => sum + (d.totalPatients ?? 0), 0);

    if (totalPat > 0) {
      const ordSum  = doctorsWithTime.reduce((sum, d) => sum + (Number(d.avgOrdMin)  * (d.totalPatients ?? 0)), 0);
      const waitSum = doctorsWithTime.reduce((sum, d) => sum + (Number(d.avgWaitMin) * (d.totalPatients ?? 0)), 0);
      avgOrdMin  = ordSum  / totalPat;
      avgWaitMin = waitSum / totalPat;
    }

    const avgOrdTime  = avgOrdMin  !== null ? minToHhmi(Math.round(avgOrdMin))  : null;
    const avgWaitTime = avgWaitMin !== null ? minToHhmi(Math.round(avgWaitMin)) : null;

    await prisma.dailyStatsByDept.upsert({
      where: { statDate_deptCd: { statDate, deptCd } },
      update: {
        deptName, doctorCount, planSession, realSession,
        sessionUtilization, totalExamCap, avgOrdTime, avgWaitTime,
        firstVisitCount, revisitCount, totalPatients, bookingRate,
        aggregatedAt: new Date(),
      },
      create: {
        statDate, deptCd, deptName, doctorCount, planSession, realSession,
        sessionUtilization, totalExamCap, avgOrdTime, avgWaitTime,
        firstVisitCount, revisitCount, totalPatients, bookingRate,
      },
    });
  }

  logger.info(`진료과별 집계 완료: ${deptList.length}건`);
}

export async function aggregateData(fromDate: Date, toDate: Date) {
  await aggregateByDoctor(fromDate, toDate);
  await aggregateByDept(fromDate, toDate);
}