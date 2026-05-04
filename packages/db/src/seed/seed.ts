import { getTableName, sql, type Table } from "drizzle-orm";
import { db } from "..";
import opening_hours from "opening_hours";
import type { OpeningHours } from "../schema";

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

function toTimeStr(date: Date) {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export async function getOpeningHrs(
  timeStr: string | null,
): Promise<OpeningHours | null> {
  let result: OpeningHours | null = null;

  if (!timeStr) return result;

  switch (timeStr) {
    case "24/7":
      result = { type: "24_7" };
      return result;

    default:
      try {
        const days = await parseOpeningHours(timeStr);
        result = { type: "weekly", days: days };
        return result;
      } catch (error) {
        return result;
      }
  }
}

async function parseOpeningHours(timeStr: string) {
  const days: Record<number, [string, string][]> = {};
  const oh = new opening_hours(timeStr);
  const start = new Date("2026-01-05");
  const end = new Date("2026-01-12");
  const arr = oh.getOpenIntervals(start, end);
  for (const [start, end] of arr) {
    const d = start.getDay();

    const open = toTimeStr(start);
    const close = toTimeStr(end);

    if (!days[d]) days[d] = [];
    days[d].push([open, close]);
  }
  return days;
}
