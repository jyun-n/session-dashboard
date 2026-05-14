import jwt from "jsonwebtoken";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { verifyPassword } from "../utils/password.js";
import { HttpError } from "../middleware/error.js";

// 로그인 실패 카운트와 잠금 상태를 메모리에 보관한다.
// 서버 재시작 시 초기화되며, 다중 인스턴스 환경에서는 인스턴스마다 별도로 카운트된다.
const MAX_FAIL = 5;
const LOCK_MIN = 30;

interface LoginAttempt {
  failCount: number;
  lockedUntil: Date | null;
}

const loginAttempts = new Map<string, LoginAttempt>();

function getAttempt(loginId: string): LoginAttempt {
  return loginAttempts.get(loginId) ?? { failCount: 0, lockedUntil: null };
}

function isLocked(attempt: LoginAttempt): boolean {
  return attempt.lockedUntil !== null && new Date() < attempt.lockedUntil;
}

function recordFail(loginId: string): LoginAttempt {
  const prev = getAttempt(loginId);
  const failCount = prev.failCount + 1;
  const lockedUntil =
    failCount >= MAX_FAIL ? new Date(Date.now() + LOCK_MIN * 60 * 1000) : null;
  const updated = { failCount, lockedUntil };
  loginAttempts.set(loginId, updated);
  return updated;
}

function resetAttempt(loginId: string): void {
  loginAttempts.delete(loginId);
}

function getRemainingMin(attempt: LoginAttempt): number {
  if (!attempt.lockedUntil) return 0;
  return Math.ceil((attempt.lockedUntil.getTime() - Date.now()) / 60000);
}

function failMessage(failCount: number): string {
  const remaining = MAX_FAIL - failCount;
  return remaining > 0
    ? `아이디 또는 비밀번호가 올바르지 않습니다. (${failCount}/${MAX_FAIL}회 실패)`
    : `계정이 잠겼습니다. ${LOCK_MIN}분 후 다시 시도해주세요.`;
}

export async function login(
  loginId: string,
  password: string,
  meta: { ipAddress?: string; userAgent?: string } = {}
) {
  const attempt = getAttempt(loginId);

  if (isLocked(attempt)) {
    throw new HttpError(429, `계정이 잠겼습니다. ${getRemainingMin(attempt)}분 후 다시 시도해주세요.`);
  }

  const account = await prisma.account.findFirst({
    where: { loginId, deletedAt: null },
  });

  if (!account) {
    const updated = recordFail(loginId);
    throw new HttpError(401, failMessage(updated.failCount));
  }

  const isValid = await verifyPassword(password, account.passwordHash);
  if (!isValid) {
    const updated = recordFail(loginId);
    throw new HttpError(401, failMessage(updated.failCount));
  }

  resetAttempt(loginId);

  const token = jwt.sign(
    { sub: account.id, role: account.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN, algorithm: "HS256" } as jwt.SignOptions,
  );

  await prisma.loginLog.create({
    data: {
      accountId: account.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  });

  return {
    token,
    account: {
      id: account.id,
      name: account.name,
      dept: account.dept,
      position: account.position,
      role: account.role,
    },
  };
}
