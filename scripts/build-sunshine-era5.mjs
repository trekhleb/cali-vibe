#!/usr/bin/env node
/**
 * Build California sunshine data as H3 hexagon GeoJSON files.
 *
 * Data source: Open-Meteo Historical Weather API (ERA5 reanalysis by ECMWF)
 * Period: 2014-2023 (10-year average -> monthly normals)
 * Metric: sunshine_duration (daily sunshine hours)
 *
 * Outputs:
 *   public/data/california-sunshine-h3-res4.geojson  (~200 hexagons, regional)
 *   public/data/california-sunshine-h3-res5.geojson  (~1500 hexagons, detailed)
 *
 * Usage: node scripts/build-sunshine-data.mjs
 */

import { writeFileSync, existsSync, readFileSync } from "fs";
import { cellToBoundary, cellToLatLng, polygonToCells } from "h3-js";

// ── Simplified California polygon (same as temperature script) ──
const CA_POLYGON = [
  [-124.41, 42.00], [-120.00, 42.00], [-119.99, 39.00],
  [-117.03, 39.00], [-114.63, 35.00], [-114.13, 34.26],
  [-114.57, 32.74], [-117.13, 32.53], [-117.25, 32.67],
  [-117.28, 33.05], [-118.08, 33.73], [-118.52, 34.03],
  [-119.15, 34.10], [-119.64, 34.42], [-120.47, 34.45],
  [-120.64, 34.58], [-120.63, 35.13], [-121.89, 36.31],
  [-121.93, 36.64], [-122.41, 37.19], [-122.51, 37.78],
  [-122.95, 38.03], [-123.73, 38.95], [-123.82, 39.35],
  [-124.33, 40.26], [-124.41, 42.00],
];

// ── Generate H3 cells for a given resolution ──
function generateCells(resolution) {
  const polygon = [CA_POLYGON];
  const cells = polygonToCells(polygon, resolution, true);
  console.log(`  H3 res ${resolution}: ${cells.length} cells`);
  return cells;
}

// ── Fetch daily sunshine from Open-Meteo (ERA5) for a single point ──
async function fetchDaily(lat, lng, retries = 3) {
  const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&start_date=2014-01-01&end_date=2023-12-31` +
    `&daily=sunshine_duration` +
    `&timezone=America%2FLos_Angeles`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        process.stdout.write("\u00b7");
        if (attempt === retries) return null;
        await sleep(30000 * attempt);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.daily) throw new Error("No daily data in response");
      return json;
    } catch (err) {
      if (attempt === retries) return null;
      await sleep(10000 * attempt);
    }
  }
}

// ── Compute monthly normals from daily sunshine_duration (seconds -> hours/day) ──
function computeNormals(data) {
  const daily = data.daily;
  if (!daily || !daily.time) return null;

  // 12 monthly buckets
  const buckets = Array.from({ length: 12 }, () => []);

  for (let i = 0; i < daily.time.length; i++) {
    const m = parseInt(daily.time[i].slice(5, 7), 10) - 1;
    const val = daily.sunshine_duration[i];
    if (val != null) {
      // Open-Meteo returns sunshine_duration in seconds — convert to hours
      buckets[m].push(val / 3600);
    }
  }

  const avg = (arr) =>
    arr.length ? +(arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1) : null;

  return {
    sunshine: buckets.map((b) => avg(b)),
  };
}

// ── Helpers ──
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function processSequentially(items, fn) {
  const results = [];
  for (let i = 0; i < items.length; i++) {
    results.push(await fn(items[i]));
    await sleep(3000);
  }
  return results;
}

// ── Build GeoJSON for one resolution ──
async function buildGeoJSON(resolution, cacheFile, outFile) {
  const cells = generateCells(resolution);

  let cache = {};
  if (existsSync(cacheFile)) {
    try {
      cache = JSON.parse(readFileSync(cacheFile, "utf-8"));
      console.log(`  Loaded ${Object.keys(cache).length} cached entries`);
    } catch { /* ignore */ }
  }

  let fetched = 0;
  let failed = 0;
  const toFetch = cells.filter((c) => !cache[c]);
  console.log(`  Need to fetch ${toFetch.length} / ${cells.length} cells`);

  await processSequentially(toFetch, async (cell) => {
    const [lat, lng] = cellToLatLng(cell);
    const data = await fetchDaily(lat, lng);
    if (data) {
      const normals = computeNormals(data);
      if (normals) {
        cache[cell] = normals;
      } else {
        failed++;
      }
    } else {
      failed++;
    }
    fetched++;
    if (fetched % 25 === 0 || fetched === toFetch.length) {
      console.log(`\n  Progress: ${fetched}/${toFetch.length} (${failed} failed)`);
      writeFileSync(cacheFile, JSON.stringify(cache));
      writeFileSync(outFile, JSON.stringify(cacheToGeoJSON(cells, cache)));
    }
  });

  // Retry pass
  const stillMissing = cells.filter((c) => !cache[c]);
  if (stillMissing.length > 0) {
    console.log(`\n  Retry pass: ${stillMissing.length} missing cells\u2026`);
    await processSequentially(stillMissing, async (cell) => {
      const [lat, lng] = cellToLatLng(cell);
      try {
        const data = await fetchDaily(lat, lng);
        const normals = computeNormals(data);
        if (normals) cache[cell] = normals;
      } catch { /* skip */ }
    });
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
  const outDir = new URL("../public/data/", import.meta.url).pathname;

  for (const res of [4, 5]) {
    console.log(`\nBuilding H3 resolution ${res}\u2026`);
    const cacheFile = `${outDir}/.sunshine-cache-res${res}.json`;
    const outFile = `${outDir}/california-sunshine-h3-res${res}.geojson`;
    const geojson = await buildGeoJSON(res, cacheFile, outFile);
    writeFileSync(outFile, JSON.stringify(geojson));
    const sizeMB = (Buffer.byteLength(JSON.stringify(geojson)) / 1024 / 1024).toFixed(2);
    console.log(`  \u2192 ${outFile} (${geojson.features.length} features, ${sizeMB} MB)`);
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
