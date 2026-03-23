#!/usr/bin/env node

/**
 * Fetches Census Bureau ACS 5-year (2019-2023) housing data for California counties
 * and injects a "housing" property into the existing county GeoJSON files.
 *
 * Tables used:
 *   B25077_001E  — Median Home Value (owner-occupied units)
 *   B25064_001E  — Median Gross Rent
 *
 * Usage: node scripts/build-housing-data.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "public", "data");

const CENSUS_URL =
  "https://api.census.gov/data/2023/acs/acs5?get=NAME,B25077_001E,B25064_001E&for=county:*&in=state:06";

// County name normalization: Census returns "Alameda County, California" → "Alameda"
function normalizeCountyName(censusName) {
  return censusName.replace(/ County,? California$/i, "").replace(/ County$/i, "").trim();
}

async function fetchHousingData() {
  console.log("Fetching Census ACS 5-year housing data...");
  const res = await fetch(CENSUS_URL);
  if (!res.ok) throw new Error(`Census API HTTP ${res.status}: ${await res.text()}`);
  const rows = await res.json();

  // First row is the header: ["NAME","B25077_001E","B25064_001E","state","county"]
  const [header, ...data] = rows;
  console.log(`  Received ${data.length} counties (header: ${header.join(", ")})`);

  const byName = new Map();
  for (const row of data) {
    const [name, homeValueRaw, rentRaw] = row;
    const countyName = normalizeCountyName(name);
    const homeValue = homeValueRaw && homeValueRaw !== "-666666666" ? Number(homeValueRaw) : null;
    const rent = rentRaw && rentRaw !== "-666666666" ? Number(rentRaw) : null;
    byName.set(countyName, { homeValue, rent });
  }
  return byName;
}

function injectHousingData(geojsonPath, housingMap) {
  console.log(`Injecting housing data into ${geojsonPath}...`);
  const gj = JSON.parse(readFileSync(geojsonPath, "utf-8"));
  let matched = 0;
  let missed = 0;

  for (const feat of gj.features) {
    const name = feat.properties.name;
    const housing = housingMap.get(name);
    if (housing) {
      feat.properties.housing = housing;
      matched++;
    } else {
      console.warn(`  ⚠ No housing data for: ${name}`);
      missed++;
    }
  }

  writeFileSync(geojsonPath, JSON.stringify(gj));
  console.log(`  ✓ ${matched} matched, ${missed} missed`);
}

async function main() {
  const housingMap = await fetchHousingData();

  // Inject into county polygons
  injectHousingData(join(DATA_DIR, "california-counties.geojson"), housingMap);

  // Inject into county labels (used for map labels)
  injectHousingData(join(DATA_DIR, "california-county-labels.geojson"), housingMap);

  console.log("Done!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
