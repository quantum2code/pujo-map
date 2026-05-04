import { db } from "..";
import { place } from "../schema";
import {
  getOpeningHrs,
  getOverpassData,
  OVERPASS_API_URL,
  resetTable,
} from "./seed";

//fetch data from different sources
// - Overpass api

let query = `
[out:json][timeout:25];

// Define area (Kolkata)
area["name"="Kolkata"]["boundary"="administrative"]->.searchArea;

// Get all restaurants
(
  node["amenity"~"restaurant|cafe|fast_food"](area.searchArea);
  way["amenity"~"restaurant|cafe|fast_food"](area.searchArea);
  relation["amenity"~"restaurant|cafe|fast_food"](area.searchArea);
);

// Output with geometry
out center;
`;

console.log("[seed:foods] fetching Overpass data");
const result = await getOverpassData(OVERPASS_API_URL, query);

if (!result) process.exit(1);

console.log("[seed:foods] Overpass response received ");

//combine

//cleanup

//pre-seed opts on db
console.log("[seed:foods] clearing place table");
await resetTable(db, place);

//seed
// insert fetched places into the place table
type PlaceInsert = typeof place.$inferInsert;

const elements: any[] = Array.isArray(result.elements) ? result.elements : [];
const records: PlaceInsert[] = [];

console.log(`[seed:foods] parsing ${elements.length} elements`);

for (const el of elements) {
  const tags = el?.tags ?? {};
  const center = el?.center ?? {};
  const lat = el?.lat ?? center?.lat ?? null;
  const lon = el?.lon ?? center?.lon ?? null;

  if (lat == null || lon == null) continue;

  const cuisineArr = tags.cuisine
    ? String(tags.cuisine)
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
    : null;

  records.push({
    id: `${el.type}/${el.id}`,
    name: tags.name ?? null,
    amenity: tags.amenity ?? null,
    cuisine: cuisineArr ?? null,
    openingHours: tags.opening_hours
      ? await getOpeningHrs(tags.opening_hours)
      : null,
    properties: el,
    location: [lon, lat],
  });
}

if (records.length > 0) {
  try {
    console.log(`[seed:foods] inserting ${records.length} records`);
    // insert in batches to avoid huge single query
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      console.log(
        `[seed:foods] inserting batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(records.length / batchSize)}`,
      );
      await db.insert(place).values(batch);
    }

    console.log("[seed:foods] seed complete");
    process.exit(0);
  } catch (err) {
    console.error("Failed to insert places:", err);
    process.exit(1);
  }
} else {
  console.log("[seed:foods] no records to insert");
  process.exit(0);
}
