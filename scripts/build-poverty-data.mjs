#!/usr/bin/env node

/**
 * Fetches Census Bureau ACS 5-year (2019-2023) poverty data
 * for California counties and cities, computes poverty rate, and injects
 * a "poverty" property (number, %) into the existing GeoJSON files.
 *
 * Table B17001 — Poverty Status in the Past 12 Months by Sex by Age
 *
 * Metric computed:
 *   poverty — % of population with income below poverty level
 *
 * Usage: node scripts/build-poverty-data.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "public", "data");

// B17001 fields:
// _001E  Total (population for whom poverty status is determined)
// _002E  Income in the past 12 months below poverty level
const FIELDS = "B17001_001E,B17001_002E";

const COUNTY_URL =
  `https://api.census.gov/data/2023/acs/acs5?get=NAME,${FIELDS}&for=county:*&in=state:06`;

const CITY_URL =
  `https://api.census.gov/data/2023/acs/acs5?get=NAME,${FIELDS}&for=place:*&in=state:06`;

function normalizeCountyName(censusName) {
  return censusName.replace(/ County,? California$/i, "").replace(/ County$/i, "").trim();
}

function normalizeCityName(censusName) {
  return censusName.replace(/\s+(city|town|CDP),?\s+California$/i, "").trim();
}

function parseRow(row) {
  const [, totalRaw, belowRaw] = row;
  const parse = (v) => v && v !== "-666666666" ? Number(v) : null;
  const total = parse(totalRaw);
  const below = parse(belowRaw);
  if (!total || total === 0 || below === null) return null;

  return Math.round(below / total * 1000) / 10;
}

async function fetchData(url, normalizeName, label) {
  console.log(`Fetching Census ACS poverty data (${label})...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Census API HTTP ${res.status}: ${await res.text()}`);
  const rows = await res.json();

  const [header, ...data] = rows;
  console.log(`  Received ${data.length} ${label} (header: ${header.join(", ")})`);

  const byName = new Map();
  for (const row of data) {
    const name = normalizeName(row[0]);
    const poverty = parseRow(row);
    if (poverty !== null) byName.set(name, poverty);
  }
  console.log(`  Computed poverty rate for ${byName.size} ${label}`);
  return byName;
}

function injectPovertyData(geojsonPath, povertyMap) {
  console.log(`Injecting poverty data into ${geojsonPath}...`);
  const gj = JSON.parse(readFileSync(geojsonPath, "utf-8"));
  let matched = 0;
  let missed = 0;

  for (const feat of gj.features) {
    const name = feat.properties.name;
    const poverty = povertyMap.get(name);
    if (poverty !== undefined) {
      feat.properties.poverty = poverty;
      matched++;
    } else {
      console.warn(`  ⚠ No poverty data for: ${name}`);
      missed++;
    }
  }

  writeFileSync(geojsonPath, JSON.stringify(gj));
  console.log(`  ✓ ${matched} matched, ${missed} missed`);
}

async function main() {
  const countyMap = await fetchData(COUNTY_URL, normalizeCountyName, "counties");
  injectPovertyData(join(DATA_DIR, "california-counties.geojson"), countyMap);
  injectPovertyData(join(DATA_DIR, "california-county-labels.geojson"), countyMap);

  const cityMap = await fetchData(CITY_URL, normalizeCityName, "cities");
  injectPovertyData(join(DATA_DIR, "california-cities.geojson"), cityMap);
  injectPovertyData(join(DATA_DIR, "california-city-labels.geojson"), cityMap);

  console.log("Done!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
