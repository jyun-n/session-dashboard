import { env } from "../config/env.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

type Level = "debug" | "info" | "warn" | "error";

const levelPriority: Record<Level, number> = {
  debug: 10,
  info:  20,
  warn:  30,
  error: 40,
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// dist/utils/logger.js 기준으로 backend/logs/ 경로 설정
const logDir = path.resolve(__dirname, "../../logs");

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function shouldLog(level: Level): boolean {
  return levelPriority[level] >= levelPriority[env.LOG_LEVEL];
}

function format(level: Level, message: string, meta?: unknown): string {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] ${level.toUpperCase()} ${message}`;
  return meta === undefined ? base : `${base} ${JSON.stringify(meta)}`;
}

function writeToFile(line: string) {
  try {
    const now = new Date();
    const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const date = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
    const filePath = path.join(logDir, `${date}.log`);
    fs.appendFileSync(filePath, line + "\n", "utf8");
  } catch {
    // 파일 쓰기 실패해도 서버 동작에 영향 없음
  }
}

export const logger = {
  debug(message: string, meta?: unknown) {
    if (!shouldLog("debug")) return;
    const line = format("debug", message, meta);
    console.debug(line);
    writeToFile(line);
  },
  info(message: string, meta?: unknown) {
    if (!shouldLog("info")) return;
    const line = format("info", message, meta);
    console.info(line);
    writeToFile(line);
  },
  warn(message: string, meta?: unknown) {
    if (!shouldLog("warn")) return;
    const line = format("warn", message, meta);
    console.warn(line);
    writeToFile(line);
  },
  error(message: string, meta?: unknown) {
    if (!shouldLog("error")) return;
    const line = format("error", message, meta);
    console.error(line);
    writeToFile(line);
  },
};