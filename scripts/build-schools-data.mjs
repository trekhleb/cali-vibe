#!/usr/bin/env node

/**
 * Fetches California school data from the CDE (California Department of Education)
 * and computes aggregate school performance metrics per county and city.
 *
 * Data sources:
 *   1. CDE Public Schools Directory — school locations, types, grade levels
 *      https://www.cde.ca.gov/ds/si/ds/pubschls.asp
 *   2. CDE Dashboard Academic Indicator — ELA & Math performance
 *      https://www.cde.ca.gov/ds/ad/filessp.asp
 *   3. CDE Graduation Rate — four-year cohort graduation rate
 *      https://www.cde.ca.gov/ds/ad/filesacgr.asp
 *
 * Metrics computed (per county / city):
 *   schoolCount     — number of active public schools
 *   elaProficient   — avg % of students meeting/exceeding ELA standards
 *   mathProficient  — avg % of students meeting/exceeding Math standards
 *   graduationRate  — avg four-year cohort graduation rate
 *
 * Usage: node scripts/build-schools-data.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "public", "data");

// ----- CDE Dashboard Academic Indicator (ELA & Math) -----
// https://www.cde.ca.gov/ta/ac/cm/acaddatafiles.asp
// ELA and Math are separate files
const ELA_URL = "https://www3.cde.ca.gov/researchfiles/cadashboard/eladownload2025.txt";
const MATH_URL = "https://www3.cde.ca.gov/researchfiles/cadashboard/mathdownload2025.txt";

// ----- CDE Graduation Rate -----
// https://www.cde.ca.gov/ta/ac/cm/graddatafiles.asp
// Four-year adjusted cohort graduation rate
const GRAD_URL = "https://www3.cde.ca.gov/researchfiles/cadashboard/graddownload2025.txt";

// ----- CDE Public Schools Directory -----
// https://www.cde.ca.gov/ds/si/ds/pubschls.asp
const SCHOOLS_DIR_URL = "https://www.cde.ca.gov/schooldirectory/report?rid=dl1&tp=txt";

// ---- Helpers ----

function parseTsv(text) {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return [];
  const header = lines[0].split("\t").map((h) => h.replace(/^"|"$/g, "").trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split("\t").map((v) => v.replace(/^"|"$/g, "").trim());
    const obj = {};
    for (let j = 0; j < header.length; j++) {
      obj[header[j]] = vals[j] ?? "";
    }
    rows.push(obj);
  }
  return rows;
}

async function fetchText(url, label) {
  console.log(`Fetching ${label}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${label}: ${await res.text()}`);
  const text = await res.text();
  console.log(`  Downloaded ${(text.length / 1024 / 1024).toFixed(1)} MB`);
  return text;
}

// ---- Step 1: Load school directory ----

async function loadSchoolDirectory() {
  const text = await fetchText(SCHOOLS_DIR_URL, "CDE Public Schools Directory");
  const rows = parseTsv(text);
  console.log(`  Parsed ${rows.length} school directory rows`);

  // Filter to active, public K-12 schools in California
  const schools = [];
  for (const row of rows) {
    const status = row.StatusType || row.Status;
    if (status !== "Active") continue;

    const lat = parseFloat(row.Latitude);
    const lon = parseFloat(row.Longitude);
    if (!lat || !lon || lat === 0 || lon === 0) continue;

    const county = (row.County || "").trim();
    const city = (row.City || "").trim();
    const cdsCode = (row.CDSCode || "").trim();
    const name = (row.School || "").trim();
    if (!cdsCode || !name) continue;

    // Determine school level from EILCode, SOCType, grade range, and name
    const eilCode = (row.EILCode || "").trim();
    const socType = (row.SOCType || "").trim();
    const gsLow = (row.GSoffered || "").trim().toLowerCase();
    const gsHigh = (row.GShighGrade || "").trim();
    const nameLower = name.toLowerCase();

    let level = "Other";
    const eilLower = eilCode.toLowerCase();
    const socLower = socType.toLowerCase();
    if (eilLower.includes("elem") || socLower.includes("elem")) level = "Elementary";
    else if (eilLower.includes("midd") || eilLower.includes("junior") || socLower.includes("middle") || socLower.includes("junior") || nameLower.includes("middle") || nameLower.includes("junior high")) level = "Middle";
    else if (eilLower.includes("high") || socLower.includes("high school")) level = "High";
    else if (eilLower.includes("k-12") || eilLower.includes("unified")) level = "K-12";

    const charter = (row.Charter || "").trim() === "Y";

    schools.push({ cdsCode, name, county, city, lat, lon, level, charter });
  }

  console.log(`  Active schools with coordinates: ${schools.length}`);
  return schools;
}

// ---- Step 2: Load Dashboard ELA & Math scores (separate files) ----

function parseIndicatorFile(rows, indicatorName) {
  const bySchool = new Map();
  for (const row of rows) {
    const rtype = (row.rtype || "").trim();
    if (rtype !== "S") continue; // S = School level

    const studentGroup = (row.studentgroup || "").trim();
    if (studentGroup !== "ALL") continue;

    const cds = (row.cds || "").trim();
    if (!cds) continue;

    const currstatus = parseFloat(row.currstatus);
    if (isNaN(currstatus)) continue;

    bySchool.set(cds, currstatus);
  }
  console.log(`  ${indicatorName}: ${bySchool.size} schools`);
  return bySchool;
}

async function loadTestScores() {
  const elaText = await fetchText(ELA_URL, "CDE Dashboard ELA Indicator");
  const elaRows = parseTsv(elaText);
  console.log(`  Parsed ${elaRows.length} ELA rows`);
  const elaMap = parseIndicatorFile(elaRows, "ELA");

  const mathText = await fetchText(MATH_URL, "CDE Dashboard Math Indicator");
  const mathRows = parseTsv(mathText);
  console.log(`  Parsed ${mathRows.length} Math rows`);
  const mathMap = parseIndicatorFile(mathRows, "Math");

  // Merge into single map
  const bySchool = new Map();
  for (const [cds, ela] of elaMap) {
    if (!bySchool.has(cds)) bySchool.set(cds, {});
    bySchool.get(cds).ela = ela;
  }
  for (const [cds, math] of mathMap) {
    if (!bySchool.has(cds)) bySchool.set(cds, {});
    bySchool.get(cds).math = math;
  }

  console.log(`  Schools with test score data: ${bySchool.size}`);
  return bySchool;
}

// ---- Step 3: Load graduation rate ----

async function loadGraduationRates() {
  const text = await fetchText(GRAD_URL, "CDE Dashboard Graduation Rate");
  const rows = parseTsv(text);
  console.log(`  Parsed ${rows.length} graduation rate rows`);

  const bySchool = new Map(); // cdsCode -> gradRate

  for (const row of rows) {
    const rtype = (row.rtype || "").trim();
    if (rtype !== "S") continue;

    const studentGroup = (row.studentgroup || "").trim();
    if (studentGroup !== "ALL") continue;

    const cds = (row.cds || "").trim();
    if (!cds) continue;

    const currstatus = parseFloat(row.currstatus);
    if (isNaN(currstatus)) continue;

    bySchool.set(cds, currstatus);
  }

  console.log(`  Schools with graduation rate data: ${bySchool.size}`);
  return bySchool;
}

// ---- Step 4: Spatial join — assign schools to counties/cities ----

function pointInPolygon(point, polygon) {
  // Ray-casting algorithm
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInMultiPolygon(point, geometry) {
  if (geometry.type === "Polygon") {
    return pointInPolygon(point, geometry.coordinates[0]);
  }
  if (geometry.type === "MultiPolygon") {
    for (const poly of geometry.coordinates) {
      if (pointInPolygon(point, poly[0])) return true;
    }
  }
  return false;
}

function spatialJoinSchoolsToRegions(schools, geojson) {
  const regionMap = new Map(); // regionName -> [schoolIndices]
  const features = geojson.features;

  for (let si = 0; si < schools.length; si++) {
    const school = schools[si];
    const point = [school.lon, school.lat];
    for (const feat of features) {
      if (pointInMultiPolygon(point, feat.geometry)) {
        const name = feat.properties.name;
        if (!regionMap.has(name)) regionMap.set(name, []);
        regionMap.get(name).push(si);
        break;
      }
    }
  }

  return regionMap;
}

// ---- Step 5: Aggregate metrics ----

function aggregateMetrics(regionMap, schools, testScores, gradRates) {
  const result = new Map();

  for (const [regionName, schoolIndices] of regionMap) {
    const elaScores = [];
    const mathScores = [];
    const gradScoresArr = [];

    for (const si of schoolIndices) {
      const school = schools[si];
      const scores = testScores.get(school.cdsCode);
      if (scores) {
        if (scores.ela !== undefined) elaScores.push(scores.ela);
        if (scores.math !== undefined) mathScores.push(scores.math);
      }
      const grad = gradRates.get(school.cdsCode);
      if (grad !== undefined) gradScoresArr.push(grad);
    }

    const avg = (arr) => arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;

    result.set(regionName, {
      schoolCount: schoolIndices.length,
      ela: avg(elaScores),
      math: avg(mathScores),
      graduationRate: avg(gradScoresArr),
    });
  }

  return result;
}

// ---- Step 6: Inject into GeoJSON ----

function injectSchoolsData(geojsonPath, schoolsMap) {
  console.log(`Injecting schools data into ${geojsonPath}...`);
  const gj = JSON.parse(readFileSync(geojsonPath, "utf-8"));
  let matched = 0;
  let missed = 0;

  for (const feat of gj.features) {
    const name = feat.properties.name;
    const data = schoolsMap.get(name);
    if (data) {
      feat.properties.schools = data;
      matched++;
    } else {
      console.warn(`  ⚠ No schools data for: ${name}`);
      missed++;
    }
  }

  writeFileSync(geojsonPath, JSON.stringify(gj));
  console.log(`  ✓ ${matched} matched, ${missed} missed`);
}

// ---- Step 7: Generate school points GeoJSON ----

function generateSchoolPointsGeoJson(schools, testScores, gradRates, outputPath) {
  console.log(`Generating school points GeoJSON...`);
  const features = [];

  for (const school of schools) {
    const scores = testScores.get(school.cdsCode) || {};
    const grad = gradRates.get(school.cdsCode);

    // Compute a simple 1-5 rating based on ELA score (DFS = Distance From Standard)
    // DFS ranges roughly from -200 to +100; 0 = meeting standard
    let rating = null;
    if (scores.ela !== undefined) {
      const dfs = scores.ela;
      if (dfs >= 45) rating = 5;       // Blue (Very High)
      else if (dfs >= 10) rating = 4;   // Green (High)
      else if (dfs >= -20) rating = 3;  // Yellow (Medium)
      else if (dfs >= -70) rating = 2;  // Orange (Low)
      else rating = 1;                   // Red (Very Low)
    }

    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [school.lon, school.lat],
      },
      properties: {
        name: school.name,
        county: school.county,
        city: school.city,
        level: school.level,
        charter: school.charter,
        ela: scores.ela ?? null,
        math: scores.math ?? null,
        graduationRate: grad ?? null,
        rating,
      },
    });
  }

  const geojson = {
    type: "FeatureCollection",
    features,
  };

  writeFileSync(outputPath, JSON.stringify(geojson));
  console.log(`  ✓ ${features.length} school points written`);
}

// ---- Main ----

async function main() {
  // Load all data
  const schools = await loadSchoolDirectory();
  const testScores = await loadTestScores();
  const gradRates = await loadGraduationRates();

  console.log(`\nJoining test scores to schools...`);
  let matchedScores = 0;
  let matchedGrad = 0;
  for (const school of schools) {
    if (testScores.has(school.cdsCode)) matchedScores++;
    if (gradRates.has(school.cdsCode)) matchedGrad++;
  }
  console.log(`  ${matchedScores}/${schools.length} schools have test scores`);
  console.log(`  ${matchedGrad}/${schools.length} schools have graduation rates`);

  // Spatial join to counties
  console.log(`\nSpatial join to counties...`);
  const countyGj = JSON.parse(readFileSync(join(DATA_DIR, "california-counties.geojson"), "utf-8"));
  const countyMap = spatialJoinSchoolsToRegions(schools, countyGj);
  console.log(`  Matched schools to ${countyMap.size} counties`);
  const countyMetrics = aggregateMetrics(countyMap, schools, testScores, gradRates);

  // Spatial join to cities
  console.log(`\nSpatial join to cities...`);
  const cityGj = JSON.parse(readFileSync(join(DATA_DIR, "california-cities.geojson"), "utf-8"));
  const cityMap = spatialJoinSchoolsToRegions(schools, cityGj);
  console.log(`  Matched schools to ${cityMap.size} cities`);
  const cityMetrics = aggregateMetrics(cityMap, schools, testScores, gradRates);

  // Inject into county files
  injectSchoolsData(join(DATA_DIR, "california-counties.geojson"), countyMetrics);
  injectSchoolsData(join(DATA_DIR, "california-county-labels.geojson"), countyMetrics);

  // Inject into city files
  injectSchoolsData(join(DATA_DIR, "california-cities.geojson"), cityMetrics);
  injectSchoolsData(join(DATA_DIR, "california-city-labels.geojson"), cityMetrics);

  // Generate school points GeoJSON
  generateSchoolPointsGeoJson(
    schools,
    testScores,
    gradRates,
    join(DATA_DIR, "california-schools.geojson"),
  );

  console.log("\nDone!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
