import { Router } from "express";
import { z } from "zod";
import { collectData } from "../services/collect.service.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

export const collectRouter = Router();

const collectSchema = z.object({
  fromdd: z.string().regex(/^\d{8}$/, "yyyymmdd 형식으로 입력해주세요."),
  todd:   z.string().regex(/^\d{8}$/, "yyyymmdd 형식으로 입력해주세요."),
});

collectRouter.post("/", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { fromdd, todd } = collectSchema.parse(req.body);
    const result = await collectData(fromdd, todd);

    res.json({
      success: true,
      message: `수집 완료`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});