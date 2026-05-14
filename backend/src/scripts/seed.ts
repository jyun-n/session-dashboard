import "dotenv/config";
import { prisma } from "../config/db.js";
import { hashPassword } from "../utils/password.js";

async function seed() {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    console.error("❌ SEED_ADMIN_PASSWORD 환경변수가 필요합니다.");
    console.error("   예: SEED_ADMIN_PASSWORD='Strong@Pass2026!' npx tsx src/scripts/seed.ts");
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("❌ SEED_ADMIN_PASSWORD는 10자 이상이어야 합니다.");
    process.exit(1);
  }

  const loginId = process.env.SEED_ADMIN_LOGIN_ID ?? "admin";
  const empNo   = process.env.SEED_ADMIN_EMP_NO   ?? "00000";

  const passwordHash = await hashPassword(password);

  const account = await prisma.account.create({
    data: {
      empNo,
      dept: "진료운영팀",
      position: "관리자",
      name: "관리자",
      loginId,
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log(`✅ 운영자 계정 생성 완료: ${account.loginId} (empNo: ${account.empNo})`);
  console.log("⚠️  로그인 후 비밀번호를 즉시 변경해주세요.");
  await prisma.$disconnect();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});