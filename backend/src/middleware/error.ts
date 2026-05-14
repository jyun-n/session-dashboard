import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { logger } from "../utils/logger.js";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const fieldErrors = err.flatten().fieldErrors;
    // 첫 번째 필드 에러를 사용자 친화 메시지로 노출 (한국어 메시지가 zod 스키마에 정의되어 있음)
    const firstMessage = Object.values(fieldErrors).flat().find((m): m is string => typeof m === "string");
    res.status(400).json({
      success: false,
      message: firstMessage ?? "입력값이 올바르지 않습니다.",
      details: fieldErrors,
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({
      success: false,
      message: err.message,
      details: err.details,
    });
    return;
  }

  logger.error("Unhandled error", {
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};
