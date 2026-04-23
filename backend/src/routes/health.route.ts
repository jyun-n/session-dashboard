import { Router } from "express";
import { prisma } from "../config/db.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const startedAt = Date.now();
  let dbOk = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  res.status(dbOk ? 200 : 503).json({
    success: dbOk,
    status: dbOk ? "ok" : "degraded",
    db: dbOk ? "up" : "down",
    uptimeSec: Math.round(process.uptime()),
    responseTimeMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  });
});
