#!/usr/bin/env node

/**
 * Fetches Census Bureau ACS 5-year (2019-2023) age distribution data
 * for California counties and cities, computes percentage metrics, and injects
 * an "age" property into the existing GeoJSON files.
 *
 * Table B01001 — Sex by Age
 *
 * Metrics computed (all as % of total population):
 *   under18  — Under 18 years
 *   age18_34 — 18 to 34 years
 *   age35_64 — 35 to 64 years
 *   age65plus — 65 years and over
 *   medianAge — Median age (from B01002_001E)
 *
 * Usage: node scripts/build-age-data.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "public", "data");

// B01001 fields (Sex by Age):
// _001E  Total
// Male age groups:
// _003E  Under 5 years
// _004E  5 to 9 years
// _005E  10 to 14 years
// _006E  15 to 17 years
// _007E  18 and 19 years
// _008E  20 years
// _009E  21 years
// _010E  22 to 24 years
// _011E  25 to 29 years
// _012E  30 to 34 years
// _013E  35 to 39 years
// _014E  40 to 44 years
// _015E  45 to 49 years
// _016E  50 to 54 years
// _017E  55 to 59 years
// _018E  60 and 61 years
// _019E  62 to 64 years
// _020E  65 and 66 years
// _021E  67 to 69 years
// _022E  70 to 74 years
// _023E  75 to 79 years
// _024E  80 to 84 years
// _025E  85 years and over
// Female age groups: _027E through _049E (same breakdown)

// We need all the detail fields to aggregate into our 4 groups
const MALE_FIELDS = "B01001_003E,B01001_004E,B01001_005E,B01001_006E,B01001_007E,B01001_008E,B01001_009E,B01001_010E,B01001_011E,B01001_012E,B01001_013E,B01001_014E,B01001_015E,B01001_016E,B01001_017E,B01001_018E,B01001_019E,B01001_020E,B01001_021E,B01001_022E,B01001_023E,B01001_024E,B01001_025E";
const FEMALE_FIELDS = "B01001_027E,B01001_028E,B01001_029E,B01001_030E,B01001_031E,B01001_032E,B01001_033E,B01001_034E,B01001_035E,B01001_036E,B01001_037E,B01001_038E,B01001_039E,B01001_040E,B01001_041E,B01001_042E,B01001_043E,B01001_044E,B01001_045E,B01001_046E,B01001_047E,B01001_048E,B01001_049E";
const FIELDS = `B01001_001E,${MALE_FIELDS},${FEMALE_FIELDS},B01002_001E`;

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
  // row[0] = NAME
  // row[1] = B01001_001E (total)
  // row[2..24] = male age groups (23 fields)
  // row[25..47] = female age groups (23 fields)
  // row[48] = B01002_001E (median age)
  const parse = (v) => v && v !== "-666666666" ? Number(v) : null;
  const total = parse(row[1]);
  if (!total || total === 0) return null;

  // Male fields are at indices 2-24, female at 25-47
  // Under 18: Under 5 + 5-9 + 10-14 + 15-17 (indices 0-3 in each group)
  // 18-34: 18-19 + 20 + 21 + 22-24 + 25-29 + 30-34 (indices 4-9)
  // 35-64: 35-39 + 40-44 + 45-49 + 50-54 + 55-59 + 60-61 + 62-64 (indices 10-16)
  // 65+: 65-66 + 67-69 + 70-74 + 75-79 + 80-84 + 85+ (indices 17-22)

  function sumGroup(baseOffset, groupIndices) {
    let sum = 0;
    for (const i of groupIndices) {
      sum += parse(row[baseOffset + i]) ?? 0;
    }
    return sum;
  }

  const under18Indices = [0, 1, 2, 3];
  const age18_34Indices = [4, 5, 6, 7, 8, 9];
  const age35_64Indices = [10, 11, 12, 13, 14, 15, 16];
  const age65plusIndices = [17, 18, 19, 20, 21, 22];

  const maleBase = 2;   // row[2] is first male field
  const femaleBase = 25; // row[25] is first female field

  const under18 = sumGroup(maleBase, under18Indices) + sumGroup(femaleBase, under18Indices);
  const age18_34 = sumGroup(maleBase, age18_34Indices) + sumGroup(femaleBase, age18_34Indices);
  const age35_64 = sumGroup(maleBase, age35_64Indices) + sumGroup(femaleBase, age35_64Indices);
  const age65plus = sumGroup(maleBase, age65plusIndices) + sumGroup(femaleBase, age65plusIndices);

  const medianAge = parse(row[48]);

  return {
    under18: Math.round(under18 / total * 1000) / 10,
    age18_34: Math.round(age18_34 / total * 1000) / 10,
    age35_64: Math.round(age35_64 / total * 1000) / 10,
    age65plus: Math.round(age65plus / total * 1000) / 10,
    medianAge: medianAge !== null ? Math.round(medianAge * 10) / 10 : null,
  };
}

async function fetchData(url, normalizeName, label) {
  console.log(`Fetching Census ACS age distribution data (${label})...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Census API HTTP ${res.status}: ${await res.text()}`);
  const rows = await res.json();

  const [header, ...data] = rows;
  console.log(`  Received ${data.length} ${label} (header: ${header.slice(0, 5).join(", ")}...)`);

  const byName = new Map();
  for (const row of data) {
    const name = normalizeName(row[0]);
    const age = parseRow(row);
    if (age) byName.set(name, age);
  }
  console.log(`  Computed age distribution metrics for ${byName.size} ${label}`);

  // Validate: check percentages sum to ~100 for a few entries
  let checked = 0;
  for (const [name, age] of byName) {
    if (checked >= 5) break;
    const sum = age.under18 + age.age18_34 + age.age35_64 + age.age65plus;
    if (Math.abs(sum - 100) > 1) {
      console.warn(`  ⚠ ${name}: age groups sum to ${sum.toFixed(1)}% (expected ~100%)`);
    }
    checked++;
  }

  return byName;
}

function injectAgeData(geojsonPath, ageMap) {
  console.log(`Injecting age distribution data into ${geojsonPath}...`);
  const gj = JSON.parse(readFileSync(geojsonPath, "utf-8"));
  let matched = 0;
  let missed = 0;

  for (const feat of gj.features) {
    const name = feat.properties.name;
    const age = ageMap.get(name);
    if (age) {
      feat.properties.age = age;
      matched++;
    } else {
      console.warn(`  ⚠ No age data for: ${name}`);
      missed++;
    }
  }

  writeFileSync(geojsonPath, JSON.stringify(gj));
  console.log(`  ✓ ${matched} matched, ${missed} missed`);
}

async function main() {
  const countyMap = await fetchData(COUNTY_URL, normalizeCountyName, "counties");
  injectAgeData(join(DATA_DIR, "california-counties.geojson"), countyMap);
  injectAgeData(join(DATA_DIR, "california-county-labels.geojson"), countyMap);

  const cityMap = await fetchData(CITY_URL, normalizeCityName, "cities");
  injectAgeData(join(DATA_DIR, "california-cities.geojson"), cityMap);
  injectAgeData(join(DATA_DIR, "california-city-labels.geojson"), cityMap);

  console.log("Done!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
