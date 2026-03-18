#!/usr/bin/env node
/**
 * Build California sunshine data as H3 hexagon GeoJSON files.
 *
 * Data source: NREL NSRDB GOES TMY v4 (satellite-derived, 4km resolution)
 * Dataset: Typical Meteorological Year (pre-averaged synthetic year)
 * Metric: DNI > 120 W/m² → sunshine hours (WMO standard)
 *
 * Outputs:
 *   public/data/california-sunshine-h3-res4.geojson  (~250 hexagons, regional)
 *   public/data/california-sunshine-h3-res5.geojson  (~1750 hexagons, detailed)
 *
 * Env vars:
 *   NREL_API_KEY  — free key from https://developer.nrel.gov/signup/
 *   NREL_EMAIL    — email used when signing up
 *
 * Usage: node scripts/build-sunshine-nsrdb.mjs
 */

import { writeFileSync, existsSync, readFileSync } from "fs";
import { cellToBoundary, cellToLatLng, polygonToCells } from "h3-js";

// ── Config ──────────────────────────────────────────────────────────────
const NREL_API_KEY = process.env.NREL_API_KEY;
const NREL_EMAIL = process.env.NREL_EMAIL;
if (!NREL_API_KEY || !NREL_EMAIL) {
  console.error("Error: Set NREL_API_KEY and NREL_EMAIL environment variables.");
  console.error("Get a free key at: https://developer.nrel.gov/signup/");
  process.exit(1);
}

const WMO_THRESHOLD = 120; // W/m² — WMO sunshine threshold for DNI
const REQUEST_DELAY = 2000; // ms — NSRDB allows 1 req/sec, using 2s to be safe
const RETRY_DELAY = 15000; // ms — wait on rate limit
const SAVE_EVERY = 25; // save cache every N fetches

// ── Simplified California polygon ──
// Expanded ~0.3° into the ocean so coastal H3 hexagons are included
const CA_POLYGON = [
  [-124.80, 42.10], [-120.00, 42.00], [-119.99, 39.00],
  [-117.03, 39.00], [-114.63, 35.00], [-114.13, 34.26],
  [-114.57, 32.74], [-117.13, 32.30], [-117.50, 32.50],
  [-117.60, 33.00], [-118.40, 33.60], [-118.90, 33.90],
  [-119.50, 33.90], [-120.00, 34.20], [-120.80, 34.30],
  [-121.00, 34.40], [-121.00, 35.00], [-122.20, 36.20],
  [-122.30, 36.50], [-122.80, 37.00], [-122.90, 37.60],
  [-123.30, 37.90], [-124.10, 38.80], [-124.20, 39.20],
  [-124.70, 40.10], [-124.80, 42.10],
];

