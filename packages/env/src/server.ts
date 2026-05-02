import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const currentDir = dirname(fileURLToPath(import.meta.url));
const envCandidates = [
  resolve(currentDir, "../../../apps/server/.env"),
  resolve(process.cwd(), ".env"),
];

for (const envPath of envCandidates) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

function parseOriginList(value?: string) {
  if (!value) return [];

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => z.url().parse(origin));
}

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url().optional(),
    CORS_ORIGINS: z.string().optional(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

export const allowedOrigins = [
  ...parseOriginList(env.CORS_ORIGINS),
  ...parseOriginList(env.CORS_ORIGIN),
];
