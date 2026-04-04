#!/usr/bin/env node

/**
 * Downloads US Census TIGER/Line 2024 California "place" shapefile,
 * extracts Census-Designated Places (CDPs) with population >= 5 000,
 * and merges them into the existing city GeoJSON files.
 *
 * Adds a `placeType` property ("city" | "cdp") to every feature so the
 * UI can optionally distinguish them.
 *
 * Usage: node scripts/build-cdp-boundaries.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { open } from "shapefile";
import centroid from "@turf/centroid";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "public", "data");
const TMP_DIR = join(__dirname, "..", ".tmp-tiger");
const MIN_POPULATION = 5_000;

const TIGER_URL =
  "https://www2.census.gov/geo/tiger/TIGER2024/PLACE/tl_2024_06_place.zip";

const CENSUS_POP_URL =
  "https://api.census.gov/data/2023/acs/acs5?get=NAME,B01003_001E&for=place:*&in=state:06";

// CLASSFP values for CDPs
const CDP_CLASSFP = new Set(["U1", "U2", "U9"]);

// CLASSFP values for incorporated places (cities/towns) — already in our GeoJSON
const INCORPORATED_CLASSFP = new Set(["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9"]);

function normalizeCdpName(censusName) {
  return censusName
    .replace(/\s+(city|town|CDP),?\s+California$/i, "")
    .trim();
}

/** Round coordinate arrays to 6 decimal places (~0.1 m precision). */
function truncateCoords(coords) {
  if (typeof coords[0] === "number") {
    return [
      Math.round(coords[0] * 1e6) / 1e6,
      Math.round(coords[1] * 1e6) / 1e6,
    ];
  }
  return coords.map(truncateCoords);
}

/** Ensure geometry is MultiPolygon for consistency with existing data. */
function toMultiPolygon(geometry) {
  if (geometry.type === "Polygon") {
    return {
      type: "MultiPolygon",
      coordinates: truncateCoords([geometry.coordinates]),
    };
  }
  return {
    type: "MultiPolygon",
    coordinates: truncateCoords(geometry.coordinates),
  };
}

// ---------------------------------------------------------------------------
// 1. Download and unzip TIGER/Line shapefile
// ---------------------------------------------------------------------------
async function downloadTiger() {
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
  const zipPath = join(TMP_DIR, "tl_2024_06_place.zip");

  if (!existsSync(join(TMP_DIR, "tl_2024_06_place.shp"))) {
    console.log("Downloading TIGER/Line 2024 California places shapefile...");
    execSync(`curl -sL -o "${zipPath}" "${TIGER_URL}"`, { stdio: "inherit" });
    console.log("Unzipping...");
    execSync(`unzip -o "${zipPath}" -d "${TMP_DIR}"`, { stdio: "inherit" });
  } else {
    console.log("TIGER/Line shapefile already cached in .tmp-tiger/");
  }
}

// ---------------------------------------------------------------------------
// 2. Read CDPs from shapefile
// ---------------------------------------------------------------------------
async function readCdpsFromShapefile() {
  const shpPath = join(TMP_DIR, "tl_2024_06_place.shp");
  const dbfPath = join(TMP_DIR, "tl_2024_06_place.dbf");
  const source = await open(shpPath, dbfPath);

  const cdps = [];
  let totalPlaces = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await source.read();
    if (result.done) break;
    totalPlaces++;

    const props = result.value.properties;
    const classfp = props.CLASSFP;

    if (CDP_CLASSFP.has(classfp)) {
      cdps.push({
        name: props.NAME,
        nameLsad: props.NAMELSAD,
        geoid: props.GEOID,
        geometry: result.value.geometry,
      });
    }
  }

  console.log(`Read ${totalPlaces} total places, found ${cdps.length} CDPs`);
  return cdps;
}

// ---------------------------------------------------------------------------
// 3. Fetch Census population data
// ---------------------------------------------------------------------------
async function fetchPopulation() {
  console.log("Fetching Census ACS population data...");
  const res = await fetch(CENSUS_POP_URL);
  if (!res.ok)
    throw new Error(`Census API HTTP ${res.status}: ${await res.text()}`);
  const rows = await res.json();
  const [, ...data] = rows;

  const popMap = new Map();
  for (const row of data) {
    const name = normalizeCdpName(row[0]);
    const pop = row[1] && row[1] !== "-666666666" ? Number(row[1]) : 0;
    popMap.set(name, pop);
  }
  console.log(`  Population data for ${popMap.size} places`);
  return popMap;
}

// ---------------------------------------------------------------------------
// 4. Merge CDPs into existing GeoJSON
// ---------------------------------------------------------------------------
function mergeCdps(cdps, popMap) {
  // Read existing city GeoJSON files
  const polyPath = join(DATA_DIR, "california-cities.geojson");
  const labelPath = join(DATA_DIR, "california-city-labels.geojson");

  const polyGj = JSON.parse(readFileSync(polyPath, "utf-8"));
  const labelGj = JSON.parse(readFileSync(labelPath, "utf-8"));

  // Collect existing city names to detect collisions
  const existingNames = new Set(
    polyGj.features.map((f) => f.properties.name)
  );

  // Add placeType to existing features
  for (const feat of polyGj.features) {
    feat.properties.placeType = "city";
  }
  for (const feat of labelGj.features) {
    feat.properties.placeType = "city";
  }

  let added = 0;
  let skippedPop = 0;
  let skippedCollision = 0;
  let skippedNoMatch = 0;

  for (const cdp of cdps) {
    const name = cdp.name;
    const pop = popMap.get(name);

    if (pop == null) {
      skippedNoMatch++;
      continue;
    }
    if (pop < MIN_POPULATION) {
      skippedPop++;
      continue;
    }
    if (existingNames.has(name)) {
      console.warn(`  ⚠ Name collision: "${name}" already exists as a city — skipping CDP`);
      skippedCollision++;
      continue;
    }

    // Build polygon feature
    const polyFeature = {
      type: "Feature",
      properties: {
        name,
        population: pop,
        placeType: "cdp",
      },
      geometry: toMultiPolygon(cdp.geometry),
    };
    polyGj.features.push(polyFeature);

    // Build label (centroid) feature
    const center = centroid(polyFeature);
    const labelFeature = {
      type: "Feature",
      properties: {
        name,
        population: pop,
        placeType: "cdp",
      },
      geometry: {
        type: "Point",
        coordinates: [
          Math.round(center.geometry.coordinates[0] * 1e6) / 1e6,
          Math.round(center.geometry.coordinates[1] * 1e6) / 1e6,
        ],
      },
    };
    labelGj.features.push(labelFeature);

    added++;
  }

  console.log(`\nCDP merge results:`);
  console.log(`  ✓ Added: ${added}`);
  console.log(`  ✗ Below pop threshold: ${skippedPop}`);
  console.log(`  ✗ Name collision: ${skippedCollision}`);
  console.log(`  ✗ No Census match: ${skippedNoMatch}`);
  console.log(`  Total features: ${polyGj.features.length}`);

  writeFileSync(polyPath, JSON.stringify(polyGj));
  console.log(`  Wrote ${polyPath}`);

  writeFileSync(labelPath, JSON.stringify(labelGj));
  console.log(`  Wrote ${labelPath}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  await downloadTiger();
  const cdps = await readCdpsFromShapefile();
  const popMap = await fetchPopulation();
  mergeCdps(cdps, popMap);
  console.log("\nDone! Now re-run data build scripts to backfill metrics.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
