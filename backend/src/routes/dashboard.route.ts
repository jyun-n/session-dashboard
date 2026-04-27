import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db.js";
import { authenticate } from "../middleware/auth.js";

export const dashboardRouter = Router();

const querySchema = z.object({
  fromdd: z.string().regex(/^\d{8}$/, "yyyymmdd 형식으로 입력해주세요."),
  todd:   z.string().regex(/^\d{8}$/, "yyyymmdd 형식으로 입력해주세요."),
});

function parseDate(yyyymmdd: string): Date {
  const y = parseInt(yyyymmdd.slice(0, 4), 10);
  const m = parseInt(yyyymmdd.slice(4, 6), 10) - 1;
  const d = parseInt(yyyymmdd.slice(6, 8), 10);
  return new Date(y, m, d);
}

function hhmiToMin(hhmi: string | null | undefined): number {
  if (!hhmi || hhmi === "0000") return 0;
  const padded = hhmi.padStart(4, "0");
  const h = parseInt(padded.slice(0, 2), 10);
  const m = parseInt(padded.slice(2, 4), 10);
  return h * 60 + m;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// GET /api/dashboard
dashboardRouter.get("/", authenticate, async (req, res, next) => {
  try {
    const { fromdd, todd } = querySchema.parse(req.query);

    const fromDate = parseDate(fromdd);
    const toDate   = parseDate(todd);

    // 교수별 집계 데이터 조회
    const rows = await prisma.dailyStatsByDoctor.findMany({
      where: {
        statDate: { gte: fromDate, lte: toDate },
      },
      orderBy: [
        { statDate: "asc" },
        { deptName: "asc" },
        { doctorName: "asc" },
      ],
    });

    // 마지막 수집 시간 조회
    const lastCollected = await prisma.rawPatientStats.findFirst({
      orderBy: { collectedAt: "desc" },
      select: { collectedAt: true },
    });

    // 대시보드 데이터 구조
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
    }));

    res.json({
      success: true,
      lastCollectedAt: lastCollected?.collectedAt ?? null,
      data: records,
    });
  } catch (err) {
    next(err);
  }
});