import { prisma } from "../config/db.js";
import { minToHhmi } from "./hospital.api.service.js";
import { logger } from "../utils/logger.js";
import { Decimal } from "@prisma/client/runtime/library.js";

const VALID_FLAGS = ["F", "R", "D", "S"];

function toDecimal(n: number | null): Decimal | null {
  return n !== null ? new Decimal(n) : null;
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

    const validRows       = patientRows.filter(r => VALID_FLAGS.includes(r.fsexamFlag));
    const fRow            = patientRows.find(r => r.fsexamFlag === "F");
    const rRow            = patientRows.find(r => r.fsexamFlag === "R");
    const firstVisitCount = fRow?.patCnt ?? 0;
    const revisitCount    = rRow?.patCnt ?? 0;
    const totalPatients   = validRows.reduce((sum, r) => sum + r.patCnt, 0);

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

    const sessionUtilization = session.planSession > 0
      ? new Decimal(session.realSession / session.planSession * 100).toDecimalPlaces(2)
      : null;

    const capTotal    = session.fstExamCap + session.reExamCap;
    const bookingRate = capTotal > 0
      ? new Decimal((firstVisitCount + revisitCount) / capTotal * 100).toDecimalPlaces(2)
      : null;

    await prisma.dailyStatsByDoctor.upsert({
      where: {
        statDate_doctorId_deptCd: { statDate, doctorId, deptCd },
      },
      update: {
        deptName: session.deptName, doctorName: session.doctorName,
        planSession: session.planSession, realSession: session.realSession,
        sessionUtilization, fstExamCap: session.fstExamCap, reExamCap: session.reExamCap,
        avgOrdTime, avgWaitTime, avgOrdMin: toDecimal(avgOrdMin), avgWaitMin: toDecimal(avgWaitMin),
        firstVisitCount, revisitCount, totalPatients, bookingRate,
        aggregatedAt: new Date(),
      },
      create: {
        statDate, deptCd, deptName: session.deptName, doctorId, doctorName: session.doctorName,
        planSession: session.planSession, realSession: session.realSession,
        sessionUtilization, fstExamCap: session.fstExamCap, reExamCap: session.reExamCap,
        avgOrdTime, avgWaitTime, avgOrdMin: toDecimal(avgOrdMin), avgWaitMin: toDecimal(avgWaitMin),
        firstVisitCount, revisitCount, totalPatients, bookingRate,
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
    const fstExamCap  = doctors.reduce((sum, d) => sum + (d.fstExamCap  ?? 0), 0);
    const reExamCap   = doctors.reduce((sum, d) => sum + (d.reExamCap   ?? 0), 0);

    const sessionUtilization = planSession > 0
      ? new Decimal(realSession / planSession * 100).toDecimalPlaces(2)
      : null;

    const firstVisitCount = doctors.reduce((sum, d) => sum + (d.firstVisitCount ?? 0), 0);
    const revisitCount    = doctors.reduce((sum, d) => sum + (d.revisitCount    ?? 0), 0);
    const totalPatients   = doctors.reduce((sum, d) => sum + (d.totalPatients   ?? 0), 0);

    const capTotal    = fstExamCap + reExamCap;
    const bookingRate = capTotal > 0
      ? new Decimal((firstVisitCount + revisitCount) / capTotal * 100).toDecimalPlaces(2)
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
        deptName, doctorCount, planSession, realSession, sessionUtilization,
        fstExamCap, reExamCap, avgOrdTime, avgWaitTime,
        firstVisitCount, revisitCount, totalPatients, bookingRate,
        aggregatedAt: new Date(),
      },
      create: {
        statDate, deptCd, deptName, doctorCount, planSession, realSession,
        sessionUtilization, fstExamCap, reExamCap, avgOrdTime, avgWaitTime,
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