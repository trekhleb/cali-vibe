#!/usr/bin/env node
/**
 * Build Muni Metro (SFMTA) transit data as GeoJSON files.
 *
 * Data source: SFMTA GTFS
 * License: SFMTA Transit Data License
 *
 * Outputs:
 *   public/data/transit/munimetro-routes.geojson   (LineString per route)
 *   public/data/transit/munimetro-stops.geojson    (Point per station)
 *
 * Usage: node scripts/build-transit-munimetro.mjs
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const SYSTEM_ID = "munimetro";
const SYSTEM_LABEL = "Muni Metro";
const OUT_DIR = new URL("../public/data/transit/", import.meta.url).pathname;
const TMP_DIR = join(OUT_DIR, `.${SYSTEM_ID}-gtfs-tmp`);
const GTFS_URL = "https://muni-gtfs.apps.sfmta.com/data/muni_gtfs-current.zip";

const DEFAULT_COLOR = "#BA0C2F";

// Only include light rail routes (route_type=0), skip bus replacements
const VALID_ROUTE_IDS = new Set(["J", "K", "L", "M", "N", "T", "F"]);

const COLOR_OVERRIDES = {};

// ── Download & extract GTFS ──

function downloadGTFS() {
  console.log(`Downloading ${SYSTEM_LABEL} GTFS...`);
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

  const zipFile = join(TMP_DIR, `${SYSTEM_ID}.zip`);
  execSync(`curl -sL "${GTFS_URL}" -o "${zipFile}"`);
  execSync(`unzip -o "${zipFile}" -d "${TMP_DIR}"`, { stdio: "pipe" });
  console.log("  Extracted GTFS files");
}

// ── Parse CSV ──

function parseCSV(filename) {
  const filepath = join(TMP_DIR, filename);
  if (!existsSync(filepath)) {
    console.warn(`  Warning: ${filename} not found`);
    return [];
  }
  const text = readFileSync(filepath, "utf-8");
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || "";
    }
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ── Build route GeoJSON from shapes.txt ──

function buildRoutes() {
  console.log("Building routes...");
  const shapes = parseCSV("shapes.txt");
  const routes = parseCSV("routes.txt");
  const trips = parseCSV("trips.txt");

  // Map route_id → route info (only light rail)
  const routeMap = {};
  for (const r of routes) {
    if (!VALID_ROUTE_IDS.has(r.route_id)) continue;
    const rawColor = r.route_color ? `#${r.route_color.trim()}` : DEFAULT_COLOR;
    routeMap[r.route_id] = {
      name: `${r.route_short_name}-${r.route_long_name}` || r.route_id,
      shortName: r.route_short_name || "",
      color: COLOR_OVERRIDES[rawColor] || rawColor,
      textColor: r.route_text_color ? `#${r.route_text_color.trim()}` : "#ffffff",
    };
  }

  // Map shape_id → route_id (pick first trip per shape, only valid routes)
  const shapeToRoute = {};
  for (const t of trips) {
    if (t.shape_id && t.route_id && VALID_ROUTE_IDS.has(t.route_id) && !shapeToRoute[t.shape_id]) {
      shapeToRoute[t.shape_id] = t.route_id;
    }
  }

  // Group shape points by shape_id
  const shapePoints = {};
  for (const s of shapes) {
    if (!shapePoints[s.shape_id]) shapePoints[s.shape_id] = [];
    shapePoints[s.shape_id].push({
      lat: parseFloat(s.shape_pt_lat),
      lng: parseFloat(s.shape_pt_lon),
      seq: parseInt(s.shape_pt_sequence, 10),
    });
  }

  // Deduplicate by color — keep the longest shape per color
  const features = [];
  const seenColors = {};

  for (const [shapeId, points] of Object.entries(shapePoints)) {
    const routeId = shapeToRoute[shapeId];
    if (!routeId) continue;

    const route = routeMap[routeId] || { name: routeId, color: DEFAULT_COLOR };
    const colorKey = route.color;

    if (seenColors[colorKey]) {
      const existing = features.find(f => f.properties.color === colorKey);
      if (existing && existing.geometry.coordinates.length >= points.length) continue;
      const idx = features.findIndex(f => f.properties.color === colorKey);
      if (idx >= 0) features.splice(idx, 1);
    }
    seenColors[colorKey] = routeId;

    points.sort((a, b) => a.seq - b.seq);
    const coords = points.map(p => [+p.lng.toFixed(5), +p.lat.toFixed(5)]);

    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: coords },
      properties: {
        routeId,
        name: route.name,
        shortName: route.shortName,
        color: route.color,
        textColor: route.textColor,
        system: SYSTEM_ID,
      },
    });
  }

  for (const f of features) {
    console.log(`    ${f.properties.name} → ${f.properties.color}`);
  }
  console.log(`  ${features.length} routes`);
  return { type: "FeatureCollection", features };
}

// ── Build stops GeoJSON from stops.txt ──

function buildStops() {
  console.log("Building stops...");
  const stops = parseCSV("stops.txt");
  const routes = parseCSV("routes.txt");
  const trips = parseCSV("trips.txt");
  const stopTimes = parseCSV("stop_times.txt");

  // Only include trips for valid rail routes
  const tripToRoute = {};
  for (const t of trips) {
    if (VALID_ROUTE_IDS.has(t.route_id)) {
      tripToRoute[t.trip_id] = t.route_id;
    }
  }

  const stopRoutes = {};
  for (const st of stopTimes) {
    const routeId = tripToRoute[st.trip_id];
    if (!routeId) continue;
    if (!stopRoutes[st.stop_id]) stopRoutes[st.stop_id] = new Set();
    stopRoutes[st.stop_id].add(routeId);
  }

  const routeColors = {};
  for (const r of routes) {
    if (!VALID_ROUTE_IDS.has(r.route_id)) continue;
    const rawColor = r.route_color ? `#${r.route_color.trim()}` : DEFAULT_COLOR;
    routeColors[r.route_id] = COLOR_OVERRIDES[rawColor] || rawColor;
  }

  // Parent → children mapping
  const parentChildren = {};
  for (const s of stops) {
    if (s.parent_station) {
      if (!parentChildren[s.parent_station]) parentChildren[s.parent_station] = [];
      parentChildren[s.parent_station].push(s.stop_id);
    }
  }

  const features = [];
  const seenNames = new Set();

  for (const s of stops) {
    const lat = parseFloat(s.stop_lat);
    const lng = parseFloat(s.stop_lon);
    if (isNaN(lat) || isNaN(lng)) continue;

    const locationType = parseInt(s.location_type || "0", 10);
    if (locationType >= 2) continue;
    if (locationType === 0 && s.parent_station) continue;

    const name = s.stop_name || s.stop_id;
    if (seenNames.has(name)) continue;

    const allStopIds = [s.stop_id, ...(parentChildren[s.stop_id] || [])];
    const routeIds = new Set();
    for (const sid of allStopIds) {
      const sr = stopRoutes[sid];
      if (sr) sr.forEach(r => routeIds.add(r));
    }

    if (routeIds.size === 0) continue; // skip stops with no rail route associations
    seenNames.add(name);

    const colors = [...new Set([...routeIds].map(rid => routeColors[rid] || DEFAULT_COLOR))];

    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [+lng.toFixed(5), +lat.toFixed(5)],
      },
      properties: {
        name,
        stopId: s.stop_id,
        system: SYSTEM_ID,
        routes: [...routeIds],
        colors: colors.length > 0 ? colors : [DEFAULT_COLOR],
      },
    });
  }

  console.log(`  ${features.length} stops`);
  return { type: "FeatureCollection", features };
}

// ── Offset overlapping routes ──

const OFFSET_SPACING_M = 150;
const OFFSET_GRID_DEG = 0.001;
const OFFSET_SMOOTH_WINDOW = 10;
const OFFSET_SMOOTH_PASSES = 3;
const M_PER_DEG = 111_320;

function offsetRoutes(routesGeoJSON) {
  const features = routesGeoJSON.features;
  if (features.length <= 1) return routesGeoJSON;

  console.log("Offsetting overlapping routes...");

  const normCoords = features.map((f) =>
    normalizeDirection(f.geometry.coordinates),
  );

  const grid = {};
  for (let ri = 0; ri < features.length; ri++) {
    for (const [lng, lat] of normCoords[ri]) {
      const key = oGridKey(lng, lat);
      if (!grid[key]) grid[key] = new Set();
      grid[key].add(ri);
    }
  }

  const uniqueColors = [...new Set(features.map((f) => f.properties.color))].sort();
  const colorRank = {};
  uniqueColors.forEach((c, i) => { colorRank[c] = i; });

  const allPerps = normCoords.map((coords) => computePerps(coords));

  const cellRefPerp = {};
  for (let ri = 0; ri < features.length; ri++) {
    const rank = colorRank[features[ri].properties.color];
    const coords = normCoords[ri];
    const perps = allPerps[ri];
    for (let p = 0; p < coords.length; p++) {
      const key = oGridKey(coords[p][0], coords[p][1]);
      if (!cellRefPerp[key] || rank < cellRefPerp[key].rank) {
        cellRefPerp[key] = { px: perps[p].px, py: perps[p].py, rank };
      }
    }
  }

  const offsetFeatures = features.map((feature, ri) => {
    const coords = normCoords[ri];
    const perps = allPerps[ri];
    const myRank = colorRank[feature.properties.color];

    const rawOffsets = coords.map(([lng, lat], p) => {
      const sharingSet = new Set();
      for (const key of oGridNeighborKeys(lng, lat)) {
        const cell = grid[key];
        if (cell) cell.forEach((r) => sharingSet.add(r));
      }
      if (sharingSet.size <= 1) return 0;

      const ranks = [...sharingSet]
        .map((r) => colorRank[features[r].properties.color])
        .sort((a, b) => a - b);
      const myPos = ranks.indexOf(myRank);
      const count = ranks.length;
      let offset = (myPos - (count - 1) / 2) * OFFSET_SPACING_M;

      let refPx = 0, refPy = 0;
      let refFound = false;
      for (const key of oGridNeighborKeys(lng, lat)) {
        const ref = cellRefPerp[key];
        if (ref && ref.rank < myRank) {
          refPx += ref.px;
          refPy += ref.py;
          refFound = true;
        }
      }
      if (refFound) {
        const dot = perps[p].px * refPx + perps[p].py * refPy;
        if (dot < 0) offset = -offset;
      }

      return offset;
    });

    const stableOffsets = stabilizeSigns(rawOffsets, OFFSET_SMOOTH_WINDOW);
    let smoothed = stableOffsets;
    for (let pass = 0; pass < OFFSET_SMOOTH_PASSES; pass++) {
      smoothed = smoothOffsets(smoothed, OFFSET_SMOOTH_WINDOW);
    }

    const newCoords = coords.map((coord, p) => {
      if (Math.abs(smoothed[p]) < 0.1) return coord;
      const [lng, lat] = coord;
      const cosLat = Math.cos(lat * (Math.PI / 180));
      const { px, py } = perps[p];
      return [
        +(lng + (px / cosLat) * (smoothed[p] / M_PER_DEG)).toFixed(5),
        +(lat + py * (smoothed[p] / M_PER_DEG)).toFixed(5),
      ];
    });

    return {
      ...feature,
      geometry: { ...feature.geometry, coordinates: newCoords },
    };
  });

  console.log(`  Offset ${features.length} routes (spacing ${OFFSET_SPACING_M} m)`);
  return { ...routesGeoJSON, features: offsetFeatures };
}

function normalizeDirection(coords) {
  const start = coords[0];
  const end = coords[coords.length - 1];
  const dLng = end[0] - start[0];
  const dLat = end[1] - start[1];
  if (dLng < -0.01 || (Math.abs(dLng) <= 0.01 && dLat < -0.01)) {
    return [...coords].reverse();
  }
  return coords;
}

function computePerps(coords) {
  const perps = [];
  for (let p = 0; p < coords.length; p++) {
    const prev = coords[Math.max(0, p - 1)];
    const next = coords[Math.min(coords.length - 1, p + 1)];
    const [, lat] = coords[p];
    const cosLat = Math.cos(lat * (Math.PI / 180));
    const tx = (next[0] - prev[0]) * cosLat;
    const ty = next[1] - prev[1];
    const len = Math.sqrt(tx * tx + ty * ty);

    if (len < 1e-10) {
      perps.push(p > 0 ? perps[p - 1] : { px: 0, py: 1 });
      continue;
    }

    let px = -ty / len;
    let py = tx / len;

    if (p > 0) {
      const dot = px * perps[p - 1].px + py * perps[p - 1].py;
      if (dot < 0) { px = -px; py = -py; }
    } else {
      if (py < -0.01 || (Math.abs(py) <= 0.01 && px < 0)) { px = -px; py = -py; }
    }

    perps.push({ px, py });
  }
  return perps;
}

function oGridKey(lng, lat) {
  return `${Math.round(lng / OFFSET_GRID_DEG)},${Math.round(lat / OFFSET_GRID_DEG)}`;
}

function oGridNeighborKeys(lng, lat) {
  const gx = Math.round(lng / OFFSET_GRID_DEG);
  const gy = Math.round(lat / OFFSET_GRID_DEG);
  const keys = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      keys.push(`${gx + dx},${gy + dy}`);
    }
  }
  return keys;
}

function stabilizeSigns(arr, windowSize) {
  const result = new Array(arr.length);
  const half = Math.floor(windowSize / 2);
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === 0) { result[i] = 0; continue; }
    let pos = 0, neg = 0;
    const lo = Math.max(0, i - half);
    const hi = Math.min(arr.length - 1, i + half);
    for (let j = lo; j <= hi; j++) {
      if (arr[j] > 0) pos++;
      else if (arr[j] < 0) neg++;
    }
    result[i] = pos >= neg ? Math.abs(arr[i]) : -Math.abs(arr[i]);
  }
  return result;
}

function smoothOffsets(arr, windowSize) {
  const result = new Array(arr.length);
  const half = Math.floor(windowSize / 2);
  for (let i = 0; i < arr.length; i++) {
    let sum = 0;
    let count = 0;
    const lo = Math.max(0, i - half);
    const hi = Math.min(arr.length - 1, i + half);
    for (let j = lo; j <= hi; j++) {
      sum += arr[j];
      count++;
    }
    result[i] = sum / count;
  }
  return result;
}

// ── Main ──

function main() {
  console.log(`Building ${SYSTEM_LABEL} transit data\n`);

  downloadGTFS();

  const routesRaw = buildRoutes();
  const routes = offsetRoutes(routesRaw);
  const stops = buildStops();

  const routesFile = join(OUT_DIR, `${SYSTEM_ID}-routes.geojson`);
  const stopsFile = join(OUT_DIR, `${SYSTEM_ID}-stops.geojson`);

  writeFileSync(routesFile, JSON.stringify(routes));
  writeFileSync(stopsFile, JSON.stringify(stops));

  const routesSizeKB = (Buffer.byteLength(JSON.stringify(routes)) / 1024).toFixed(1);
  const stopsSizeKB = (Buffer.byteLength(JSON.stringify(stops)) / 1024).toFixed(1);

  console.log(`\n→ ${routesFile} (${routes.features.length} routes, ${routesSizeKB} KB)`);
  console.log(`→ ${stopsFile} (${stops.features.length} stops, ${stopsSizeKB} KB)`);

  rmSync(TMP_DIR, { recursive: true, force: true });
  console.log("\nDone!");
}

main();
