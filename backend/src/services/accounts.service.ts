import { prisma } from "../config/db.js";
import { hashPassword } from "../utils/password.js";
import { HttpError } from "../middleware/error.js";
import { env } from "../config/env.js";

const ACCOUNT_PUBLIC_FIELDS = {
  id: true,
  empNo: true,
  dept: true,
  position: true,
  name: true,
  loginId: true,
  role: true,
  createdAt: true,
} as const;

export async function getAccounts() {
  return prisma.account.findMany({
    where: { deletedAt: null },
    select: ACCOUNT_PUBLIC_FIELDS,
    orderBy: { createdAt: "asc" },
  });
}

// 활성 계정 중복은 거절하고, 같은 사번+아이디로 탈퇴한 row가 있으면 재활성화한다.
// (empNo, loginId가 DB-level @unique 이므로 새 row를 만들 수 없다.)
export async function createAccount(data: {
  empNo: string;
  dept: string;
  position: string;
  name: string;
  loginId: string;
  password: string;
  role?: "ADMIN" | "USER";
}) {
  const activeEmpNo = await prisma.account.findFirst({
    where: { empNo: data.empNo, deletedAt: null },
  });
  if (activeEmpNo) {
    throw new HttpError(409, "이미 사용 중인 사번입니다.");
  }

  const activeLoginId = await prisma.account.findFirst({
    where: { loginId: data.loginId, deletedAt: null },
  });
  if (activeLoginId) {
    throw new HttpError(409, "이미 사용 중인 아이디입니다.");
  }

  const deletedByEmpNo = await prisma.account.findFirst({
    where: { empNo: data.empNo, deletedAt: { not: null } },
  });
  const deletedByLoginId = await prisma.account.findFirst({
    where: { loginId: data.loginId, deletedAt: { not: null } },
  });

  const passwordHash = await hashPassword(data.password);

  // 사번과 아이디가 모두 같은 탈퇴 계정이면 deletedAt만 비워서 재활성화
  if (
    deletedByEmpNo &&
    deletedByLoginId &&
    deletedByEmpNo.id === deletedByLoginId.id
  ) {
    return prisma.account.update({
      where: { id: deletedByEmpNo.id },
      data: {
        dept: data.dept,
        position: data.position,
        name: data.name,
        passwordHash,
        role: data.role ?? "USER",
        deletedAt: null,
      },
      select: ACCOUNT_PUBLIC_FIELDS,
    });
  }

  // 사번 또는 아이디 한쪽만 탈퇴 row와 겹치면 새 row를 만들 수 없으므로 거절
  if (deletedByEmpNo) {
    throw new HttpError(
      409,
      "해당 사번은 이전에 탈퇴한 계정에서 사용되었습니다. 동일한 아이디로만 재가입할 수 있습니다."
    );
  }
  if (deletedByLoginId) {
    throw new HttpError(
      409,
      "해당 아이디는 이전에 탈퇴한 계정에서 사용되었습니다. 동일한 사번으로만 재가입할 수 있습니다."
    );
  }

  return prisma.account.create({
    data: {
      empNo: data.empNo,
      dept: data.dept,
      position: data.position,
      name: data.name,
      loginId: data.loginId,
      passwordHash,
      role: data.role ?? "USER",
    },
    select: ACCOUNT_PUBLIC_FIELDS,
  });
}

export async function updateAccount(
  id: string,
  data: { dept: string; position: string }
) {
  const account = await prisma.account.findFirst({
    where: { id, deletedAt: null },
  });
  if (!account) {
    throw new HttpError(404, "계정을 찾을 수 없습니다.");
  }

  return prisma.account.update({
    where: { id },
    data: {
      dept: data.dept,
      position: data.position,
    },
    select: ACCOUNT_PUBLIC_FIELDS,
  });
}

export async function resetPassword(id: string, newPassword: string) {
  const account = await prisma.account.findFirst({
    where: { id, deletedAt: null },
  });
  if (!account) {
    throw new HttpError(404, "계정을 찾을 수 없습니다.");
  }

  const passwordHash = await hashPassword(newPassword);

  return prisma.account.update({
    where: { id },
    data: { passwordHash },
    select: { id: true, name: true },
  });
}

// soft delete: 행을 지우지 않고 deletedAt만 채운다 (재활성화 가능하도록)
export async function deleteAccount(id: string, deleteSecret: string) {
  const account = await prisma.account.findFirst({
    where: { id, deletedAt: null },
  });
  if (!account) {
    throw new HttpError(404, "계정을 찾을 수 없습니다.");
  }

  if (account.role === "ADMIN") {
    throw new HttpError(403, "관리자 계정은 탈퇴할 수 없습니다.");
  }

  if (deleteSecret !== env.DELETE_SECRET) {
    throw new HttpError(401, "탈퇴 비밀번호가 올바르지 않습니다.");
  }

  return prisma.account.update({
    where: { id },
    data: { deletedAt: new Date() },
    select: { id: true, name: true },
  });
}

export async function getAllLoginLogs(limit = 200) {
  return prisma.loginLog.findMany({
    orderBy: { loginAt: "desc" },
    take: limit,
    select: {
      id: true,
      loginAt: true,
      ipAddress: true,
      userAgent: true,
      account: {
        select: {
          id: true,
          name: true,
          loginId: true,
          empNo: true,
          dept: true,
          position: true,
          role: true,
        },
      },
    },
  });
}
