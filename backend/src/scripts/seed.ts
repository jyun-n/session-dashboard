import { prisma } from "../config/db.js";
import { hashPassword } from "../utils/password.js";

async function seed() {
  const passwordHash = await hashPassword("opmadmin9211");

  const account = await prisma.account.create({
    data: {
      empNo: "00000",
      dept: "진료운영팀",
      position: "관리자",
      name: "관리자",
      loginId: "admin",
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log("✅ 운영자 계정 생성 완료:", account.loginId);
  await prisma.$disconnect();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});