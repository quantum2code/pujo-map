import { env } from "@pujo-map/env/server";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

function shouldUseSsl(connectionString: string) {
  try {
    const url = new URL(connectionString);

    return (
      url.hostname.endsWith("supabase.co") ||
      url.searchParams.get("sslmode") === "require"
    );
  } catch {
    return false;
  }
}

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: shouldUseSsl(env.DATABASE_URL)
    ? { rejectUnauthorized: false }
    : undefined,
});

export function createDb() {
  return drizzle(pool, { schema });
}

export const db = createDb();
