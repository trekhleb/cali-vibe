#!/usr/bin/env node
/**
 * build-climate-aggregates.mjs
 *
 * Pre-computes average temperature and sunshine values per county and city
 * by spatially joining H3 hex centroids to polygon boundaries (ray-casting).
 *
 * Writes a `climate` property into county-labels.geojson and city-labels.geojson:
 *   climate: {
 *     tmin:      [12 monthly values, °C],
 *     tmax:      [12 monthly values, °C],
 *     tavg:      [12 monthly values, °C],
 *     sunNsrdb:  [12 monthly values, hours/day],
 *     sunEra5:   [12 monthly values, hours/day],
 *     hexCount:  number of hexes used
 *   }
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../public/data");

// ────────────────────────────────────────────
// Geometry helpers
// ────────────────────────────────────────────

/** Ray-casting point-in-ring. Coordinates are [lng, lat]. */
function pointInRing(px, py, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Inside outer ring AND not in any holes. */
function pointInPolygon(px, py, polygon) {
  if (!pointInRing(px, py, polygon[0])) return false;
  for (let h = 1; h < polygon.length; h++) {
    if (pointInRing(px, py, polygon[h])) return false;
  }
  return true;
}

/** Inside any component polygon of a MultiPolygon. */
function pointInMultiPolygon(px, py, multiPoly) {
  for (const poly of multiPoly) {
    if (pointInPolygon(px, py, poly)) return true;
  }
  return false;
}

/** Centroid of a closed polygon ring (ignore last duplicate vertex). */
function ringCentroid(ring) {
  const n = ring.length - 1;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += ring[i][0]; sy += ring[i][1]; }
  return [sx / n, sy / n];
}

/** Bounding box [minLng, minLat, maxLng, maxLat] of a MultiPolygon. */
function bbox(multiPoly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const poly of multiPoly) {
    for (const pt of poly[0]) {
      if (pt[0] < x0) x0 = pt[0];
      if (pt[1] < y0) y0 = pt[1];
      if (pt[0] > x1) x1 = pt[0];
      if (pt[1] > y1) y1 = pt[1];
    }
  }
  return [x0, y0, x1, y1];
}

/** Haversine distance in km. */
function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Element-wise average of an array of equal-length number arrays. Round to 1 dp. */
function avgArrays(arrays) {
  if (!arrays.length) return null;
  const n = arrays[0].length;
  const sums = new Float64Array(n);
  for (const a of arrays) for (let i = 0; i < n; i++) sums[i] += a[i];
  return Array.from(sums, (s) => Math.round((s / arrays.length) * 10) / 10);
}

/**
 * Inverse-distance-weighted average of arrays.
 * Each entry: { arr: number[], weight: number }.
 */
function idwArrays(entries) {
  const valid = entries.filter((e) => e.arr);
  if (!valid.length) return null;
  const n = valid[0].arr.length;
  const result = new Float64Array(n);
  let wSum = 0;
  for (const { arr, weight } of valid) {
    for (let i = 0; i < n; i++) result[i] += arr[i] * weight;
    wSum += weight;
  }
  return Array.from(result, (v) => Math.round((v / wSum) * 10) / 10);
}

/** Normalize Polygon / MultiPolygon coords to MultiPolygon format. */
function toMultiPolygonCoords(geometry) {
  if (geometry.type === "Polygon") return [geometry.coordinates];
  return geometry.coordinates; // already MultiPolygon
}

// ────────────────────────────────────────────
// Load data
// ────────────────────────────────────────────

function loadJson(name) {
  return JSON.parse(readFileSync(resolve(DATA_DIR, name), "utf-8"));
}

console.log("Loading files…");
const countyPolys = loadJson("california-counties.geojson");
const cityPolys = loadJson("california-cities.geojson");
const countyLabels = loadJson("california-county-labels.geojson");
const cityLabels = loadJson("california-city-labels.geojson");
const tempHex = loadJson("california-temperature-h3-res5.geojson");
const nsrdbHex = loadJson("california-sunshine-nsrdb-h3-res5.geojson");
const era5Hex = loadJson("california-sunshine-era5-h3-res5.geojson");

console.log(
  `  ${countyPolys.features.length} counties, ${cityPolys.features.length} cities, ` +
  `${tempHex.features.length} temp hexes, ${nsrdbHex.features.length} NSRDB hexes, ${era5Hex.features.length} ERA5 hexes`
);

// ────────────────────────────────────────────
// Build unified hex array
// ────────────────────────────────────────────

console.log("Building hex index…");

/** Parse array that might be stored as JSON string. */
const arr = (v) => (typeof v === "string" ? JSON.parse(v) : v);

const hexById = new Map();

for (const f of tempHex.features) {
  const id = f.properties.h3;
  hexById.set(id, {
    centroid: ringCentroid(f.geometry.coordinates[0]),
    tmin: arr(f.properties.tmin),
    tmax: arr(f.properties.tmax),
    tavg: arr(f.properties.tavg),
    sunNsrdb: null,
    sunEra5: null,
  });
}

