import rateLimit from "express-rate-limit";

// 전역 limiter — 모든 /api 요청에 적용. 정상 사용자는 도달 불가능한 한도.
// 봇/스크래퍼/DDoS 트래픽 방어가 주 목적.
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  limit: 1000,              // IP당 15분에 1,000회
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
  },
});

// 로그인 전용 limiter — /api/auth/login 에만 적용.
// 기존 ID당 5회/30분 잠금([auth.service.ts])과 함께 이중 방어:
// - ID 잠금: 한 ID로 5회 실패 → 30분 잠금
// - IP 제한: 한 IP에서 15분에 20회 시도 → 이후 차단 (다른 ID로 무한 시도 차단)
export const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  limit: 20,                // IP당 15분에 20회
  standardHeaders: "draft-7",
  legacyHeaders: false,
  // 성공한 로그인은 카운트에서 제외 (실패만 누적)
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.",
  },
});
