#!/usr/bin/env node

/**
 * Fetches Census Bureau ACS 5-year (2019-2023) educational attainment data
 * for California counties and cities, computes percentage metrics, and injects
 * an "education" property into the existing GeoJSON files.
 *
 * Table B15003 — Educational Attainment for Population 25 Years and Over
 *
 * Metrics computed (all as % of population 25+):
 *   hsPlus    — High school diploma or higher
 *   bachPlus  — Bachelor's degree or higher
 *   gradPlus  — Graduate or professional degree or higher
 *
 * Usage: node scripts/build-education-data.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "public", "data");

const FIELDS = "B15003_001E,B15003_017E,B15003_018E,B15003_019E,B15003_020E,B15003_021E,B15003_022E,B15003_023E,B15003_024E,B15003_025E";

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
  const [, totalRaw, hsRaw, gedRaw, sc1Raw, sc2Raw, assocRaw, bachRaw, masterRaw, profRaw, docRaw] = row;
  const parse = (v) => v && v !== "-666666666" ? Number(v) : null;
  const total = parse(totalRaw);
  if (!total || total === 0) return null;

  const hs = parse(hsRaw) ?? 0;
  const ged = parse(gedRaw) ?? 0;
  const sc1 = parse(sc1Raw) ?? 0;
  const sc2 = parse(sc2Raw) ?? 0;
  const assoc = parse(assocRaw) ?? 0;
  const bach = parse(bachRaw) ?? 0;
  const master = parse(masterRaw) ?? 0;
  const prof = parse(profRaw) ?? 0;
  const doc = parse(docRaw) ?? 0;

  const hsPlus = hs + ged + sc1 + sc2 + assoc + bach + master + prof + doc;
  const bachPlus = bach + master + prof + doc;
  const gradPlus = master + prof + doc;

  return {
    hsPlus: Math.round(hsPlus / total * 1000) / 10,
    bachPlus: Math.round(bachPlus / total * 1000) / 10,
    gradPlus: Math.round(gradPlus / total * 1000) / 10,
  };
}

async function fetchData(url, normalizeName, label) {
  console.log(`Fetching Census ACS education data (${label})...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Census API HTTP ${res.status}: ${await res.text()}`);
  const rows = await res.json();

  const [header, ...data] = rows;
  console.log(`  Received ${data.length} ${label} (header: ${header.slice(0, 5).join(", ")}...)`);

  const byName = new Map();
  for (const row of data) {
    const name = normalizeName(row[0]);
    const edu = parseRow(row);
    if (edu) byName.set(name, edu);
  }
  console.log(`  Computed education metrics for ${byName.size} ${label}`);
  return byName;
}

function injectEducationData(geojsonPath, educationMap) {
  console.log(`Injecting education data into ${geojsonPath}...`);
  const gj = JSON.parse(readFileSync(geojsonPath, "utf-8"));
  let matched = 0;
  let missed = 0;

  for (const feat of gj.features) {
    const name = feat.properties.name;
    const edu = educationMap.get(name);
    if (edu) {
      feat.properties.education = edu;
      matched++;
    } else {
      console.warn(`  ⚠ No education data for: ${name}`);
      missed++;
    }
  }

  writeFileSync(geojsonPath, JSON.stringify(gj));
  console.log(`  ✓ ${matched} matched, ${missed} missed`);
}

async function main() {
  const countyMap = await fetchData(COUNTY_URL, normalizeCountyName, "counties");
  injectEducationData(join(DATA_DIR, "california-counties.geojson"), countyMap);
  injectEducationData(join(DATA_DIR, "california-county-labels.geojson"), countyMap);

  const cityMap = await fetchData(CITY_URL, normalizeCityName, "cities");
  injectEducationData(join(DATA_DIR, "california-cities.geojson"), cityMap);
  injectEducationData(join(DATA_DIR, "california-city-labels.geojson"), cityMap);

  console.log("Done!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
