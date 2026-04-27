import jwt from "jsonwebtoken";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { verifyPassword } from "../utils/password.js";
import { HttpError } from "../middleware/error.js";

export async function login(
  loginId: string,
  password: string,
  meta: { ipAddress?: string; userAgent?: string } = {}
) {
  // 1. 계정 조회
  const account = await prisma.account.findFirst({
    where: {
      loginId,
      deletedAt: null, // 탈퇴 계정 제외
    },
  });

  if (!account) {
    throw new HttpError(401, "아이디 또는 비밀번호가 올바르지 않습니다.");
  }

  // 2. 비밀번호 검증
  const isValid = await verifyPassword(password, account.passwordHash);
  if (!isValid) {
    throw new HttpError(401, "아이디 또는 비밀번호가 올바르지 않습니다.");
  }

  // 3. 로그인 로그 기록 (실패해도 로그인 자체는 계속)
  try {
    await prisma.loginLog.create({
      data: {
        accountId: account.id,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });
  } catch (err) {
    console.error("Failed to record login log:", err);
  }

  // 4. JWT 발급
  const token = jwt.sign(
    {
      sub: account.id,
      role: account.role,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions,
  );

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