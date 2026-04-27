import type { RequestHandler } from "express";
import { z } from "zod";
import * as authService from "../services/auth.service.js";

const loginSchema = z.object({
  loginId: z.string().min(1, "아이디를 입력해주세요."),
  password: z.string().min(1, "비밀번호를 입력해주세요."),
});

export const loginHandler: RequestHandler = async (req, res, next) => {
  try {
    const { loginId, password } = loginSchema.parse(req.body);

    const forwarded = req.headers["x-forwarded-for"];
    const ipAddress =
      (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]?.trim()) ||
      req.ip ||
      req.socket.remoteAddress ||
      undefined;
    const userAgent = req.headers["user-agent"] ?? undefined;

    const result = await authService.login(loginId, password, {
      ipAddress,
      userAgent,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};