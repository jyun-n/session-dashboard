import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { HttpError } from "./error.js";

export interface JwtPayload {
  sub: string;
  role: "ADMIN" | "USER";
}

export const authenticate: RequestHandler = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(new HttpError(401, "인증 토큰이 없습니다."));
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    res.locals.user = payload;
    next();
  } catch {
    next(new HttpError(401, "유효하지 않은 토큰입니다."));
  }
};

export const requireAdmin: RequestHandler = (_req, res, next) => {
  const user = res.locals.user as JwtPayload;

  if (user?.role !== "ADMIN") {
    return next(new HttpError(403, "관리자 권한이 필요합니다."));
  }

  next();
};