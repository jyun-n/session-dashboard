import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db.js";
import { authenticate } from "../middleware/auth.js";

export const dashboardRouter = Router();

const querySchema = z.object({
  fromdd: z.string().regex(/^\d{8}$/, "yyyymmdd 형식으로 입력해주세요."),
  todd:   z.string().regex(/^\d{8}$/, "yyyymmdd 형식으로 입력해주세요."),
});

// 수집 시 parseDate와 동일하게 UTC 자정으로 만들어야
// @db.Date 컬럼과 비교/포맷이 어긋나지 않음.
function parseDate(yyyymmdd: string): Date {
  const y = parseInt(yyyymmdd.slice(0, 4), 10);
  const m = parseInt(yyyymmdd.slice(4, 6), 10) - 1;
  const d = parseInt(yyyymmdd.slice(6, 8), 10);
  return new Date(Date.UTC(y, m, d));
}

function hhmiToMin(hhmi: string | null | undefined): number {
  if (!hhmi || hhmi === "0000") return 0;
  const padded = hhmi.padStart(4, "0");
  const h = parseInt(padded.slice(0, 2), 10);
  const m = parseInt(padded.slice(2, 4), 10);
  return h * 60 + m;
}

function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

dashboardRouter.get("/", authenticate, async (req, res, next) => {
  try {
    const { fromdd, todd } = querySchema.parse(req.query);

    const fromDate = parseDate(fromdd);
    const toDate   = parseDate(todd);

    const rows = await prisma.dailyStatsByDoctor.findMany({
      where: {
        statDate:   { gte: fromDate, lte: toDate },
        doctorName: { not: "" },
      },
      orderBy: [
        { statDate:   "asc" },
        { deptName:   "asc" },
        { doctorName: "asc" },
      ],
    });

    // 환자 통계(DRPMA00100)와 세션 정보(DRPMA00200) 중 더 최근에 수집된 시각을 사용.
    // 아침 07:30처럼 환자 통계가 0건이어도 세션 정보가 들어오면 화면에 반영되도록.
    const [lastPatient, lastSession] = await Promise.all([
      prisma.rawPatientStats.findFirst({
        orderBy: { collectedAt: "desc" },
        select:  { collectedAt: true },
      }),
      prisma.rawSession.findFirst({
        orderBy: { collectedAt: "desc" },
        select:  { collectedAt: true },
      }),
    ]);

    const collectedTimes = [lastPatient?.collectedAt, lastSession?.collectedAt]
      .filter((d): d is Date => d != null);
    const lastCollectedAt = collectedTimes.length > 0
      ? new Date(Math.max(...collectedTimes.map((d) => d.getTime())))
      : null;

    const records = rows.map((row) => ({
      date:               formatDate(row.statDate),
      dept:               row.deptName,
      deptCd:             row.deptCd,
      professor:          row.doctorName,
      doctorId:           row.doctorId,
      plannedSessions:    row.planSession     ?? 0,
      actualSessions:     row.realSession     ?? 0,
      avgTreatmentMin:    hhmiToMin(row.avgOrdTime),
      avgWaitMin:         hhmiToMin(row.avgWaitTime),
      firstVisitPatients: row.firstVisitCount ?? 0,
      revisitPatients:    row.revisitCount    ?? 0,
      bookingRate:        Number(row.bookingRate ?? 0),
      // DRPMA00100 srchflag=T / DRPMA00200 신규 필드 (YYYYMMDDHHMMSS 14자리 또는 null)
      // 프론트는 substring(8,12)로 "HHMM"을 뽑아 표시. 일간 보기에선 단일값, 기간 보기에선 closeRequestTime 유무로 closeCount/closeRequests[] 집계.
      treatmentStartTime: row.treatmentStartTime ?? null,
      treatmentEndTime:   row.treatmentEndTime   ?? null,
      closeRequestTime:   row.closeRequestTime   ?? null,
      closeReason:        row.closeReason        ?? null,
    }));

    res.json({
      success: true,
      lastCollectedAt,
      data: records,
    });
  } catch (err) {
    next(err);
  }
});