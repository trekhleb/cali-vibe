#!/usr/bin/env node
/**
 * Build Amtrak long-distance transit data (CA segments only) as GeoJSON files.
 *
 * Routes: Coast Starlight, California Zephyr, Southwest Chief
 * Only the California portions of shapes and stops are included.
 *
 * Data source: Amtrak GTFS (content.amtrak.com)
 * License: Public
 *
 * Outputs:
 *   public/data/transit/coaststarlight-routes.geojson
 *   public/data/transit/coaststarlight-stops.geojson
 *   public/data/transit/calzephyr-routes.geojson
 *   public/data/transit/calzephyr-stops.geojson
 *   public/data/transit/swchief-routes.geojson
 *   public/data/transit/swchief-stops.geojson
 *
 * Usage: node scripts/build-transit-amtrak-long.mjs
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const OUT_DIR = new URL("../public/data/transit/", import.meta.url).pathname;
const TMP_DIR = join(OUT_DIR, ".amtrak-long-gtfs-tmp");
const GTFS_URL = "https://content.amtrak.com/content/gtfs/GTFS.zip";

// Route definitions: Amtrak route_id → our system config
const ROUTES = {
  "36924": {
    systemId: "coaststarlight",
    label: "Coast Starlight",
    color: "#1C3F6E",
  },
  "96": {
    systemId: "calzephyr",
    label: "California Zephyr",
    color: "#6B3A2A",
  },
  "51": {
    systemId: "swchief",
    label: "Southwest Chief",
    color: "#B5451B",
  },
};

// California border approximation (piecewise eastern boundary)
// The eastern border is irregular — use latitude bands with max longitude
const CA_LAT_MIN = 32.5;
const CA_LAT_MAX = 42.05;
const CA_LNG_MIN = -124.5;

// Eastern border: sorted by latitude (south to north)
// Each entry: [lat_threshold, max_lng] — for lats below this threshold, use this max_lng
const CA_EAST_BORDER = [
  [33.0, -114.6],  // SE corner (Colorado River)
  [34.0, -114.6],  // Along Colorado River
  [35.0, -114.6],  // Needles area — still Colorado River
  [35.5, -115.4],  // Transition from river to NV border
  [36.0, -117.5],  // Death Valley area
  [37.0, -117.8],  // Inyo County
  [38.0, -118.0],  // Mono County
  [39.0, -119.5],  // Lake Tahoe area
  [40.0, -120.0],  // Lassen / Sierra border
  [42.1, -120.0],  // NE corner (Oregon border)
];

function getEastBorder(lat) {
  for (const [threshold, maxLng] of CA_EAST_BORDER) {
    if (lat < threshold) return maxLng;
  }
  return -120.0;
}

function isInCalifornia(lat, lng) {
  if (lat < CA_LAT_MIN || lat > CA_LAT_MAX || lng < CA_LNG_MIN) return false;
  return lng <= getEastBorder(lat);
}

// ── Download & extract GTFS ──

function downloadGTFS() {
  console.log("Downloading Amtrak GTFS...");
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
  const zipFile = join(TMP_DIR, "amtrak.zip");
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

// ── Build ──

function build() {
  const shapes = parseCSV("shapes.txt");
  const routes = parseCSV("routes.txt");
  const trips = parseCSV("trips.txt");
  const stops = parseCSV("stops.txt");
  const stopTimes = parseCSV("stop_times.txt");

  const targetRouteIds = new Set(Object.keys(ROUTES));

  // Map trip_id → { route_id, shape_id }
  const tripMap = {};
  for (const t of trips) {
    if (targetRouteIds.has(t.route_id)) {
      tripMap[t.trip_id] = { routeId: t.route_id, shapeId: t.shape_id || "" };
    }
  }

  // Map shape_id → route_id
  const shapeToRoute = {};
  for (const t of Object.values(tripMap)) {
    if (t.shapeId && !shapeToRoute[t.shapeId]) {
      shapeToRoute[t.shapeId] = t.routeId;
    }
  }

  // Group shape points by shape_id
  const shapePoints = {};
  for (const s of shapes) {
    if (!shapeToRoute[s.shape_id]) continue;
    if (!shapePoints[s.shape_id]) shapePoints[s.shape_id] = [];
    shapePoints[s.shape_id].push({
      lat: parseFloat(s.shape_pt_lat),
      lng: parseFloat(s.shape_pt_lon),
      seq: parseInt(s.shape_pt_sequence, 10),
    });
  }

  // Collect stops per route
  const stopIdsPerRoute = {};
  for (const st of stopTimes) {
    const trip = tripMap[st.trip_id];
    if (!trip) continue;
    if (!stopIdsPerRoute[trip.routeId]) stopIdsPerRoute[trip.routeId] = new Set();
    stopIdsPerRoute[trip.routeId].add(st.stop_id);
  }

  const stopMap = {};
  for (const s of stops) {
    stopMap[s.stop_id] = s;
  }

  // Build GeoJSON for each route
  for (const [amtrakRouteId, config] of Object.entries(ROUTES)) {
    console.log(`\nBuilding ${config.label}...`);

    // Routes: find the longest shape for this route, clip to CA
    let bestShape = null;
    let bestLen = 0;
    for (const [shapeId, pts] of Object.entries(shapePoints)) {
      if (shapeToRoute[shapeId] !== amtrakRouteId) continue;
      if (pts.length > bestLen) {
        bestLen = pts.length;
        bestShape = pts;
      }
    }

    const routeFeatures = [];
    if (bestShape) {
      bestShape.sort((a, b) => a.seq - b.seq);
      // Clip to CA + one point past the border on each end
      // Walk forward to find first CA point, include one point before it
      // Walk backward to find last CA point, include one point after it
      let firstCA = -1, lastCA = -1;
      for (let i = 0; i < bestShape.length; i++) {
        if (isInCalifornia(bestShape[i].lat, bestShape[i].lng)) {
          if (firstCA === -1) firstCA = i;
          lastCA = i;
        }
      }
      if (firstCA >= 0) {
        const startIdx = Math.max(0, firstCA - 1);
        const endIdx = Math.min(bestShape.length - 1, lastCA + 1);
        const clipped = bestShape.slice(startIdx, endIdx + 1);
        const coords = clipped.map(p => [+p.lng.toFixed(5), +p.lat.toFixed(5)]);
        routeFeatures.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates: coords },
          properties: {
            routeId: amtrakRouteId,
            name: config.label,
            shortName: "",
            color: config.color,
            textColor: "#ffffff",
            system: config.systemId,
          },
        });
        console.log(`  Route: ${coords.length} points (clipped to CA from ${bestShape.length})`);
      }
    }

    // Stops: CA stops + first stop outside CA at each end of the route
    const routeStopIds = stopIdsPerRoute[amtrakRouteId] || new Set();
    // Get all stops with their position along the route (by lat for ordering)
    const allRouteStops = [];
    for (const sid of routeStopIds) {
      const s = stopMap[sid];
      if (!s) continue;
      const lat = parseFloat(s.stop_lat);
      const lng = parseFloat(s.stop_lon);
      if (isNaN(lat) || isNaN(lng)) continue;
      allRouteStops.push({ ...s, lat, lng, inCA: isInCalifornia(lat, lng) });
    }

    // Sort by latitude to find border stops
    allRouteStops.sort((a, b) => a.lat - b.lat);

    // Find the closest non-CA stop beyond each end of the CA segment
    const caStops = allRouteStops.filter(s => s.inCA);
    const borderStopNames = new Set();
    if (caStops.length > 0) {
      const minCALat = Math.min(...caStops.map(s => s.lat));
      const maxCALat = Math.max(...caStops.map(s => s.lat));
      const maxCALng = Math.max(...caStops.map(s => s.lng));

      // Non-CA stops outside the CA segment
      const nonCAStops = allRouteStops.filter(s => !s.inCA);

      // Closest stop south of CA segment (highest lat among those below minCALat)
      const southCandidates = nonCAStops.filter(s => s.lat < minCALat);
      if (southCandidates.length > 0) {
        const southBorder = southCandidates.reduce((a, b) => a.lat > b.lat ? a : b);
        borderStopNames.add(southBorder.stop_name);
      }

      // Closest stop north of CA segment (lowest lat among those above maxCALat)
      const northCandidates = nonCAStops.filter(s => s.lat > maxCALat);
      if (northCandidates.length > 0) {
        const northBorder = northCandidates.reduce((a, b) => a.lat < b.lat ? a : b);
        borderStopNames.add(northBorder.stop_name);
      }

      // Closest stop east of CA segment (lowest lng among those east of maxCALng)
      const eastCandidates = nonCAStops.filter(s => s.lng > maxCALng);
      if (eastCandidates.length > 0) {
        const eastBorder = eastCandidates.reduce((a, b) => a.lng < b.lng ? a : b);
        borderStopNames.add(eastBorder.stop_name);
      }
    }

    const stopFeatures = [];
    const seenNames = new Set();
    for (const s of allRouteStops) {
      if (!s.inCA && !borderStopNames.has(s.stop_name)) continue;

      let name = (s.stop_name || s.stop_id)
        .replace(/\s+Amtrak\s+Station$/i, "")
        .replace(/\s+Amtrak$/i, "")
        .replace(/,\s*CA\s*$/i, "")
        .replace(/\s+-\s+/g, " — ");

      if (seenNames.has(name)) continue;
      seenNames.add(name);

      stopFeatures.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [+s.lng.toFixed(5), +s.lat.toFixed(5)],
        },
        properties: {
          name,
          stopId: s.stop_id,
          system: config.systemId,
          routes: [amtrakRouteId],
          colors: [config.color],
        },
      });
    }
    console.log(`  Stops: ${stopFeatures.length} (CA + border)`);

    // Write GeoJSON
    const routesGeo = { type: "FeatureCollection", features: routeFeatures };
    const stopsGeo = { type: "FeatureCollection", features: stopFeatures };

    const routesFile = join(OUT_DIR, `${config.systemId}-routes.geojson`);
    const stopsFile = join(OUT_DIR, `${config.systemId}-stops.geojson`);

    writeFileSync(routesFile, JSON.stringify(routesGeo));
    writeFileSync(stopsFile, JSON.stringify(stopsGeo));

    const rKB = (Buffer.byteLength(JSON.stringify(routesGeo)) / 1024).toFixed(1);
    const sKB = (Buffer.byteLength(JSON.stringify(stopsGeo)) / 1024).toFixed(1);
    console.log(`  → ${routesFile} (${routeFeatures.length} routes, ${rKB} KB)`);
    console.log(`  → ${stopsFile} (${stopFeatures.length} stops, ${sKB} KB)`);
  }
}

// ── Main ──

function main() {
  console.log("Building Amtrak long-distance transit data (CA segments)\n");
  downloadGTFS();
  build();
  rmSync(TMP_DIR, { recursive: true, force: true });
  console.log("\nDone!");
}

main();
