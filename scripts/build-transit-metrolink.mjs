#!/usr/bin/env node
/**
 * Build Metrolink commuter rail transit data as GeoJSON files.
 *
 * Data source: Metrolink GTFS
 * License: Public
 *
 * Outputs:
 *   public/data/transit/metrolink-routes.geojson   (LineString per route)
 *   public/data/transit/metrolink-stops.geojson    (Point per station)
 *
 * Usage: node scripts/build-transit-metrolink.mjs
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const SYSTEM_ID = "metrolink";
const SYSTEM_LABEL = "Metrolink";
const OUT_DIR = new URL("../public/data/transit/", import.meta.url).pathname;
const TMP_DIR = join(OUT_DIR, `.${SYSTEM_ID}-gtfs-tmp`);
const GTFS_URL = "https://metrolinktrains.com/globalassets/about/gtfs/gtfs.zip";

const DEFAULT_COLOR = "#0071CE";

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

// Metrolink trips.txt lacks shape_id, so map shape prefixes to route_ids manually
const SHAPE_TO_ROUTE = {
  "AV": "Antelope Valley Line",
  "IEOC": "Inland Emp.-Orange Co. Line",
  "OC": "Orange County Line",
  "RIVER": "Riverside Line",
  "SB": "San Bernardino Line",
  "VT": "Ventura County Line",
  "91": "91 Line",
};

// ── Build route GeoJSON from shapes.txt ──

function buildRoutes() {
  console.log("Building routes...");
  const shapes = parseCSV("shapes.txt");
  const routes = parseCSV("routes.txt");

  // Map route_id → route info
  const routeMap = {};
  for (const r of routes) {
    const rawColor = r.route_color ? `#${r.route_color.trim()}` : DEFAULT_COLOR;
    routeMap[r.route_id] = {
      name: (r.route_long_name || r.route_short_name || r.route_id).replace(/^Metrolink\s+/i, ""),
      shortName: r.route_short_name || "",
      color: COLOR_OVERRIDES[rawColor] || rawColor,
      textColor: r.route_text_color ? `#${r.route_text_color.trim()}` : "#ffffff",
    };
  }

  // Map shape_id → route_id using prefix mapping
  const shapeToRoute = {};
  for (const [prefix, routeId] of Object.entries(SHAPE_TO_ROUTE)) {
    shapeToRoute[`${prefix}out`] = routeId;
    shapeToRoute[`${prefix}in`] = routeId;
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
  const trips = parseCSV("trips.txt");
  const stopTimes = parseCSV("stop_times.txt");
  const routes = parseCSV("routes.txt");

  const tripToRoute = {};
  for (const t of trips) {
    tripToRoute[t.trip_id] = t.route_id;
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

    const name = (s.stop_name || s.stop_id)
      .replace(/\s+Metrolink\s+Station$/i, "")
      .replace(/\s+Station$/i, "")
      .replace(/\s+Transit Center.*$/i, "")
      .replace(/\s+-\s+/g, " — ");
    if (seenNames.has(name)) continue;

    const allStopIds = [s.stop_id, ...(parentChildren[s.stop_id] || [])];
    const routeIds = new Set();
    for (const sid of allStopIds) {
      const sr = stopRoutes[sid];
      if (sr) sr.forEach(r => routeIds.add(r));
    }

    if (routeIds.size === 0) continue;
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

// ── Main ──

function main() {
  console.log(`Building ${SYSTEM_LABEL} transit data\n`);

  downloadGTFS();

  const routes = buildRoutes();
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
