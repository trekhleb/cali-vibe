#!/usr/bin/env node

/**
 * Fetches Census Bureau ACS 5-year (2019-2023) housing data for California cities
 * and injects a "housing" property into the existing city GeoJSON files.
 *
 * Tables used:
 *   B25077_001E  — Median Home Value (owner-occupied units)
 *   B25064_001E  — Median Gross Rent
 *   B19013_001E  — Median Household Income
 *
 * Usage: node scripts/build-city-housing-data.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "public", "data");

const CENSUS_URL =
  "https://api.census.gov/data/2023/acs/acs5?get=NAME,B25077_001E,B25064_001E,B19013_001E&for=place:*&in=state:06";

// Census returns "Clovis city, California" → "Clovis"
function normalizeCityName(censusName) {
  return censusName
    .replace(/\s+(city|town|CDP),?\s+California$/i, "")
    .trim();
}

async function fetchHousingData() {
  console.log("Fetching Census ACS 5-year city housing data...");
  const res = await fetch(CENSUS_URL);
  if (!res.ok) throw new Error(`Census API HTTP ${res.status}: ${await res.text()}`);
  const rows = await res.json();

  const [header, ...data] = rows;
  console.log(`  Received ${data.length} places (header: ${header.join(", ")})`);

  const byName = new Map();
  for (const row of data) {
    const [name, homeValueRaw, rentRaw, incomeRaw] = row;
    const cityName = normalizeCityName(name);
    const parse = (v) => v && v !== "-666666666" ? Number(v) : null;
    const homeValue = parse(homeValueRaw);
    const rent = parse(rentRaw);
    const income = parse(incomeRaw);
    byName.set(cityName, { homeValue, rent, income });
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

  // Inject into city polygons
  injectHousingData(join(DATA_DIR, "california-cities.geojson"), housingMap);

  // Inject into city labels (used for map labels)
  injectHousingData(join(DATA_DIR, "california-city-labels.geojson"), housingMap);

  console.log("Done!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