for (const f of nsrdbHex.features) {
  const id = f.properties.h3;
  const sun = arr(f.properties.sunshine);
  if (hexById.has(id)) {
    hexById.get(id).sunNsrdb = sun;
  } else {
    hexById.set(id, {
      centroid: ringCentroid(f.geometry.coordinates[0]),
      tmin: null, tmax: null, tavg: null,
      sunNsrdb: sun, sunEra5: null,
    });
  }
}

for (const f of era5Hex.features) {
  const id = f.properties.h3;
  const sun = arr(f.properties.sunshine);
  if (hexById.has(id)) {
    hexById.get(id).sunEra5 = sun;
  } else {
    hexById.set(id, {
      centroid: ringCentroid(f.geometry.coordinates[0]),
      tmin: null, tmax: null, tavg: null,
      sunNsrdb: null, sunEra5: sun,
    });
  }
}

const hexes = [...hexById.values()];
console.log(`  ${hexes.length} unique hex cells`);

// Build a polygon-ring index for reverse lookup: "which hex contains this point?"
// Each entry: { ring: coordinate[], hex: hexData }
const hexPolyIndex = [];
for (const f of tempHex.features) {
  const id = f.properties.h3;
  const hex = hexById.get(id);
  if (hex) hexPolyIndex.push({ ring: f.geometry.coordinates[0], hex });
}
// Also add any hexes only in sunshine data
for (const f of [...nsrdbHex.features, ...era5Hex.features]) {
  const id = f.properties.h3;
  if (!hexPolyIndex.find((e) => e.hex === hexById.get(id))) {
    const hex = hexById.get(id);
    if (hex) hexPolyIndex.push({ ring: f.geometry.coordinates[0], hex });
  }
}
console.log(`  ${hexPolyIndex.length} hex polygons indexed for reverse lookup`);

// ────────────────────────────────────────────
// Spatial join: hex centroids → polygons
// ────────────────────────────────────────────

/** Find the hex whose polygon contains the given point. */
function findContainingHex(pt) {
  for (const { ring, hex } of hexPolyIndex) {
    if (pointInRing(pt[0], pt[1], ring)) return hex;
  }
  return null;
}

const IDW_K = 3; // number of nearest hexes for IDW interpolation

