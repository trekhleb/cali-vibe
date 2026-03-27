#!/usr/bin/env node

/**
 * Fetches Census Bureau ACS 5-year (2019-2023) race/ethnicity data
 * for California counties and cities, computes percentage metrics, and injects
 * a "race" property into the existing GeoJSON files.
 *
 * Table B03002 — Hispanic or Latino Origin by Race
 *
 * Metrics computed (all as % of total population):
 *   white    — White alone, not Hispanic or Latino
 *   hispanic — Hispanic or Latino (any race)
 *   black    — Black or African American alone, not Hispanic or Latino
 *   asian    — Asian alone, not Hispanic or Latino
 *   other    — AIAN + NHPI + Some Other Race + Two or More Races (not Hispanic or Latino)
 *
 * Usage: node scripts/build-race-data.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "public", "data");

// B03002 fields:
// _001E  Total
// _003E  Not Hispanic — White alone
// _004E  Not Hispanic — Black or African American alone
// _005E  Not Hispanic — American Indian and Alaska Native alone
// _006E  Not Hispanic — Asian alone
// _007E  Not Hispanic — Native Hawaiian and Other Pacific Islander alone
// _008E  Not Hispanic — Some other race alone
// _009E  Not Hispanic — Two or more races
// _012E  Hispanic or Latino
const FIELDS = "B03002_001E,B03002_003E,B03002_004E,B03002_005E,B03002_006E,B03002_007E,B03002_008E,B03002_009E,B03002_012E";

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
  const [, totalRaw, whiteRaw, blackRaw, aianRaw, asianRaw, nhpiRaw, otherRaw, twoRaw, hispanicRaw] = row;
  const parse = (v) => v && v !== "-666666666" ? Number(v) : null;
  const total = parse(totalRaw);
  if (!total || total === 0) return null;

  const white = parse(whiteRaw) ?? 0;
  const black = parse(blackRaw) ?? 0;
  const aian = parse(aianRaw) ?? 0;
  const asian = parse(asianRaw) ?? 0;
  const nhpi = parse(nhpiRaw) ?? 0;
  const someOther = parse(otherRaw) ?? 0;
  const twoPlus = parse(twoRaw) ?? 0;
  const hispanic = parse(hispanicRaw) ?? 0;

  const other = aian + nhpi + someOther + twoPlus;

  return {
    white: Math.round(white / total * 1000) / 10,
    hispanic: Math.round(hispanic / total * 1000) / 10,
    black: Math.round(black / total * 1000) / 10,
    asian: Math.round(asian / total * 1000) / 10,
    other: Math.round(other / total * 1000) / 10,
  };
}

async function fetchData(url, normalizeName, label) {
  console.log(`Fetching Census ACS race/ethnicity data (${label})...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Census API HTTP ${res.status}: ${await res.text()}`);
  const rows = await res.json();

  const [header, ...data] = rows;
  console.log(`  Received ${data.length} ${label} (header: ${header.slice(0, 5).join(", ")}...)`);

  const byName = new Map();
  for (const row of data) {
    const name = normalizeName(row[0]);
    const race = parseRow(row);
    if (race) byName.set(name, race);
  }
  console.log(`  Computed race/ethnicity metrics for ${byName.size} ${label}`);
  return byName;
}

function injectRaceData(geojsonPath, raceMap) {
  console.log(`Injecting race/ethnicity data into ${geojsonPath}...`);
  const gj = JSON.parse(readFileSync(geojsonPath, "utf-8"));
  let matched = 0;
  let missed = 0;

  for (const feat of gj.features) {
    const name = feat.properties.name;
    const race = raceMap.get(name);
    if (race) {
      feat.properties.race = race;
      matched++;
    } else {
      console.warn(`  ⚠ No race data for: ${name}`);
      missed++;
    }
  }

  writeFileSync(geojsonPath, JSON.stringify(gj));
  console.log(`  ✓ ${matched} matched, ${missed} missed`);
}

async function main() {
  const countyMap = await fetchData(COUNTY_URL, normalizeCountyName, "counties");
  injectRaceData(join(DATA_DIR, "california-counties.geojson"), countyMap);
  injectRaceData(join(DATA_DIR, "california-county-labels.geojson"), countyMap);

  const cityMap = await fetchData(CITY_URL, normalizeCityName, "cities");
  injectRaceData(join(DATA_DIR, "california-cities.geojson"), cityMap);
  injectRaceData(join(DATA_DIR, "california-city-labels.geojson"), cityMap);

  console.log("Done!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
