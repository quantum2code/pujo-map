import { getTableName, sql, type Table } from "drizzle-orm";
import { db } from "..";

export const OVERPASS_API_URL =
  process.env.OVERPASS_API_URL ?? "https://overpass-api.de/api/interpreter";

const OVERPASS_USER_AGENT = "pujo-map-seed/1.0 (local development)";

export async function getOverpassData(apiURL: string, query: string) {
  try {
    const requestUrl = new URL(apiURL);
    requestUrl.searchParams.set("data", query);

    const response = await fetch(requestUrl, {
      method: "GET",
      headers: {
        "User-Agent": OVERPASS_USER_AGENT,
      },
    });

    const responseBody = await response.text();

    if (!response.ok) {
      throw new Error(
        `Overpass request failed with ${response.status} ${response.statusText}: ${responseBody}`,
      );
    }

    try {
      return JSON.parse(responseBody);
    } catch {
      throw new Error(
        `Overpass returned non-JSON response (${response.headers.get("content-type") ?? "unknown"}): ${responseBody}`,
      );
    }
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function resetTable(seedDb: typeof db, table: Table) {
  return seedDb.execute(
    sql.raw(`TRUNCATE TABLE ${getTableName(table)} RESTART IDENTITY CASCADE`),
  );
}
