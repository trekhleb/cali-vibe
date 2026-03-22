#!/usr/bin/env node
/**
 * Build San Diego Trolley (MTS) light rail transit data as GeoJSON files.
 *
 * Data source: San Diego MTS GTFS (filtered for light rail route_type=0)
 * License: Public
 *
 * Outputs:
 *   public/data/transit/sdtrolley-routes.geojson   (LineString per route)
 *   public/data/transit/sdtrolley-stops.geojson    (Point per station)
 *
 * Usage: node scripts/build-transit-sdtrolley.mjs
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const SYSTEM_ID = "sdtrolley";
const SYSTEM_LABEL = "San Diego Trolley";
const OUT_DIR = new URL("../public/data/transit/", import.meta.url).pathname;
const TMP_DIR = join(OUT_DIR, `.${SYSTEM_ID}-gtfs-tmp`);
const GTFS_URL = "https://www.sdmts.com/google_transit_files/google_transit.zip";

// Trolley is route_type=0 (light rail) in the MTS feed
const LIGHT_RAIL_ROUTE_TYPE = "0";

const DEFAULT_COLOR = "#0000FF";

const COLOR_OVERRIDES = {};

// ── Download & extract GTFS ──

function downloadGTFS() {
  console.log(`Downloading ${SYSTEM_LABEL} GTFS (from MTS feed)...`);
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
  const validRouteIds = new Set();
  for (const r of routes) {
    if (r.route_type !== LIGHT_RAIL_ROUTE_TYPE) continue;
    validRouteIds.add(r.route_id);
    const rawColor = r.route_color ? `#${r.route_color.trim()}` : DEFAULT_COLOR;
    routeMap[r.route_id] = {
      name: r.route_long_name || r.route_short_name || r.route_id,
      shortName: r.route_short_name || "",
      color: COLOR_OVERRIDES[rawColor] || rawColor,
      textColor: r.route_text_color ? `#${r.route_text_color.trim()}` : "#ffffff",
    };
  }

  console.log(`  Found ${validRouteIds.size} trolley routes: ${[...validRouteIds].join(", ")}`);

  // Map shape_id → route_id (only valid routes)
  const shapeToRoute = {};
  for (const t of trips) {
    if (t.shape_id && t.route_id && validRouteIds.has(t.route_id) && !shapeToRoute[t.shape_id]) {
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

  // Collect valid light rail route IDs
  const validRouteIds = new Set();
  for (const r of routes) {
    if (r.route_type === LIGHT_RAIL_ROUTE_TYPE) validRouteIds.add(r.route_id);
  }

  const tripToRoute = {};
  for (const t of trips) {
    if (validRouteIds.has(t.route_id)) {
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
    if (!validRouteIds.has(r.route_id)) continue;
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
      .replace(/\s+Station\s*\(.*?\)$/i, "")
      .replace(/\s+Station\s+\w+$/i, "")
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
