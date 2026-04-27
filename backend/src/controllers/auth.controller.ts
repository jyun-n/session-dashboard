import type { Request, RequestHandler } from "express";
import { z } from "zod";
import * as authService from "../services/auth.service.js";

const loginSchema = z.object({
  loginId: z.string().min(1, "아이디를 입력해주세요."),
  password: z.string().min(1, "비밀번호를 입력해주세요."),
});

function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers["x-forwarded-for"];
  const fromHeader = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(",")[0]?.trim();
  return fromHeader || req.ip || req.socket.remoteAddress || undefined;
}

export const loginHandler: RequestHandler = async (req, res, next) => {
  try {
    const { loginId, password } = loginSchema.parse(req.body);

    const result = await authService.login(loginId, password, {
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"] ?? undefined,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};
