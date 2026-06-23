import "dotenv/config";
import { collectData } from "../services/collect.service.js";
import { prisma } from "../config/db.js";

const [, , fromdd, todd] = process.argv;

if (!fromdd || !todd || !/^\d{8}$/.test(fromdd) || !/^\d{8}$/.test(todd)) {
  console.error("Usage: cross-env TZ=UTC npx tsx src/scripts/backfill.ts <fromdd:YYYYMMDD> <todd:YYYYMMDD>");
  console.error("Example: cross-env TZ=UTC npx tsx src/scripts/backfill.ts 20260401 20260514");
  process.exit(1);
}

console.log(`[백필] 시작: ${fromdd} ~ ${todd} (TZ=${process.env.TZ ?? "(unset)"})`);

try {
  const result = await collectData(fromdd, todd);
  console.log(`[백필] 완료:`, result);
  process.exit(0);
} catch (err) {
  console.error("[백필] 실패:", err);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
