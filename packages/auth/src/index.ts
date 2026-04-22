import { createDb } from "@pujo-map/db";
import * as schema from "@pujo-map/db/schema/auth";
import { allowedOrigins, env } from "@pujo-map/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export function createAuth() {
  const db = createDb();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",

      schema: schema,
    }),
    trustedOrigins: allowedOrigins,
    emailAndPassword: {
      enabled: true,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
        refreshCache: true,
      },
    },
    plugins: [],
  });
}

export const auth = createAuth();