function findHexes(multiPoly, fallbackPt, name) {
  const [x0, y0, x1, y1] = bbox(multiPoly);
  const pad = 0.15; // generous pad for edge hexes
  const contained = [];
  for (const h of hexes) {
    const [cx, cy] = h.centroid;
    if (cx < x0 - pad || cx > x1 + pad || cy < y0 - pad || cy > y1 + pad) continue;
    if (pointInMultiPolygon(cx, cy, multiPoly)) contained.push(h);
  }
  if (contained.length >= 2) return { hexes: contained, mode: "contained" };

  // For 0-1 contained centroids: use IDW of K nearest hex centroids to the
  // entity point. This blends surrounding data and reduces terrain-sampling
  // bias that occurs when a single hex centroid sits in different terrain
  // (e.g. hills) than the city (e.g. valley).
  const ranked = hexes
    .map((h) => ({ hex: h, dist: haversineKm(fallbackPt, h.centroid) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, IDW_K);

  const mode = contained.length === 1 ? "idw(1+nearby)" : "idw(nearest)";
  console.log(`  ⚠ ${name}: ${contained.length} contained → ${mode}, k=${IDW_K}, dists=${ranked.map((r) => r.dist.toFixed(1)).join("/")}`);
  return { hexes: ranked.map((r) => r.hex), weights: ranked.map((r) => 1 / r.dist), mode };
}

function aggregate(result) {
  const { hexes: matched, weights } = result;
  if (weights) {
    // IDW aggregation
    return {
      tmin: idwArrays(matched.map((h, i) => ({ arr: h.tmin, weight: weights[i] }))),
      tmax: idwArrays(matched.map((h, i) => ({ arr: h.tmax, weight: weights[i] }))),
      tavg: idwArrays(matched.map((h, i) => ({ arr: h.tavg, weight: weights[i] }))),
      sunNsrdb: idwArrays(matched.map((h, i) => ({ arr: h.sunNsrdb, weight: weights[i] }))),
      sunEra5: idwArrays(matched.map((h, i) => ({ arr: h.sunEra5, weight: weights[i] }))),
      hexCount: matched.length,
    };
  }
  // Simple average for entities with multiple contained hexes
  return {
    tmin: avgArrays(matched.filter((h) => h.tmin).map((h) => h.tmin)),
    tmax: avgArrays(matched.filter((h) => h.tmax).map((h) => h.tmax)),
    tavg: avgArrays(matched.filter((h) => h.tavg).map((h) => h.tavg)),
    sunNsrdb: avgArrays(matched.filter((h) => h.sunNsrdb).map((h) => h.sunNsrdb)),
    sunEra5: avgArrays(matched.filter((h) => h.sunEra5).map((h) => h.sunEra5)),
    hexCount: matched.length,
  };
}

// ────────────────────────────────────────────
// Counties
// ────────────────────────────────────────────

console.log("\nProcessing counties…");
const countyPolyMap = new Map();
for (const f of countyPolys.features) countyPolyMap.set(f.properties.name, toMultiPolygonCoords(f.geometry));

for (const lbl of countyLabels.features) {
  const name = lbl.properties.name;
  const poly = countyPolyMap.get(name);
  if (!poly) { console.log(`  ✗ No boundary found for "${name}"`); continue; }
  const matched = findHexes(poly, lbl.geometry.coordinates, name);
  const climate = aggregate(matched);
  lbl.properties.climate = climate;
  const yearAvg = climate.tavg ? (climate.tavg.reduce((a, b) => a + b, 0) / 12).toFixed(1) : "–";
  console.log(`  ${name}: ${climate.hexCount} hexes, tavg(year) = ${yearAvg}°C`);
}

// ────────────────────────────────────────────
// Cities
// ────────────────────────────────────────────

console.log("\nProcessing cities…");
const cityPolyMap = new Map();
for (const f of cityPolys.features) cityPolyMap.set(f.properties.name, toMultiPolygonCoords(f.geometry));

let cityFallbacks = 0;
for (const lbl of cityLabels.features) {
  const name = lbl.properties.name;
  const poly = cityPolyMap.get(name);
  const fallbackPt = lbl.geometry.coordinates;
  let result;
  if (poly) {
    result = findHexes(poly, fallbackPt, name);
  } else {
    // No polygon — use IDW of K nearest hexes
    const ranked = hexes
      .map((h) => ({ hex: h, dist: haversineKm(fallbackPt, h.centroid) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, IDW_K);
    result = { hexes: ranked.map((r) => r.hex), weights: ranked.map((r) => 1 / r.dist), mode: "idw(no-poly)" };
    cityFallbacks++;
  }
  lbl.properties.climate = aggregate(result);
}
console.log(`  ${cityLabels.features.length} cities processed (${cityFallbacks} used nearest-hex fallback)`);

// ────────────────────────────────────────────
// Validation
// ────────────────────────────────────────────

console.log("\n═══ Validation ═══");

const getC = (coll, name) => coll.features.find((f) => f.properties.name === name)?.properties.climate;
const yearAvg = (a) => (a ? a.reduce((s, v) => s + v, 0) / 12 : null);
const fmt = (v) => (v != null ? v.toFixed(1) : "–");

const checks = [
  ["San Francisco", "county"],
  ["Los Angeles", "county"],
  ["Inyo", "county"],
  ["Imperial", "county"],
  ["Humboldt", "county"],
  ["San Diego", "county"],
];

console.log("\nCounty annual avg temperature (°C):");
for (const [name] of checks) {
  const c = getC(countyLabels, name);
  console.log(`  ${name.padEnd(16)} tavg=${fmt(yearAvg(c?.tavg))}  tmax=${fmt(yearAvg(c?.tmax))}  tmin=${fmt(yearAvg(c?.tmin))}  sun(nsrdb)=${fmt(yearAvg(c?.sunNsrdb))}  hexes=${c?.hexCount}`);
}

// Sanity assertions
const sfT = yearAvg(getC(countyLabels, "San Francisco")?.tavg);
const laT = yearAvg(getC(countyLabels, "Los Angeles")?.tavg);
const impT = yearAvg(getC(countyLabels, "Imperial")?.tavg);
const humT = yearAvg(getC(countyLabels, "Humboldt")?.tavg);

const ok = (label, cond) => console.log(`  ${cond ? "✓" : "✗ FAIL"} ${label}`);
ok("LA warmer than SF", laT > sfT);
ok("Imperial warmer than LA", impT > laT);
ok("Humboldt cooler than SF", humT < sfT);

const sfSun = yearAvg(getC(countyLabels, "San Francisco")?.sunNsrdb);
const impSun = yearAvg(getC(countyLabels, "Imperial")?.sunNsrdb);
ok("Imperial sunnier than SF", impSun > sfSun);

// City spot-checks
console.log("\nCity spot-checks:");
for (const name of ["San Francisco", "Los Angeles", "San Diego", "Sacramento", "Fresno"]) {
  const c = getC(cityLabels, name);
  console.log(`  ${name.padEnd(16)} tavg=${fmt(yearAvg(c?.tavg))}  sun(nsrdb)=${fmt(yearAvg(c?.sunNsrdb))}  hexes=${c?.hexCount}`);
}

// ────────────────────────────────────────────
// Write
// ────────────────────────────────────────────

console.log("\nWriting updated label files…");
writeFileSync(resolve(DATA_DIR, "california-county-labels.geojson"), JSON.stringify(countyLabels));
writeFileSync(resolve(DATA_DIR, "california-city-labels.geojson"), JSON.stringify(cityLabels));
console.log("✓ Done.");
