import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string()
    .min(32, "JWT_SECRET must be at least 32 characters")
    .refine(
      (v) => !/change[-_ ]?me|placeholder|example|secret[-_ ]?key|dashboard[-_ ]?jwt/i.test(v),
      "JWT_SECRET appears to be a placeholder; generate a strong random value (e.g. `node -e \"console.log(require('crypto').randomBytes(48).toString('base64'))\"`)",
    ),
  JWT_EXPIRES_IN: z.string().default("1d"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  DELETE_SECRET: z.string().min(1, "DELETE_SECRET is required"),
  EMR_BASE_URL: z.string().url().default("http://emr124.cauhs.or.kr/cmcnu/.live"),
  EMR_INST_CD:  z.string().default("124"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;