#!/usr/bin/env node
/**
 * Build California temperature data as H3 hexagon GeoJSON files.
 *
 * Data source: Open-Meteo Historical Weather API (ERA5 reanalysis by ECMWF)
 * Period: 2014-2023 (10-year average → monthly normals)
 * Metrics: temperature_2m_max (day high), temperature_2m_min (night low), temperature_2m_mean (average)
 *
 * Outputs:
 *   public/data/california-temperature-h3-res4.geojson  (~200 hexagons, regional)
 *   public/data/california-temperature-h3-res5.geojson  (~1500 hexagons, detailed)
 *
 * Usage: node scripts/build-temperature-data.mjs
 */

import { writeFileSync, existsSync, readFileSync } from "fs";
import { cellToBoundary, cellToLatLng, polygonToCells } from "h3-js";

// ── Simplified California polygon (GeoJSON winding: CCW outer ring) ──
// Rough outline covering the state land area
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
  // h3-js polygonToCells expects [[[lng,lat],...]] in GeoJSON mode
  const polygon = [CA_POLYGON];
  const cells = polygonToCells(polygon, resolution, true);
  console.log(`  H3 res ${resolution}: ${cells.length} cells`);
  return cells;
}

// ── Fetch daily temperature from Open-Meteo (ERA5) for a single point ──
async function fetchDaily(lat, lng, retries = 3) {
  const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&start_date=2014-01-01&end_date=2023-12-31` +
    `&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean` +
    `&timezone=America%2FLos_Angeles`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        process.stdout.write("·");
        if (attempt === retries) return null; // skip, don't burn quota
        await sleep(30000 * attempt); // 30s, 60s backoff
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.daily) throw new Error("No daily data in response");
      return json;
    } catch (err) {
      if (attempt === retries) return null; // skip cell
      await sleep(10000 * attempt);
    }
  }
}

// ── Compute monthly normals from daily arrays ──
function computeNormals(data) {
  const daily = data.daily;
  if (!daily || !daily.time) return null;

  // Buckets: 12 months × 3 metrics
  const buckets = Array.from({ length: 12 }, () => ({
    tmin: [], tmax: [], tavg: [],
  }));

  for (let i = 0; i < daily.time.length; i++) {
    const m = parseInt(daily.time[i].slice(5, 7), 10) - 1; // 0-based month
    if (daily.temperature_2m_min[i] != null) buckets[m].tmin.push(daily.temperature_2m_min[i]);
    if (daily.temperature_2m_max[i] != null) buckets[m].tmax.push(daily.temperature_2m_max[i]);
    if (daily.temperature_2m_mean[i] != null) buckets[m].tavg.push(daily.temperature_2m_mean[i]);
  }

  const avg = (arr) => arr.length ? +(arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1) : null;

  return {
    tmin: buckets.map((b) => avg(b.tmin)),
    tmax: buckets.map((b) => avg(b.tmax)),
    tavg: buckets.map((b) => avg(b.tavg)),
  };
}

// ── Helpers ──
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function processSequentially(items, fn) {
  const results = [];
  for (let i = 0; i < items.length; i++) {
    results.push(await fn(items[i]));
    // Small delay between requests to respect rate limits
    await sleep(3000);
  }
  return results;
}

// ── Build GeoJSON for one resolution ──
async function buildGeoJSON(resolution, cacheFile, outFile) {
  const cells = generateCells(resolution);

  // Check for cached data to resume
  let cache = {};
  if (existsSync(cacheFile)) {
    try {
      cache = JSON.parse(readFileSync(cacheFile, "utf-8"));
      console.log(`  Loaded ${Object.keys(cache).length} cached entries`);
    } catch { /* ignore */ }
  }

  // Fetch missing data
  let fetched = 0;
  let failed = 0;
  const total = cells.length;
  const toFetch = cells.filter((c) => !cache[c]);
  console.log(`  Need to fetch ${toFetch.length} / ${total} cells`);

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

  // Retry pass for any cells still missing
  const stillMissing = cells.filter((c) => !cache[c]);
  if (stillMissing.length > 0) {
    console.log(`\n  Retry pass: ${stillMissing.length} missing cells…`);
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

  // Save final cache
  writeFileSync(cacheFile, JSON.stringify(cache));

  // Build GeoJSON from cache
  return cacheToGeoJSON(cells, cache);
}

function cacheToGeoJSON(cells, cache) {
  const features = [];
  for (const cell of cells) {
    const normals = cache[cell];
    if (!normals) continue;

    const boundary = cellToBoundary(cell); // [[lat,lng], ...]
    // Convert to GeoJSON [lng,lat] and close the ring
    const coords = boundary.map(([lat, lng]) => [
      +lng.toFixed(5),
      +lat.toFixed(5),
    ]);
    coords.push(coords[0]); // close ring

    features.push({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [coords] },
      properties: {
        h3: cell,
        tmin: normals.tmin,
        tmax: normals.tmax,
        tavg: normals.tavg,
      },
    });
  }

  return { type: "FeatureCollection", features };
}

// ── Main ──
async function main() {
  const outDir = new URL("../public/data/", import.meta.url).pathname;

  for (const res of [4, 5]) {
    console.log(`\nBuilding H3 resolution ${res}…`);
    const cacheFile = `${outDir}/.temp-cache-res${res}.json`;
    const outFile = `${outDir}/california-temperature-h3-res${res}.geojson`;
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
