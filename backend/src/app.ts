import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { generalLimiter } from "./middleware/rateLimiter.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);

  app.use(
    helmet({
      // HSTS: SSL 적용 전엔 비활성화 (HTTP 응답에 HSTS 가면 브라우저가 HTTPS 강제 캐시 → 사이트 접근 불가 위험).
      // SSL 적용 후 다음 값으로 교체:
      //   strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true, preload: false }
      strictTransportSecurity: false,

      // CSP: 백엔드는 JSON API만 응답하므로 script/style 제약은 의미 작지만, 표준 보안 헤더로 유지.
      // Nginx 단에서 HTML 응답에도 별도 CSP 헤더 추가 권장.
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"], // 클릭재킹 방어
          baseUri: ["'self'"],         // base 태그 변조 방어
        },
      },

      // 의료정보 외부 노출 최소화 — 외부 사이트로 리퍼러 보내지 않음
      referrerPolicy: { policy: "no-referrer" },
    }),
  );
  app.use(
    cors({
      origin: env.CORS_ORIGIN === "*"
        ? "*"
        : env.CORS_ORIGIN.split(",").map((o) => o.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));

  // 모든 /api 요청에 전역 rate limit 적용 (브루트포스/DDoS 1차 방어)
  app.use("/api", generalLimiter, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
