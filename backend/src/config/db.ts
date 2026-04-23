import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

export const prisma = new PrismaClient({
  log:
    env.NODE_ENV === "development"
      ? ["query", "info", "warn", "error"]
      : ["warn", "error"],
});

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}