// ── Generate H3 cells ──
function generateCells(resolution) {
  const cells = polygonToCells([CA_POLYGON], resolution, true);
  console.log(`  H3 res ${resolution}: ${cells.length} cells`);
  return cells;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Fetch TMY CSV from NSRDB ────────────────────────────────────────────
async function fetchTMY(lat, lng, retries = 3) {
  const url =
    `https://developer.nrel.gov/api/nsrdb/v2/solar/nsrdb-GOES-tmy-v4-0-0-download.csv` +
    `?api_key=${NREL_API_KEY}` +
    `&wkt=POINT(${lng}%20${lat})` +
    `&names=tmy` +
    `&attributes=dni` +
    `&utc=false` +
    `&interval=60` +
    `&email=${NREL_EMAIL}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        process.stdout.write("·");
        if (attempt === retries) return null;
        await sleep(RETRY_DELAY * attempt);
        continue;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      return await res.text();
    } catch (err) {
      if (attempt === retries) {
        process.stdout.write("✗");
        return null;
      }
      await sleep(RETRY_DELAY * attempt);
    }
  }
  return null;
}

// ── Parse NSRDB TMY CSV → monthly avg sunshine hours/day ────────────────
function parseTMY(csv) {
  const lines = csv.trim().split("\n");

  // Find the header row (starts with "Year,")
  let headerIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    if (lines[i].startsWith("Year,")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return null;

  const headers = lines[headerIdx].split(",");
  const monthCol = headers.indexOf("Month");
  const dayCol = headers.indexOf("Day");
  const dniCol = headers.indexOf("DNI");
  if (dniCol === -1 || monthCol === -1 || dayCol === -1) return null;

  // Count sunshine hours and days per month
  const monthSunshineHours = Array(12).fill(0);
  const monthDays = Array.from({ length: 12 }, () => new Set());

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length <= Math.max(monthCol, dayCol, dniCol)) continue;

    const month = parseInt(cols[monthCol], 10) - 1;
    const day = parseInt(cols[dayCol], 10);
    const dni = parseFloat(cols[dniCol]);

    if (isNaN(month) || month < 0 || month > 11) continue;
    if (isNaN(dni)) continue;

    monthDays[month].add(day);
    if (dni > WMO_THRESHOLD) {
      monthSunshineHours[month]++;
    }
  }

  // Convert total hours → average hours/day
  const sunshine = monthSunshineHours.map((totalHours, m) => {
    const days = monthDays[m].size || 30;
    return +(totalHours / days).toFixed(1);
  });

  return { sunshine };
}

// ── Build GeoJSON for one resolution ────────────────────────────────────
async function buildGeoJSON(resolution, cacheFile, outFile) {
  const cells = generateCells(resolution);

  let cache = {};
  if (existsSync(cacheFile)) {
    try {
      cache = JSON.parse(readFileSync(cacheFile, "utf-8"));
      console.log(`  Loaded ${Object.keys(cache).length} cached entries from cache file`);
    } catch { /* ignore */ }
  }
  // Seed cache from existing GeoJSON output if cache is empty
  if (Object.keys(cache).length === 0 && existsSync(outFile)) {
    try {
      const geojson = JSON.parse(readFileSync(outFile, "utf-8"));
      for (const f of geojson.features) {
        const h3 = f.properties.h3;
        const { h3: _, ...data } = f.properties;
        cache[h3] = data;
      }
      console.log(`  Seeded ${Object.keys(cache).length} entries from existing GeoJSON`);
    } catch { /* ignore */ }
  }

  let fetched = 0;
  let failed = 0;
  const toFetch = cells.filter((c) => !cache[c]);
  console.log(`  Need to fetch ${toFetch.length} / ${cells.length} cells`);

  for (const cell of toFetch) {
    const [lat, lng] = cellToLatLng(cell);
    const csv = await fetchTMY(lat, lng);
    if (csv) {
      const normals = parseTMY(csv);
      if (normals) {
        cache[cell] = normals;
      } else {
        failed++;
      }
    } else {
      failed++;
    }
    fetched++;
    if (fetched % SAVE_EVERY === 0 || fetched === toFetch.length) {
      console.log(`\n  Progress: ${fetched}/${toFetch.length} (${failed} failed)`);
      writeFileSync(cacheFile, JSON.stringify(cache));
      writeFileSync(outFile, JSON.stringify(cacheToGeoJSON(cells, cache)));
    }
    await sleep(REQUEST_DELAY);
  }

  // Retry pass for failed cells
  const stillMissing = cells.filter((c) => !cache[c]);
  if (stillMissing.length > 0) {
    console.log(`\n  Retry pass: ${stillMissing.length} missing cells…`);
    for (const cell of stillMissing) {
      const [lat, lng] = cellToLatLng(cell);
      const csv = await fetchTMY(lat, lng);
      if (csv) {
        const normals = parseTMY(csv);
        if (normals) cache[cell] = normals;
      }
      await sleep(REQUEST_DELAY * 2); // slower on retry
    }
    writeFileSync(cacheFile, JSON.stringify(cache));
  }

  writeFileSync(cacheFile, JSON.stringify(cache));
  return cacheToGeoJSON(cells, cache);
}

function cacheToGeoJSON(cells, cache) {
  const features = [];
  for (const cell of cells) {
    const normals = cache[cell];
    if (!normals) continue;

    const boundary = cellToBoundary(cell);
    const coords = boundary.map(([lat, lng]) => [
      +lng.toFixed(5),
      +lat.toFixed(5),
    ]);
    coords.push(coords[0]);

    features.push({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [coords] },
      properties: {
        h3: cell,
        sunshine: normals.sunshine,
      },
    });
  }

  return { type: "FeatureCollection", features };
}

// ── Main ──
async function main() {
  console.log("Building sunshine data from NREL NSRDB (satellite, 4km)");
  console.log("TMY dataset — pre-averaged Typical Meteorological Year\n");

  const outDir = new URL("../public/data/", import.meta.url).pathname;

  for (const res of [4, 5]) {
    console.log(`Building H3 resolution ${res}…`);
    const cacheFile = `${outDir}/.sunshine-nsrdb-cache-res${res}.json`;
    const outFile = `${outDir}/california-sunshine-nsrdb-h3-res${res}.geojson`;
    const geojson = await buildGeoJSON(res, cacheFile, outFile);
    writeFileSync(outFile, JSON.stringify(geojson));
    const sizeMB = (Buffer.byteLength(JSON.stringify(geojson)) / 1024 / 1024).toFixed(2);
    console.log(`  → ${outFile} (${geojson.features.length} features, ${sizeMB} MB)`);
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
